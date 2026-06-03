"""ZoomInfo MCP Client — interactive CLI to query ZoomInfo in real time."""

import asyncio
import json
import os
import sys
import time
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv()

ZOOMINFO_BASE_URL = "https://api.zoominfo.com"
CLIENT_ID   = os.environ.get("ZOOMINFO_CLIENT_ID", "")
PRIVATE_KEY = os.environ.get("ZOOMINFO_PRIVATE_KEY", "")
USERNAME    = os.environ.get("ZOOMINFO_USERNAME", "")
PASSWORD    = os.environ.get("ZOOMINFO_PASSWORD", "")

_token_cache: dict[str, Any] = {}

CYAN   = "\033[96m"
GREEN  = "\033[92m"
YELLOW = "\033[93m"
RED    = "\033[91m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

TOOLS = {
    "1":  "search_companies",
    "2":  "search_contacts",
    "3":  "enrich_company",
    "4":  "enrich_contact",
    "5":  "enrich_intent",
    "6":  "enrich_news",
    "7":  "enrich_scoops",
    "8":  "find_similar_companies",
    "9":  "find_similar_contacts",
    "10": "search_intent",
    "11": "get_recommended_contacts",
    "12": "account_research",
    "13": "contact_research",
    "14": "get_gtm_context",
    "15": "lookup",
}

TOOL_PROMPTS: dict[str, list[tuple[str, str, bool]]] = {
    "search_companies": [
        ("company_name",       "Company name (partial match)",          False),
        ("industry",           "Industry (e.g. Software, Finance)",     False),
        ("revenue_min",        "Min revenue in USD",                    False),
        ("revenue_max",        "Max revenue in USD",                    False),
        ("employee_count_min", "Min employee count",                    False),
        ("employee_count_max", "Max employee count",                    False),
        ("country",            "Country",                               False),
        ("state",              "State / Province",                      False),
        ("city",               "City",                                  False),
        ("tech_used",          "Technologies used (comma-separated)",   False),
        ("page_size",          "Results per page [default 10]",         False),
    ],
    "search_contacts": [
        ("first_name",       "First name",                              False),
        ("last_name",        "Last name",                               False),
        ("job_title",        "Job title",                               False),
        ("company_name",     "Company name",                            False),
        ("management_level", "Level (C-Level, VP, Director, Manager)",  False),
        ("department",       "Department (Engineering, Sales, …)",      False),
        ("country",          "Country",                                 False),
        ("state",            "State",                                   False),
        ("has_email",        "Must have email? (y/n)",                  False),
        ("has_phone",        "Must have phone? (y/n)",                  False),
        ("page_size",        "Results per page [default 10]",           False),
    ],
    "enrich_company": [
        ("company_name",  "Company name",          False),
        ("domain",        "Domain (e.g. acme.com)",False),
        ("zi_company_id", "ZoomInfo company ID",   False),
    ],
    "enrich_contact": [
        ("first_name",    "First name",            False),
        ("last_name",     "Last name",             False),
        ("company_name",  "Company name",          False),
        ("email",         "Email address",         False),
        ("zi_contact_id", "ZoomInfo contact ID",   False),
    ],
    "enrich_intent": [
        ("company_name",  "Company name",                              False),
        ("domain",        "Domain",                                    False),
        ("topics",        "Intent topics (comma-separated)",           False),
    ],
    "enrich_news": [
        ("company_name",  "Company name",          False),
        ("domain",        "Domain",                False),
        ("limit",         "Max articles [default 10]", False),
    ],
    "enrich_scoops": [
        ("company_name",  "Company name",          False),
        ("domain",        "Domain",                False),
        ("scoop_type",    "Scoop type (optional)", False),
        ("limit",         "Max results [default 10]", False),
    ],
    "find_similar_companies": [
        ("company_name",  "Company name",          False),
        ("domain",        "Domain",                False),
        ("zi_company_id", "ZoomInfo company ID",   False),
        ("page_size",     "Results [default 10]",  False),
    ],
    "find_similar_contacts": [
        ("first_name",    "First name",            False),
        ("last_name",     "Last name",             False),
        ("company_name",  "Company name",          False),
        ("zi_contact_id", "ZoomInfo contact ID",   False),
        ("page_size",     "Results [default 10]",  False),
    ],
    "search_intent": [
        ("topics",             "Intent topics (comma-separated) *required*", True),
        ("industry",           "Industry filter",                            False),
        ("employee_count_min", "Min employees",                              False),
        ("employee_count_max", "Max employees",                              False),
        ("country",            "Country",                                    False),
        ("page_size",          "Results [default 10]",                       False),
    ],
    "get_recommended_contacts": [
        ("company_name",     "Company name",                           False),
        ("zi_company_id",    "ZoomInfo company ID",                    False),
        ("persona",          "Target persona (e.g. IT Decision Maker)",False),
        ("department",       "Department",                             False),
        ("management_level", "Management level",                       False),
        ("page_size",        "Results [default 10]",                   False),
    ],
    "account_research": [
        ("company_name",  "Company name",          False),
        ("domain",        "Domain",                False),
        ("zi_company_id", "ZoomInfo company ID",   False),
    ],
    "contact_research": [
        ("first_name",    "First name",            False),
        ("last_name",     "Last name",             False),
        ("company_name",  "Company name",          False),
        ("email",         "Email",                 False),
        ("zi_contact_id", "ZoomInfo contact ID",   False),
    ],
    "get_gtm_context": [
        ("company_name",  "Company name",          False),
        ("domain",        "Domain",                False),
        ("zi_company_id", "ZoomInfo company ID",   False),
        ("persona",       "Buying persona",        False),
    ],
    "lookup": [
        ("query",       "Search query (name, domain, or 'CEO of Acme') *required*", True),
        ("entity_type", "Entity type: company / contact / auto [default auto]",     False),
    ],
}


