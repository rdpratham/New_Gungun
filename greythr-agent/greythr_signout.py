#!/usr/bin/env python3
"""
GreyHR Attendance Sign-Out Automation
Performs sign-out for employee 110612 at shorthillstech.greythr.com
"""

import base64, hashlib, json, os, secrets, sys, urllib.parse
import requests
from Crypto.PublicKey import RSA
from Crypto.Cipher import PKCS1_OAEP
from Crypto.Hash import SHA256

# Configuration
PROXY    = os.environ.get("HTTPS_PROXY")
CA       = "/root/.ccr/ca-bundle.crt"
TENANT   = "shorthillstech.greythr.com"
IDP      = "idp-coral.greythr.com"
USERNAME = "110612"
PASSWORD = "Rd1208@tech"

PEM = """-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoLf7n9YvJsoinXlx6hNS
qcwLZVKR1VoMgrvYPPyfk0c5OmgUoECdxsSwr7fY58BDnAJL/t4xSWjlP8wccPRH
L6R6wXJhBc4/9S7jows/Bc5TqDOdP7TRwhmmHzgBJLabNuDvS5H77iGNjnoob3AW
s/a1dTG0Ztf2p7TUCG2leHW6UckUTvYhGpO9W7WO1rqBpdPlfN7fhhbkNermzfe0
dJSQdTaztAmLco8QCKhKwvMvMXNfF53sAOOkNGBkF/R7TIHtu9slfVy+gJbBYwAr
vmEyoYitD76f7v73YRlMGJcVj+9aWCSQ0Mpdc39wmiH9z9WQdC9TsVVc0TOcF3Ov
FQIDAQAB
-----END PUBLIC KEY-----"""


def log(msg):
    print(f"[greythr] {msg}", flush=True)


def make_session():
    s = requests.Session()
    if PROXY:
        s.proxies = {"http": PROXY, "https": PROXY}
    s.verify = CA
    s.headers.update({
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
    })
    return s


def authenticate(s):
    """Full OAuth2 PKCE flow. Leaves session with access_token cookie set."""
    key = RSA.import_key(PEM)
    enc_pw = base64.b64encode(PKCS1_OAEP.new(key, hashAlgo=SHA256).encrypt(PASSWORD.encode())).decode()

    log("Loading IDP portal...")
    s.get(f"https://{IDP}/uas/portal/", headers={"Accept": "text/html,*/*"})

    log("Fetching session config...")
    cfg = s.get(f"https://{TENANT}/uas/v1/session-config").json()
    redirect_uri = cfg["oAuthRedirectUrl"]
    hydra_url    = cfg["hydraFrontendServer"]
    access_id    = cfg["accessId"]

    pkce_v = base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b"=").decode()
    pkce_c = base64.urlsafe_b64encode(hashlib.sha256(pkce_v.encode()).digest()).rstrip(b"=").decode()
    hint   = base64.b64encode(json.dumps({"host": TENANT}, separators=(",", ":")).encode()).decode()

    log("Starting OAuth2 PKCE flow...")
    oauth_url = (
        f"{hydra_url}oauth2/auth"
        f"?client_id=greythr-coral"
        f"&redirect_uri={urllib.parse.quote(redirect_uri)}"
        f"&response_type=code"
        f"&scope=openid+offline"
        f"&state={secrets.token_urlsafe(32)}"
        f"&nonce={secrets.token_urlsafe(16)}"
        f"&code_challenge={pkce_c}"
        f"&code_challenge_method=S256"
        f"&login_hint={urllib.parse.quote(hint)}"
        f"&access_id={urllib.parse.quote(access_id)}"
    )

    r = s.get(oauth_url, allow_redirects=False)
    loc = r.headers.get("location", "")
    if "login_challenge" not in loc:
        raise RuntimeError(f"Expected login_challenge redirect, got {r.status_code}: {loc[:200]}")

    lc = urllib.parse.parse_qs(urllib.parse.urlparse(loc).query)["login_challenge"][0]

    r_idp = s.get(loc, allow_redirects=False)
    if r_idp.status_code in (301, 302, 303, 307, 308):
        s.get(r_idp.headers["location"], headers={"Accept": "text/html,*/*"}, allow_redirects=False)

    log("Logging in...")
    s.get(f"https://{TENANT}/uas/v1/initiate-login/{lc}", headers={"X-OAUTH-CHALLENGE": lc})
    r_login = s.post(
        f"https://{TENANT}/uas/v1/login",
        json={"userName": USERNAME, "password": enc_pw},
        headers={"X-OAUTH-CHALLENGE": lc},
    )
    login_data = r_login.json()
    if login_data.get("loginType") != "REDIRECT":
        raise RuntimeError(f"Login failed: {login_data.get('message')} (errorState={login_data.get('errorState')})")

    # Follow Hydra redirect chain to extract auth code
    code = callback_url = None
    cur = login_data["redirectUrl"]
    for _ in range(20):
        r = s.get(cur, allow_redirects=False)
        loc2 = r.headers.get("location", "")
        if "auth/callback" in loc2:
            code = urllib.parse.parse_qs(urllib.parse.urlparse(loc2).query).get("code", [""])[0]
            callback_url = loc2
            break
        if r.status_code not in (301, 302, 303, 307, 308) or not loc2:
            raise RuntimeError(f"Redirect chain broke: {r.status_code} {r.text[:100]}")
        cur = loc2

    if not code:
        raise RuntimeError("Failed to extract auth code from redirect chain")

    # Complete token exchange — sets access_token cookie on tenant
    log("Completing token exchange...")
    s.get(callback_url, headers={"Accept": "text/html,*/*"}, allow_redirects=True)
    tok = s.post(
        f"https://{TENANT}/uas/v1/initiate/token-request",
        json={},
        headers={"CODE": code, "PKCE-verifier": pkce_v},
    )
    tok_data = tok.json()
    log(f"Token exchange: domain={tok_data.get('domain')}, targetUrl={tok_data.get('targetUrl')}")

    # Navigate to v3/portal to establish Java session (JSESSIONID)
    log("Navigating to portal to establish session...")
    s.get(f"https://{TENANT}/v3/portal", headers={"Accept": "text/html,*/*"}, allow_redirects=True)

    access_token = next((c.value for c in s.cookies if c.name == "access_token"), None)
    if not access_token:
        raise RuntimeError("access_token cookie not set after auth")
    log(f"Session established. access_token: {access_token[:30]}...")


