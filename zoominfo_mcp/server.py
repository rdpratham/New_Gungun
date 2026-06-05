"""ZoomInfo MCP Server — real-time company and contact data search."""

import asyncio
import json
import os
import time
from typing import Any

import httpx
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

ZOOMINFO_BASE_URL = "https://api.zoominfo.com"
CLIENT_ID = os.environ.get("ZOOMINFO_CLIENT_ID", "")
PRIVATE_KEY = os.environ.get("ZOOMINFO_PRIVATE_KEY", "")
USERNAME = os.environ.get("ZOOMINFO_USERNAME", "")
PASSWORD = os.environ.get("ZOOMINFO_PASSWORD", "")

_token_cache: dict[str, Any] = {}
app = Server("zoominfo-mcp")


async def get_access_token(client: httpx.AsyncClient) -> str:
    if _token_cache.get("token") and _token_cache.get("expires_at", 0) > time.time() + 60:
        return _token_cache["token"]
    if CLIENT_ID and PRIVATE_KEY:
        resp = await client.post(f"{ZOOMINFO_BASE_URL}/authenticate",
                                 json={"client_id": CLIENT_ID, "private_key": PRIVATE_KEY})
    else:
        resp = await client.post(f"{ZOOMINFO_BASE_URL}/authenticate",
                                 json={"username": USERNAME, "password": PASSWORD})
    resp.raise_for_status()
    data = resp.json()
    _token_cache["token"] = data["jwt"]
    _token_cache["expires_at"] = time.time() + data.get("expiresIn", 3600)
    return _token_cache["token"]


async def zi_post(client: httpx.AsyncClient, path: str, payload: dict) -> dict:
    token = await get_access_token(client)
    resp = await client.post(f"{ZOOMINFO_BASE_URL}{path}", json=payload,
                             headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}, timeout=30)
    resp.raise_for_status()
    return resp.json()


def _fmt(data: Any) -> str:
    return json.dumps(data, indent=2, default=str)


def _company_id_payload(args: dict) -> dict:
    if args.get("zi_company_id"):
        return {"matchCriteria": [{"field": "id", "values": [args["zi_company_id"]]}]}
    if args.get("domain"):
        return {"matchCriteria": [{"field": "website", "values": [args["domain"]]}]}
    if args.get("company_name"):
        return {"matchCriteria": [{"field": "companyName", "values": [args["company_name"]]}]}
    return {}


