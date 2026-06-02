"""ZoomInfo MCP Server — real-time company and contact data search."""

import asyncio
import json
import os
from typing import Any

import httpx
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import (
    TextContent,
    Tool,
)

ZOOMINFO_BASE_URL = "https://api.zoominfo.com"
CLIENT_ID = os.environ.get("ZOOMINFO_CLIENT_ID", "")
PRIVATE_KEY = os.environ.get("ZOOMINFO_PRIVATE_KEY", "")
USERNAME = os.environ.get("ZOOMINFO_USERNAME", "")
PASSWORD = os.environ.get("ZOOMINFO_PASSWORD", "")

_token_cache: dict[str, Any] = {}


async def get_access_token(client: httpx.AsyncClient) -> str:
    """Obtain a JWT access token, reusing a cached one if still valid."""
    import time

    if _token_cache.get("token") and _token_cache.get("expires_at", 0) > time.time() + 60:
        return _token_cache["token"]

    if CLIENT_ID and PRIVATE_KEY:
        resp = await client.post(
            f"{ZOOMINFO_BASE_URL}/authenticate",
            json={"client_id": CLIENT_ID, "private_key": PRIVATE_KEY},
        )
    else:
        resp = await client.post(
            f"{ZOOMINFO_BASE_URL}/authenticate",
            json={"username": USERNAME, "password": PASSWORD},
        )

    resp.raise_for_status()
    data = resp.json()
    token = data["jwt"]
    _token_cache["token"] = token
    _token_cache["expires_at"] = time.time() + data.get("expiresIn", 3600)
    return token