# ── Auth ──────────────────────────────────────────────────────────────────────

async def get_access_token(client: httpx.AsyncClient) -> str:
    if _token_cache.get("token") and _token_cache.get("expires_at", 0) > time.time() + 60:
        return _token_cache["token"]

    print(f"{YELLOW}Authenticating with ZoomInfo...{RESET}")
    if CLIENT_ID and PRIVATE_KEY:
        resp = await client.post(
            f"{ZOOMINFO_BASE_URL}/authenticate",
            json={"client_id": CLIENT_ID, "private_key": PRIVATE_KEY},
        )
    elif USERNAME and PASSWORD:
        resp = await client.post(
            f"{ZOOMINFO_BASE_URL}/authenticate",
            json={"username": USERNAME, "password": PASSWORD},
        )
    else:
        print(f"{RED}No credentials found. Copy .env.example to .env and fill in your ZoomInfo credentials.{RESET}")
        sys.exit(1)

    resp.raise_for_status()
    data = resp.json()
    _token_cache["token"] = data["jwt"]
    _token_cache["expires_at"] = time.time() + data.get("expiresIn", 3600)
    print(f"{GREEN}Authenticated.{RESET}\n")
    return _token_cache["token"]


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


# ── Payload builders (mirrored from server.py) ────────────────────────────────

def _company_id_payload(args: dict) -> dict:
    if args.get("zi_company_id"):
        return {"matchCriteria": [{"field": "id",          "values": [args["zi_company_id"]]}]}
    if args.get("domain"):
        return {"matchCriteria": [{"field": "website",     "values": [args["domain"]]}]}
    if args.get("company_name"):
        return {"matchCriteria": [{"field": "companyName", "values": [args["company_name"]]}]}
    return {}


def _build_company_search_payload(args: dict) -> dict:
    match_params: list[dict] = []
    for field, key in [
        ("company_name", "companyName"), ("industry", "industry"),
        ("country", "locationCountryIsoAlpha2"), ("state", "locationState"), ("city", "locationCity"),
    ]:
        if args.get(field):
            match_params.append({"field": key, "values": [args[field]]})

    for range_field, zi_field in [("revenue", ["revenue_min", "revenue_max"]),
                                   ("employeeCount", ["employee_count_min", "employee_count_max"])]:
        lo, hi = zi_field
        if args.get(lo) or args.get(hi):
            entry: dict = {"field": range_field, "range": {}}
            if args.get(lo): entry["range"]["min"] = args[lo]
            if args.get(hi): entry["range"]["max"] = args[hi]
            match_params.append(entry)

    if args.get("tech_used"):
        match_params.append({"field": "techUsed", "values": args["tech_used"]})

    return {
        "matchCriteria": match_params,
        "page": args.get("page", 1),
        "pageSize": min(int(args.get("page_size", 10)), 100),
    }


def _build_contact_search_payload(args: dict) -> dict:
    match_params: list[dict] = []
    for field, key in [
        ("first_name", "firstName"), ("last_name", "lastName"), ("job_title", "jobTitle"),
        ("company_name", "companyName"), ("management_level", "managementLevel"),
        ("department", "department"), ("country", "locationCountryIsoAlpha2"),
        ("state", "locationState"), ("city", "locationCity"),
    ]:
        if args.get(field):
            match_params.append({"field": key, "values": [args[field]]})

    if args.get("has_email"): match_params.append({"field": "hasEmail",       "values": [True]})
    if args.get("has_phone"): match_params.append({"field": "hasDirectPhone", "values": [True]})

    return {
        "matchCriteria": match_params,
        "page": args.get("page", 1),
        "pageSize": min(int(args.get("page_size", 10)), 100),
    }