@app.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(name="search_companies", description="Search ZoomInfo company database by name, industry, revenue, employees, location, tech stack.",
             inputSchema={"type":"object","properties":{"company_name":{"type":"string"},"industry":{"type":"string"},"revenue_min":{"type":"number"},"revenue_max":{"type":"number"},"employee_count_min":{"type":"integer"},"employee_count_max":{"type":"integer"},"country":{"type":"string"},"state":{"type":"string"},"city":{"type":"string"},"tech_used":{"type":"array","items":{"type":"string"}},"page":{"type":"integer","default":1},"page_size":{"type":"integer","default":25},"output_fields":{"type":"array","items":{"type":"string"}}}}),
        Tool(name="search_contacts", description="Search ZoomInfo contacts by name, title, company, seniority, department, location.",
             inputSchema={"type":"object","properties":{"first_name":{"type":"string"},"last_name":{"type":"string"},"job_title":{"type":"string"},"company_name":{"type":"string"},"management_level":{"type":"string"},"department":{"type":"string"},"country":{"type":"string"},"state":{"type":"string"},"city":{"type":"string"},"has_email":{"type":"boolean"},"has_phone":{"type":"boolean"},"page":{"type":"integer","default":1},"page_size":{"type":"integer","default":25},"output_fields":{"type":"array","items":{"type":"string"}}}}),
        Tool(name="enrich_company", description="Enrich a company record with full ZoomInfo firmographic data.",
             inputSchema={"type":"object","properties":{"company_name":{"type":"string"},"domain":{"type":"string"},"zi_company_id":{"type":"integer"},"output_fields":{"type":"array","items":{"type":"string"}}}}),
        Tool(name="enrich_contact", description="Enrich a contact with full ZoomInfo data: email, phone, title, company.",
             inputSchema={"type":"object","properties":{"first_name":{"type":"string"},"last_name":{"type":"string"},"company_name":{"type":"string"},"email":{"type":"string"},"zi_contact_id":{"type":"integer"},"output_fields":{"type":"array","items":{"type":"string"}}}}),
        Tool(name="enrich_intent", description="Buyer-intent signals — topics a company is actively researching.",
             inputSchema={"type":"object","properties":{"company_name":{"type":"string"},"domain":{"type":"string"},"zi_company_id":{"type":"integer"},"topics":{"type":"array","items":{"type":"string"}}}}),
        Tool(name="enrich_news", description="Recent news and press mentions for a company.",
             inputSchema={"type":"object","properties":{"company_name":{"type":"string"},"domain":{"type":"string"},"zi_company_id":{"type":"integer"},"limit":{"type":"integer","default":10}}}),
        Tool(name="enrich_scoops", description="Internal company intelligence: new initiatives, tech changes, hiring signals.",
             inputSchema={"type":"object","properties":{"company_name":{"type":"string"},"domain":{"type":"string"},"zi_company_id":{"type":"integer"},"scoop_type":{"type":"string"},"limit":{"type":"integer","default":10}}}),
        Tool(name="find_similar_companies", description="Find companies similar to a given company.",
             inputSchema={"type":"object","properties":{"company_name":{"type":"string"},"domain":{"type":"string"},"zi_company_id":{"type":"integer"},"page_size":{"type":"integer","default":10}}}),
        Tool(name="find_similar_contacts", description="Find contacts similar to a given contact.",
             inputSchema={"type":"object","properties":{"first_name":{"type":"string"},"last_name":{"type":"string"},"company_name":{"type":"string"},"zi_contact_id":{"type":"integer"},"page_size":{"type":"integer","default":10}}}),
        Tool(name="search_intent", description="Search companies showing buyer-intent on specific topics.",
             inputSchema={"type":"object","required":["topics"],"properties":{"topics":{"type":"array","items":{"type":"string"}},"industry":{"type":"string"},"employee_count_min":{"type":"integer"},"employee_count_max":{"type":"integer"},"country":{"type":"string"},"page":{"type":"integer","default":1},"page_size":{"type":"integer","default":25}}}),
        Tool(name="get_recommended_contacts", description="Recommended contacts at a company for a given persona or role.",
             inputSchema={"type":"object","properties":{"company_name":{"type":"string"},"zi_company_id":{"type":"integer"},"persona":{"type":"string"},"department":{"type":"string"},"management_level":{"type":"string"},"page_size":{"type":"integer","default":10}}}),
        Tool(name="account_research", description="Full account research: firmographics, technographics, intent, scoops, key contacts.",
             inputSchema={"type":"object","properties":{"company_name":{"type":"string"},"domain":{"type":"string"},"zi_company_id":{"type":"integer"}}}),
        Tool(name="contact_research", description="Full contact research: profile, company context, social signals.",
             inputSchema={"type":"object","properties":{"first_name":{"type":"string"},"last_name":{"type":"string"},"company_name":{"type":"string"},"email":{"type":"string"},"zi_contact_id":{"type":"integer"}}}),
        Tool(name="get_gtm_context", description="Go-to-market context: intent, key contacts, scoops, talking points.",
             inputSchema={"type":"object","properties":{"company_name":{"type":"string"},"domain":{"type":"string"},"zi_company_id":{"type":"integer"},"persona":{"type":"string"}}}),
        Tool(name="lookup", description="Free-form lookup by name, domain, email, or phone number.",
             inputSchema={"type":"object","required":["query"],"properties":{"query":{"type":"string","description":"e.g. 'CEO of Acme', 'acme.com', phone number, or email"},"entity_type":{"type":"string","enum":["company","contact","auto"],"default":"auto"}}}),
    ]


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
        mp = []
        for f,k in [("company_name","companyName"),("industry","industry"),("country","locationCountryIsoAlpha2"),("state","locationState"),("city","locationCity")]:
            if args.get(f): mp.append({"field":k,"values":[args[f]]})
        if args.get("revenue_min") or args.get("revenue_max"):
            e: dict = {"field":"revenue","range":{}}
            if args.get("revenue_min"): e["range"]["min"] = args["revenue_min"]
            if args.get("revenue_max"): e["range"]["max"] = args["revenue_max"]
            mp.append(e)
        if args.get("employee_count_min") or args.get("employee_count_max"):
            e = {"field":"employeeCount","range":{}}
            if args.get("employee_count_min"): e["range"]["min"] = args["employee_count_min"]
            if args.get("employee_count_max"): e["range"]["max"] = args["employee_count_max"]
            mp.append(e)
        if args.get("tech_used"): mp.append({"field":"techUsed","values":args["tech_used"]})
        p: dict = {"matchCriteria":mp,"page":args.get("page",1),"pageSize":min(args.get("page_size",25),100)}
        if args.get("output_fields"): p["outputFields"] = args["output_fields"]
        return await zi_post(client, "/search/company", p)

    if name == "search_contacts":
        mp = []
        for f,k in [("first_name","firstName"),("last_name","lastName"),("job_title","jobTitle"),("company_name","companyName"),("management_level","managementLevel"),("department","department"),("country","locationCountryIsoAlpha2"),("state","locationState"),("city","locationCity")]:
            if args.get(f): mp.append({"field":k,"values":[args[f]]})
        if args.get("has_email"): mp.append({"field":"hasEmail","values":[True]})
        if args.get("has_phone"): mp.append({"field":"hasDirectPhone","values":[True]})
        p = {"matchCriteria":mp,"page":args.get("page",1),"pageSize":min(args.get("page_size",25),100)}
        if args.get("output_fields"): p["outputFields"] = args["output_fields"]
        return await zi_post(client, "/search/contact", p)

    if name == "enrich_company":
        p = _company_id_payload(args)
        if args.get("output_fields"): p["outputFields"] = args["output_fields"]
        return await zi_post(client, "/enrich/company", p)

    if name == "enrich_contact":
        if args.get("zi_contact_id"): cr = [{"field":"id","values":[args["zi_contact_id"]]}]
        elif args.get("email"): cr = [{"field":"email","values":[args["email"]]}]
        else:
            cr = []
            for f,k in [("first_name","firstName"),("last_name","lastName"),("company_name","companyName")]:
                if args.get(f): cr.append({"field":k,"values":[args[f]]})
        p = {"matchCriteria":cr}
        if args.get("output_fields"): p["outputFields"] = args["output_fields"]
        return await zi_post(client, "/enrich/contact", p)

    if name == "enrich_intent":
        p = _company_id_payload(args)
        if args.get("topics"): p["topics"] = args["topics"]
        return await zi_post(client, "/enrich/intent", p)

    if name == "enrich_news":
        p = _company_id_payload(args)
        p["resultSize"] = args.get("limit", 10)
        return await zi_post(client, "/enrich/news", p)

    if name == "enrich_scoops":
        p = _company_id_payload(args)
        p["resultSize"] = args.get("limit", 10)
        if args.get("scoop_type"): p["scoopType"] = args["scoop_type"]
        return await zi_post(client, "/enrich/scoops", p)

    if name == "find_similar_companies":
        p = _company_id_payload(args)
        p["pageSize"] = args.get("page_size", 10)
        return await zi_post(client, "/search/similarcompanies", p)

    if name == "find_similar_contacts":
        if args.get("zi_contact_id"): cr = [{"field":"id","values":[args["zi_contact_id"]]}]
        else:
            cr = []
            for f,k in [("first_name","firstName"),("last_name","lastName"),("company_name","companyName")]:
                if args.get(f): cr.append({"field":k,"values":[args[f]]})
        return await zi_post(client, "/search/similarcontacts", {"matchCriteria":cr,"pageSize":args.get("page_size",10)})

    if name == "search_intent":
        p = {"topics":args["topics"],"page":args.get("page",1),"pageSize":args.get("page_size",25)}
        for f,k in [("industry","industry"),("country","locationCountryIsoAlpha2")]:
            if args.get(f): p.setdefault("matchCriteria",[]).append({"field":k,"values":[args[f]]})
        for f,k in [("employee_count_min","min"),("employee_count_max","max")]:
            if args.get(f): p.setdefault("employeeCountRange",{})[k] = args[f]
        return await zi_post(client, "/search/intent", p)

    if name == "get_recommended_contacts":
        p = {}
        if args.get("zi_company_id"): p["companyId"] = args["zi_company_id"]
        elif args.get("company_name"): p["companyName"] = args["company_name"]
        for opt in ["persona","department","management_level"]:
            if args.get(opt): p[opt] = args[opt]
        p["pageSize"] = args.get("page_size", 10)
        return await zi_post(client, "/recommend/contacts", p)

    if name == "account_research":
        return await zi_post(client, "/research/account", _company_id_payload(args))

    if name == "contact_research":
        if args.get("zi_contact_id"): cr = [{"field":"id","values":[args["zi_contact_id"]]}]
        elif args.get("email"): cr = [{"field":"email","values":[args["email"]]}]
        else:
            cr = []
            for f,k in [("first_name","firstName"),("last_name","lastName"),("company_name","companyName")]:
                if args.get(f): cr.append({"field":k,"values":[args[f]]})
        return await zi_post(client, "/research/contact", {"matchCriteria":cr})

    if name == "get_gtm_context":
        p = _company_id_payload(args)
        if args.get("persona"): p["persona"] = args["persona"]
        return await zi_post(client, "/gtm/context", p)

    if name == "lookup":
        query = args["query"]
        entity_type = args.get("entity_type", "auto")
        if entity_type == "company" or (entity_type == "auto" and "." in query and " " not in query):
            return await zi_post(client, "/search/company", {"matchCriteria":[{"field":"website","values":[query]}],"pageSize":5})
        elif entity_type == "contact":
            parts = query.split()
            cr = []
            if len(parts) >= 2:
                cr = [{"field":"firstName","values":[parts[0]]},{"field":"lastName","values":[parts[-1]]}]
            else:
                cr = [{"field":"lastName","values":[query]}]
            return await zi_post(client, "/search/contact", {"matchCriteria":cr,"pageSize":5})
        else:
            return await zi_post(client, "/search/company", {"matchCriteria":[{"field":"companyName","values":[query]}],"pageSize":3})

    return {"error": f"Unknown tool: {name}"}


async def main() -> None:
    async with stdio_server() as streams:
        await app.run(streams[0], streams[1], app.create_initialization_options())

if __name__ == "__main__":
    asyncio.run(main())