async def zi_post(client: httpx.AsyncClient, path: str, payload: dict) -> dict:
    token = await get_access_token(client)
    resp = await client.post(
        f"{ZOOMINFO_BASE_URL}{path}",
        json=payload,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def _fmt(data: Any) -> str:
    return json.dumps(data, indent=2, default=str)


app = Server("zoominfo-mcp")


@app.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="search_companies",
            description="Search ZoomInfo company database with filters such as name, industry, revenue, employee count, location, and more.",
            inputSchema={
                "type": "object",
                "properties": {
                    "company_name": {"type": "string", "description": "Company name (partial match supported)"},
                    "industry": {"type": "string", "description": "Industry name or SIC code"},
                    "revenue_min": {"type": "number", "description": "Minimum annual revenue (USD)"},
                    "revenue_max": {"type": "number", "description": "Maximum annual revenue (USD)"},
                    "employee_count_min": {"type": "integer", "description": "Minimum employee count"},
                    "employee_count_max": {"type": "integer", "description": "Maximum employee count"},
                    "country": {"type": "string", "description": "Country name or ISO code"},
                    "state": {"type": "string", "description": "State / province"},
                    "city": {"type": "string", "description": "City"},
                    "tech_used": {"type": "array", "items": {"type": "string"}, "description": "Technologies used by the company"},
                    "page": {"type": "integer", "default": 1, "description": "Page number"},
                    "page_size": {"type": "integer", "default": 25, "description": "Results per page (max 100)"},
                    "output_fields": {"type": "array", "items": {"type": "string"}, "description": "Specific fields to return"},
                },
            },
        ),
        Tool(
            name="search_contacts",
            description="Search ZoomInfo contact database with filters such as name, title, company, seniority, department, and location.",
            inputSchema={
                "type": "object",
                "properties": {
                    "first_name": {"type": "string"},
                    "last_name": {"type": "string"},
                    "job_title": {"type": "string", "description": "Job title (partial match)"},
                    "company_name": {"type": "string"},
                    "management_level": {"type": "string", "description": "e.g. C-Level, VP, Director, Manager"},
                    "department": {"type": "string", "description": "e.g. Engineering, Sales, Marketing"},
                    "country": {"type": "string"},
                    "state": {"type": "string"},
                    "city": {"type": "string"},
                    "has_email": {"type": "boolean", "description": "Only return contacts with a verified email"},
                    "has_phone": {"type": "boolean", "description": "Only return contacts with a direct phone number"},
                    "page": {"type": "integer", "default": 1},
                    "page_size": {"type": "integer", "default": 25},
                    "output_fields": {"type": "array", "items": {"type": "string"}},
                },
            },
        ),
        Tool(
            name="enrich_company",
            description="Enrich a single company record with full ZoomInfo data using a company name, domain, or ZoomInfo company ID.",
            inputSchema={
                "type": "object",
                "properties": {
                    "company_name": {"type": "string"},
                    "domain": {"type": "string", "description": "Company website domain (e.g. acme.com)"},
                    "zi_company_id": {"type": "integer", "description": "ZoomInfo company ID"},
                    "output_fields": {"type": "array", "items": {"type": "string"}},
                },
            },
        ),
        Tool(
            name="enrich_contact",
            description="Enrich a single contact record with full ZoomInfo data using name + company, email, or ZoomInfo person ID.",
            inputSchema={
                "type": "object",
                "properties": {
                    "first_name": {"type": "string"},
                    "last_name": {"type": "string"},
                    "company_name": {"type": "string"},
                    "email": {"type": "string"},
                    "zi_contact_id": {"type": "integer", "description": "ZoomInfo person ID"},
                    "output_fields": {"type": "array", "items": {"type": "string"}},
                },
            },
        ),
        Tool(
            name="enrich_intent",
            description="Retrieve buyer-intent signals for companies — topics they are actively researching.",
            inputSchema={
                "type": "object",
                "properties": {
                    "company_name": {"type": "string"},
                    "domain": {"type": "string"},
                    "zi_company_id": {"type": "integer"},
                    "topics": {"type": "array", "items": {"type": "string"}, "description": "Filter to specific intent topics"},
                },
                "required": [],
            },
        ),
        Tool(
            name="enrich_news",
            description="Fetch recent news and press mentions for a company.",
            inputSchema={
                "type": "object",
                "properties": {
                    "company_name": {"type": "string"},
                    "domain": {"type": "string"},
                    "zi_company_id": {"type": "integer"},
                    "limit": {"type": "integer", "default": 10, "description": "Max articles to return"},
                },
            },
        ),
        Tool(
            name="enrich_scoops",
            description="Fetch internal company intelligence (scoops) such as new initiatives, technology changes, and hiring signals.",
            inputSchema={
                "type": "object",
                "properties": {
                    "company_name": {"type": "string"},
                    "domain": {"type": "string"},
                    "zi_company_id": {"type": "integer"},
                    "scoop_type": {"type": "string", "description": "Filter by scoop type, e.g. 'new_initiative'"},
                    "limit": {"type": "integer", "default": 10},
                },
            },
        ),
        Tool(
            name="find_similar_companies",
            description="Find companies similar to a given company based on industry, size, and technographics.",
            inputSchema={
                "type": "object",
                "properties": {
                    "company_name": {"type": "string"},
                    "domain": {"type": "string"},
                    "zi_company_id": {"type": "integer"},
                    "page_size": {"type": "integer", "default": 10},
                },
            },
        ),
        Tool(
            name="find_similar_contacts",
            description="Find contacts similar to a given contact — useful for building target personas.",
            inputSchema={
                "type": "object",
                "properties": {
                    "first_name": {"type": "string"},
                    "last_name": {"type": "string"},
                    "company_name": {"type": "string"},
                    "zi_contact_id": {"type": "integer"},
                    "page_size": {"type": "integer", "default": 10},
                },
            },
        ),
        Tool(
            name="search_intent",
            description="Search for companies showing buyer-intent signals on specific topics.",
            inputSchema={
                "type": "object",
                "properties": {
                    "topics": {"type": "array", "items": {"type": "string"}, "description": "Intent topics to search for"},
                    "industry": {"type": "string"},
                    "employee_count_min": {"type": "integer"},
                    "employee_count_max": {"type": "integer"},
                    "country": {"type": "string"},
                    "page": {"type": "integer", "default": 1},
                    "page_size": {"type": "integer", "default": 25},
                },
                "required": ["topics"],
            },
        ),
        Tool(
            name="get_recommended_contacts",
            description="Get recommended contacts at a company based on a buying persona or role.",
            inputSchema={
                "type": "object",
                "properties": {
                    "company_name": {"type": "string"},
                    "zi_company_id": {"type": "integer"},
                    "persona": {"type": "string", "description": "Target persona, e.g. 'IT Decision Maker'"},
                    "department": {"type": "string"},
                    "management_level": {"type": "string"},
                    "page_size": {"type": "integer", "default": 10},
                },
            },
        ),
        Tool(
            name="account_research",
            description="Run a comprehensive account research report for a target company, combining firmographics, technographics, intent, scoops, and key contacts.",
            inputSchema={
                "type": "object",
                "properties": {
                    "company_name": {"type": "string"},
                    "domain": {"type": "string"},
                    "zi_company_id": {"type": "integer"},
                },
            },
        ),
        Tool(
            name="contact_research",
            description="Run a comprehensive contact research report combining profile, company context, and social signals.",
            inputSchema={
                "type": "object",
                "properties": {
                    "first_name": {"type": "string"},
                    "last_name": {"type": "string"},
                    "company_name": {"type": "string"},
                    "email": {"type": "string"},
                    "zi_contact_id": {"type": "integer"},
                },
            },
        ),
        Tool(
            name="get_gtm_context",
            description="Return go-to-market context for a company — intent, key contacts, scoops, and recommended outreach talking points.",
            inputSchema={
                "type": "object",
                "properties": {
                    "company_name": {"type": "string"},
                    "domain": {"type": "string"},
                    "zi_company_id": {"type": "integer"},
                    "persona": {"type": "string", "description": "Buying persona to target"},
                },
            },
        ),
        Tool(
            name="lookup",
            description="Free-form lookup that resolves a company or contact by any available identifier.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Natural language lookup, e.g. 'CEO of Acme Corp' or 'acme.com'"},
                    "entity_type": {"type": "string", "enum": ["company", "contact", "auto"], "default": "auto"},
                },
                "required": ["query"],
            },
        ),
    ]