# ── Dispatcher ────────────────────────────────────────────────────────────────

async def dispatch(client: httpx.AsyncClient, tool: str, args: dict) -> Any:
    if tool == "search_companies":      return await zi_post(client, "/search/company",         _build_company_search_payload(args))
    if tool == "search_contacts":       return await zi_post(client, "/search/contact",         _build_contact_search_payload(args))
    if tool == "enrich_company":        return await zi_post(client, "/enrich/company",         _company_id_payload(args))
    if tool == "enrich_contact":
        payload: dict = {}
        criteria: list = []
        if args.get("zi_contact_id"): criteria.append({"field": "id",    "values": [args["zi_contact_id"]]})
        elif args.get("email"):       criteria.append({"field": "email", "values": [args["email"]]})
        else:
            for f, k in [("first_name","firstName"),("last_name","lastName"),("company_name","companyName")]:
                if args.get(f): criteria.append({"field": k, "values": [args[f]]})
        payload["matchCriteria"] = criteria
        return await zi_post(client, "/enrich/contact", payload)
    if tool == "enrich_intent":
        payload = _company_id_payload(args)
        if args.get("topics"): payload["topics"] = args["topics"]
        return await zi_post(client, "/enrich/intent", payload)
    if tool == "enrich_news":
        payload = _company_id_payload(args)
        payload["resultSize"] = int(args.get("limit", 10))
        return await zi_post(client, "/enrich/news", payload)
    if tool == "enrich_scoops":
        payload = _company_id_payload(args)
        payload["resultSize"] = int(args.get("limit", 10))
        if args.get("scoop_type"): payload["scoopType"] = args["scoop_type"]
        return await zi_post(client, "/enrich/scoops", payload)
    if tool == "find_similar_companies":
        payload = _company_id_payload(args)
        payload["pageSize"] = int(args.get("page_size", 10))
        return await zi_post(client, "/search/similarcompanies", payload)
    if tool == "find_similar_contacts":
        payload = {}
        if args.get("zi_contact_id"): payload["matchCriteria"] = [{"field":"id","values":[args["zi_contact_id"]]}]
        else:
            criteria = []
            for f, k in [("first_name","firstName"),("last_name","lastName"),("company_name","companyName")]:
                if args.get(f): criteria.append({"field":k,"values":[args[f]]})
            payload["matchCriteria"] = criteria
        payload["pageSize"] = int(args.get("page_size", 10))
        return await zi_post(client, "/search/similarcontacts", payload)
    if tool == "search_intent":
        payload = {"topics": args["topics"], "page": args.get("page",1), "pageSize": int(args.get("page_size",10))}
        for f, k in [("industry","industry"),("country","locationCountryIsoAlpha2")]:
            if args.get(f): payload.setdefault("matchCriteria",[]).append({"field":k,"values":[args[f]]})
        for f, k in [("employee_count_min","min"),("employee_count_max","max")]:
            if args.get(f): payload.setdefault("employeeCountRange",{})[k] = int(args[f])
        return await zi_post(client, "/search/intent", payload)
    if tool == "get_recommended_contacts":
        payload = {}
        if args.get("zi_company_id"): payload["companyId"]   = args["zi_company_id"]
        elif args.get("company_name"):payload["companyName"] = args["company_name"]
        for opt in ["persona","department","management_level"]:
            if args.get(opt): payload[opt] = args[opt]
        payload["pageSize"] = int(args.get("page_size", 10))
        return await zi_post(client, "/recommend/contacts", payload)
    if tool == "account_research":   return await zi_post(client, "/research/account",  _company_id_payload(args))
    if tool == "contact_research":
        payload = {}
        if args.get("zi_contact_id"): payload["matchCriteria"] = [{"field":"id",    "values":[args["zi_contact_id"]]}]
        elif args.get("email"):        payload["matchCriteria"] = [{"field":"email", "values":[args["email"]]}]
        else:
            criteria = []
            for f, k in [("first_name","firstName"),("last_name","lastName"),("company_name","companyName")]:
                if args.get(f): criteria.append({"field":k,"values":[args[f]]})
            payload["matchCriteria"] = criteria
        return await zi_post(client, "/research/contact", payload)
    if tool == "get_gtm_context":
        payload = _company_id_payload(args)
        if args.get("persona"): payload["persona"] = args["persona"]
        return await zi_post(client, "/gtm/context", payload)
    if tool == "lookup":
        query       = args["query"]
        entity_type = args.get("entity_type", "auto")
        if entity_type == "company" or (entity_type == "auto" and "." in query and " " not in query):
            return await zi_post(client, "/search/company",
                {"matchCriteria":[{"field":"website","values":[query]}],"pageSize":5})
        elif entity_type == "contact":
            parts = query.split()
            criteria = []
            if len(parts) >= 2:
                criteria += [{"field":"firstName","values":[parts[0]]},{"field":"lastName","values":[parts[-1]]}]
            else:
                criteria.append({"field":"lastName","values":[query]})
            return await zi_post(client, "/search/contact", {"matchCriteria":criteria,"pageSize":5})
        else:
            result = await zi_post(client, "/search/company",
                {"matchCriteria":[{"field":"companyName","values":[query]}],"pageSize":3})
            return {"auto_lookup":"company","result":result}
    return {"error": f"Unknown tool: {tool}"}