def get_attendance_status(s):
    """Return current sign-in status dict from /v3/api/attendance/swipes."""
    r = s.get(
        f"https://{TENANT}/v3/api/attendance/swipes",
        headers={"Accept": "application/json", "Referer": f"https://{TENANT}/v3/portal"},
    )
    if r.status_code == 200:
        swipes = r.json()
        if swipes:
            latest = swipes[0]
            log(f"Latest swipe: punchTime={latest.get('punchTime')} inOutIndicator={latest.get('inOutIndicator')}")
            return latest
    log(f"Could not get swipes: {r.status_code} {r.text[:100]}")
    return None


def mark_attendance(s, action):
    """
    action: 'Signin' or 'Signout'
    Returns response JSON on success, raises on failure.
    """
    r = s.post(
        f"https://{TENANT}/v3/api/attendance/mark-attendance?action={action}",
        json={"attLocation": None, "remarks": ""},
        headers={
            "Accept": "application/json, text/plain, */*",
            "Content-Type": "application/json",
            "Referer": f"https://{TENANT}/v3/portal",
            "Origin": f"https://{TENANT}",
        },
    )
    if r.status_code == 200:
        return r.json()
    raise RuntimeError(f"mark_attendance({action}) failed: {r.status_code} {r.text[:200]}")


def main():
    s = make_session()

    log("=== Authenticating ===")
    try:
        authenticate(s)
    except RuntimeError as e:
        log(f"AUTH FAILED: {e}")
        sys.exit(1)

    log("\n=== Checking current attendance status ===")
    get_attendance_status(s)

    log("\n=== Performing sign-out ===")
    try:
        result = mark_attendance(s, "Signout")
        log(f"Sign-out successful!")
        log(f"  firstInTime:  {result.get('firstInTime')}")
        log(f"  lastOutTime:  {result.get('lastOutTime')}")
        log(f"  workLocation: {result.get('attWorkLocation')}")
    except RuntimeError as e:
        log(f"Sign-out failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