def _build_company_search_payload(args: dict) -> dict:
    match_params: list[dict] = []

    for field, key in [
        ("company_name", "companyName"),
        ("industry", "industry"),
        ("country", "locationCountryIsoAlpha2"),
        ("state", "locationState"),
        ("city", "locationCity"),
    ]:
        if args.get(field):
            match_params.append({"field": key, "values": [args[field]]})

    if args.get("revenue_min") or args.get("revenue_max"):
        entry: dict = {"field": "revenue", "range": {}}
        if args.get("revenue_min"):
            entry["range"]["min"] = args["revenue_min"]
        if args.get("revenue_max"):
            entry["range"]["max"] = args["revenue_max"]
        match_params.append(entry)

    if args.get("employee_count_min") or args.get("employee_count_max"):
        entry = {"field": "employeeCount", "range": {}}
        if args.get("employee_count_min"):
            entry["range"]["min"] = args["employee_count_min"]
        if args.get("employee_count_max"):
            entry["range"]["max"] = args["employee_count_max"]
        match_params.append(entry)

    if args.get("tech_used"):
        match_params.append({"field": "techUsed", "values": args["tech_used"]})

    payload: dict = {
        "matchCriteria": match_params,
        "page": args.get("page", 1),
        "pageSize": min(args.get("page_size", 25), 100),
    }
    if args.get("output_fields"):
        payload["outputFields"] = args["output_fields"]
    return payload