# ── CLI helpers ───────────────────────────────────────────────────────────────

def print_banner() -> None:
    print(f"""
{BOLD}{CYAN}╔══════════════════════════════════════════╗
║       ZoomInfo MCP Client  v1.0          ║
║   Real-time Company & Contact Search     ║
╚══════════════════════════════════════════╝{RESET}
""")


def print_menu() -> None:
    print(f"{BOLD}Available Tools:{RESET}")
    for num, name in TOOLS.items():
        print(f"  {CYAN}{num:>2}{RESET}. {name}")
    print(f"  {CYAN} q{RESET}. Quit\n")


def ask(prompt: str, required: bool = False) -> str:
    marker = f"{RED}*{RESET}" if required else " "
    while True:
        val = input(f"  {marker} {prompt}: ").strip()
        if val or not required:
            return val
        print(f"    {RED}This field is required.{RESET}")


def collect_args(tool: str) -> dict:
    prompts = TOOL_PROMPTS.get(tool, [])
    args: dict = {}
    print(f"\n{YELLOW}Enter query parameters (press Enter to skip optional fields):{RESET}\n")
    for field, label, required in prompts:
        raw = ask(label, required)
        if not raw:
            continue
        # Type coercions
        if field in ("revenue_min", "revenue_max"):
            args[field] = float(raw)
        elif field in ("employee_count_min", "employee_count_max", "zi_company_id",
                       "zi_contact_id", "limit", "page_size"):
            args[field] = int(raw)
        elif field in ("has_email", "has_phone"):
            args[field] = raw.lower() in ("y", "yes", "true", "1")
        elif field in ("tech_used", "topics"):
            args[field] = [v.strip() for v in raw.split(",") if v.strip()]
        elif field == "entity_type" and not raw:
            args[field] = "auto"
        else:
            args[field] = raw
    return args


def print_result(data: Any) -> None:
    print(f"\n{BOLD}{GREEN}── Result ───────────────────────────────────────{RESET}")
    print(json.dumps(data, indent=2, default=str))
    print(f"{GREEN}─────────────────────────────────────────────────{RESET}\n")


# ── Main loop ─────────────────────────────────────────────────────────────────

async def main() -> None:
    print_banner()

    if not any([CLIENT_ID, USERNAME]):
        print(f"{RED}No credentials found.{RESET}")
        print("Copy .env.example to .env and add your ZoomInfo credentials, then re-run.\n")
        sys.exit(1)

    async with httpx.AsyncClient() as client:
        while True:
            print_menu()
            choice = input(f"{BOLD}Select a tool (1-15 or q): {RESET}").strip().lower()

            if choice in ("q", "quit", "exit"):
                print(f"\n{CYAN}Goodbye!{RESET}\n")
                break

            if choice not in TOOLS:
                print(f"{RED}Invalid choice. Enter a number 1-15 or q to quit.{RESET}\n")
                continue

            tool = TOOLS[choice]
            print(f"\n{BOLD}{CYAN}Tool: {tool}{RESET}")

            args = collect_args(tool)

            print(f"\n{YELLOW}Querying ZoomInfo...{RESET}")
            try:
                result = await dispatch(client, tool, args)
                print_result(result)
            except httpx.HTTPStatusError as exc:
                print(f"\n{RED}HTTP Error {exc.response.status_code}: {exc.response.text}{RESET}\n")
            except Exception as exc:
                print(f"\n{RED}Error: {exc}{RESET}\n")

            again = input("Run another query? (y/n) [y]: ").strip().lower()
            if again in ("n", "no"):
                print(f"\n{CYAN}Goodbye!{RESET}\n")
                break
            print()


if __name__ == "__main__":
    asyncio.run(main())
