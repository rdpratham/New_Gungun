"""
OAuth2 authentication to Microsoft Graph via MSAL.
Supports device-code flow (interactive) and client-credentials flow (app-only).
Tokens are cached in ~/.outlook_agent_token_cache.json.
"""

import json
import os
import logging
from pathlib import Path
from typing import Optional

import msal

logger = logging.getLogger(__name__)

GRAPH_SCOPES = [
    "https://graph.microsoft.com/Mail.Read",
    "https://graph.microsoft.com/Mail.ReadBasic",
]

GRAPH_BASE = "https://graph.microsoft.com/v1.0"

TOKEN_CACHE_PATH = Path.home() / ".outlook_agent_token_cache.json"


def _load_cache() -> msal.SerializableTokenCache:
    cache = msal.SerializableTokenCache()
    if TOKEN_CACHE_PATH.exists():
        cache.deserialize(TOKEN_CACHE_PATH.read_text())
    return cache


def _save_cache(cache: msal.SerializableTokenCache) -> None:
    if cache.has_state_changed:
        TOKEN_CACHE_PATH.write_text(cache.serialize())
        TOKEN_CACHE_PATH.chmod(0o600)


def get_app(client_id: str, tenant_id: str, client_secret: Optional[str] = None) -> msal.ClientApplication:
    cache = _load_cache()
    if client_secret:
        app = msal.ConfidentialClientApplication(
            client_id,
            authority=f"https://login.microsoftonline.com/{tenant_id}",
            client_credential=client_secret,
            token_cache=cache,
        )
    else:
        app = msal.PublicClientApplication(
            client_id,
            authority=f"https://login.microsoftonline.com/{tenant_id}",
            token_cache=cache,
        )
    return app


def get_token(
    client_id: str,
    tenant_id: str,
    client_secret: Optional[str] = None,
) -> str:
    """Return a valid access token, refreshing or re-authenticating as needed."""
    app = get_app(client_id, tenant_id, client_secret)
    cache = app.token_cache

    # App-only flow
    if client_secret:
        scopes = ["https://graph.microsoft.com/.default"]
        result = app.acquire_token_silent(scopes, account=None)
        if not result:
            result = app.acquire_token_for_client(scopes=scopes)
        _save_cache(cache)
        if "access_token" in result:
            return result["access_token"]
        raise RuntimeError(f"Token acquisition failed: {result.get('error_description', result)}")

    # Delegated flow: try silent first
    accounts = app.get_accounts()
    if accounts:
        result = app.acquire_token_silent(GRAPH_SCOPES, account=accounts[0])
        if result and "access_token" in result:
            _save_cache(cache)
            return result["access_token"]

    # Device-code flow
    flow = app.initiate_device_flow(scopes=GRAPH_SCOPES)
    if "user_code" not in flow:
        raise RuntimeError(f"Device flow initiation failed: {flow}")

    print("\n" + "=" * 60)
    print("AUTHENTICATION REQUIRED")
    print(flow["message"])
    print("=" * 60 + "\n")

    result = app.acquire_token_by_device_flow(flow)
    _save_cache(cache)

    if "access_token" in result:
        logger.info("Authentication successful")
        return result["access_token"]
    raise RuntimeError(f"Authentication failed: {result.get('error_description', result)}")


def clear_token_cache() -> None:
    """Remove the cached token file (forces re-authentication on next run)."""
    if TOKEN_CACHE_PATH.exists():
        TOKEN_CACHE_PATH.unlink()
        logger.info("Token cache cleared")