def _build_contact_search_payload(args: dict) -> dict:
    match_params: list[dict] = []

    for field, key in [
        ("first_name", "firstName"),
        ("last_name", "lastName"),
        ("job_title", "jobTitle"),
        ("company_name", "companyName"),
        ("management_level", "managementLevel"),
        ("department", "department"),
        ("country", "locationCountryIsoAlpha2"),
        ("state", "locationState"),
        ("city", "locationCity"),
    ]:
        if args.get(field):
            match_params.append({"field": key, "values": [args[field]]})

    if args.get("has_email"):
        match_params.append({"field": "hasEmail", "values": [True]})
    if args.get("has_phone"):
        match_params.append({"field": "hasDirectPhone", "values": [True]})

    payload: dict = {
        "matchCriteria": match_params,
        "page": args.get("page", 1),
        "pageSize": min(args.get("page_size", 25), 100),
    }
    if args.get("output_fields"):
        payload["outputFields"] = args["output_fields"]
    return payload


@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    async with httpx.AsyncClient() as client:
        try:
            result = await _dispatch(client, name, arguments)
        except httpx.HTTPStatusError as exc:
            result = {"error": str(exc), "response_body": exc.response.text}
        except Exception as exc:
            result = {"error": type(exc).__name__, "detail": str(exc)}

    return [TextContent(type="text", text=_fmt(result))]


async def _dispatch(client: httpx.AsyncClient, name: str, args: dict) -> Any:
    if name == "search_companies":
        return await zi_post(client, "/search/company", _build_company_search_payload(args))

    if name == "search_contacts":
        return await zi_post(client, "/search/contact", _build_contact_search_payload(args))

    if name == "enrich_company":
        payload: dict = {}
        if args.get("zi_company_id"):
            payload["matchCriteria"] = [{"field": "id", "values": [args["zi_company_id"]]}]
        elif args.get("domain"):
            payload["matchCriteria"] = [{"field": "website", "values": [args["domain"]]}]
        elif args.get("company_name"):
            payload["matchCriteria"] = [{"field": "companyName", "values": [args["company_name"]]}]
        if args.get("output_fields"):
            payload["outputFields"] = args["output_fields"]
        return await zi_post(client, "/enrich/company", payload)

    if name == "enrich_contact":
        payload = {}
        criteria: list[dict] = []
        if args.get("zi_contact_id"):
            criteria.append({"field": "id", "values": [args["zi_contact_id"]]})
        elif args.get("email"):
            criteria.append({"field": "email", "values": [args["email"]]})
        else:
            if args.get("first_name"):
                criteria.append({"field": "firstName", "values": [args["first_name"]]})
            if args.get("last_name"):
                criteria.append({"field": "lastName", "values": [args["last_name"]]})
            if args.get("company_name"):
                criteria.append({"field": "companyName", "values": [args["company_name"]]})
        payload["matchCriteria"] = criteria
        if args.get("output_fields"):
            payload["outputFields"] = args["output_fields"]
        return await zi_post(client, "/enrich/contact", payload)

    if name == "enrich_intent":
        payload = _company_id_payload(args)
        if args.get("topics"):
            payload["topics"] = args["topics"]
        return await zi_post(client, "/enrich/intent", payload)

    if name == "enrich_news":
        payload = _company_id_payload(args)
        payload["resultSize"] = args.get("limit", 10)
        return await zi_post(client, "/enrich/news", payload)

    if name == "enrich_scoops":
        payload = _company_id_payload(args)
        payload["resultSize"] = args.get("limit", 10)
        if args.get("scoop_type"):
            payload["scoopType"] = args["scoop_type"]
        return await zi_post(client, "/enrich/scoops", payload)

    if name == "find_similar_companies":
        payload = _company_id_payload(args)
        payload["pageSize"] = args.get("page_size", 10)
        return await zi_post(client, "/search/similarcompanies", payload)

    if name == "find_similar_contacts":
        payload: dict = {}
        if args.get("zi_contact_id"):
            payload["matchCriteria"] = [{"field": "id", "values": [args["zi_contact_id"]]}]
        else:
            criteria = []
            for f, k in [("first_name", "firstName"), ("last_name", "lastName"), ("company_name", "companyName")]:
                if args.get(f):
                    criteria.append({"field": k, "values": [args[f]]})
            payload["matchCriteria"] = criteria
        payload["pageSize"] = args.get("page_size", 10)
        return await zi_post(client, "/search/similarcontacts", payload)

    if name == "search_intent":
        payload = {
            "topics": args["topics"],
            "page": args.get("page", 1),
            "pageSize": args.get("page_size", 25),
        }
        for field, key in [("industry", "industry"), ("country", "locationCountryIsoAlpha2")]:
            if args.get(field):
                payload.setdefault("matchCriteria", []).append({"field": key, "values": [args[field]]})
        for field, key in [("employee_count_min", "min"), ("employee_count_max", "max")]:
            if args.get(field):
                payload.setdefault("employeeCountRange", {})[key] = args[field]
        return await zi_post(client, "/search/intent", payload)

    if name == "get_recommended_contacts":
        payload = {}
        if args.get("zi_company_id"):
            payload["companyId"] = args["zi_company_id"]
        elif args.get("company_name"):
            payload["companyName"] = args["company_name"]
        for opt in ["persona", "department", "management_level"]:
            if args.get(opt):
                payload[opt] = args[opt]
        payload["pageSize"] = args.get("page_size", 10)
        return await zi_post(client, "/recommend/contacts", payload)

    if name == "account_research":
        payload = _company_id_payload(args)
        return await zi_post(client, "/research/account", payload)

    if name == "contact_research":
        payload = {}
        if args.get("zi_contact_id"):
            payload["matchCriteria"] = [{"field": "id", "values": [args["zi_contact_id"]]}]
        elif args.get("email"):
            payload["matchCriteria"] = [{"field": "email", "values": [args["email"]]}]
        else:
            criteria = []
            for f, k in [("first_name", "firstName"), ("last_name", "lastName"), ("company_name", "companyName")]:
                if args.get(f):
                    criteria.append({"field": k, "values": [args[f]]})
            payload["matchCriteria"] = criteria
        return await zi_post(client, "/research/contact", payload)

    if name == "get_gtm_context":
        payload = _company_id_payload(args)
        if args.get("persona"):
            payload["persona"] = args["persona"]
        return await zi_post(client, "/gtm/context", payload)

    if name == "lookup":
        query: str = args["query"]
        entity_type: str = args.get("entity_type", "auto")
        if entity_type == "company" or (entity_type == "auto" and "." in query and " " not in query):
            return await zi_post(client, "/search/company", {
                "matchCriteria": [{"field": "website", "values": [query]}],
                "pageSize": 5,
            })
        elif entity_type == "contact":
            parts = query.split()
            criteria = []
            if len(parts) >= 2:
                criteria.append({"field": "firstName", "values": [parts[0]]})
                criteria.append({"field": "lastName", "values": [parts[-1]]})
            else:
                criteria.append({"field": "lastName", "values": [query]})
            return await zi_post(client, "/search/contact", {"matchCriteria": criteria, "pageSize": 5})
        else:
            company_result = await zi_post(client, "/search/company", {
                "matchCriteria": [{"field": "companyName", "values": [query]}],
                "pageSize": 3,
            })
            return {"auto_lookup": "company", "result": company_result}

    return {"error": f"Unknown tool: {name}"}


def _company_id_payload(args: dict) -> dict:
    if args.get("zi_company_id"):
        return {"matchCriteria": [{"field": "id", "values": [args["zi_company_id"]]}]}
    if args.get("domain"):
        return {"matchCriteria": [{"field": "website", "values": [args["domain"]]}]}
    if args.get("company_name"):
        return {"matchCriteria": [{"field": "companyName", "values": [args["company_name"]]}]}
    return {}


async def main() -> None:
    async with stdio_server() as streams:
        await app.run(streams[0], streams[1], app.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
