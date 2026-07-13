#!/usr/bin/env python3
"""
GreyHR Attendance Sign-Out Automation
Performs sign-out for employee 110612 at shorthillstech.greythr.com
"""

import base64, hashlib, json, secrets, sys, time, urllib.parse
import requests
from Crypto.PublicKey import RSA
from Crypto.Cipher import PKCS1_OAEP
from Crypto.Hash import SHA256

# Configuration
PROXY = "http://127.0.0.1:32839"
CA    = "/root/.ccr/ca-bundle.crt"
TENANT   = "shorthillstech.greythr.com"
IDP      = "idp-coral.greythr.com"
HYDRA    = "goth-coral.greythr.com"
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

def log(msg): print(f"[greythr] {msg}", flush=True)

def encrypt_password(password):
    key = RSA.import_key(PEM)
    cipher = PKCS1_OAEP.new(key, hashAlgo=SHA256)
    return base64.b64encode(cipher.encrypt(password.encode())).decode()

def make_session():
    s = requests.Session()
    s.proxies = {"http": PROXY, "https": PROXY}
    s.verify = CA
    s.headers.update({
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
    })
    return s

def authenticate(s):
    """Full OAuth flow: returns (code, pkce_verifier, callback_url)."""
    enc_pw = encrypt_password(PASSWORD)

    # Pre-load IDP portal to get any session initialization
    log("Loading IDP portal...")
    s.get(f"https://{IDP}/uas/portal/", headers={"Accept": "text/html,*/*"})

    # Session config
    log("Fetching session config...")
    cfg = s.get(f"https://{TENANT}/uas/v1/session-config").json()
    redirect_uri = cfg["oAuthRedirectUrl"]   # https://idp-coral.greythr.com/uas/portal/auth/callback
    hydra_url    = cfg["hydraFrontendServer"] # https://goth-coral.greythr.com/
    access_id    = cfg["accessId"]

    # PKCE
    pkce_v = base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b"=").decode()
    pkce_c = base64.urlsafe_b64encode(hashlib.sha256(pkce_v.encode()).digest()).rstrip(b"=").decode()
    hint   = base64.b64encode(json.dumps({"host": TENANT}, separators=(",", ":")).encode()).decode()
    state  = secrets.token_urlsafe(32)
    nonce  = secrets.token_urlsafe(16)

    # OAuth2 auth → Hydra → IDP login redirect
    log("Starting OAuth flow...")
    oauth_url = (
        f"{hydra_url}oauth2/auth"
        f"?client_id=greythr-coral"
        f"&redirect_uri={urllib.parse.quote(redirect_uri)}"
        f"&response_type=code"
        f"&scope=openid+offline"
        f"&state={state}"
        f"&nonce={nonce}"
        f"&code_challenge={pkce_c}"
        f"&code_challenge_method=S256"
        f"&login_hint={urllib.parse.quote(hint)}"
        f"&access_id={urllib.parse.quote(access_id)}"
    )

    r = s.get(oauth_url, allow_redirects=False)
    loc = r.headers.get("location", "")
    if "login_challenge" not in loc:
        raise RuntimeError(f"Expected login_challenge redirect, got: {r.status_code} {loc[:200]}")

    lc = urllib.parse.parse_qs(urllib.parse.urlparse(loc).query)["login_challenge"][0]
    log(f"Got login_challenge ({len(lc)} chars)")

    # IDP redirects to tenant login page — we follow it to register the challenge
    r_idp = s.get(loc, allow_redirects=False)
    if r_idp.status_code in (301, 302, 303, 307, 308):
        tenant_login_url = r_idp.headers.get("location", "")
        s.get(tenant_login_url, headers={"Accept": "text/html,*/*"}, allow_redirects=False)

    # Tenant: initiate-login
    log("Initiating login challenge on tenant...")
    s.get(f"https://{TENANT}/uas/v1/initiate-login/{lc}",
          headers={"X-OAUTH-CHALLENGE": lc, "Accept": "application/json"})

    # Tenant: login with encrypted credentials
    log(f"Logging in as {USERNAME}...")
    r_login = s.post(
        f"https://{TENANT}/uas/v1/login",
        json={"userName": USERNAME, "password": enc_pw},
        headers={"X-OAUTH-CHALLENGE": lc},
    )
    login_data = r_login.json()
    if login_data.get("loginType") != "REDIRECT":
        raise RuntimeError(f"Login failed: {login_data.get('message')} / errorState={login_data.get('errorState')}")

    redirect_url = login_data["redirectUrl"]
    log("Login successful, following Hydra redirect chain...")

    # Follow redirect chain to extract auth code
    code = callback_url = None
    cur = redirect_url
    for _ in range(20):
        r = s.get(cur, allow_redirects=False)
        loc2 = r.headers.get("location", "")
        if "auth/callback" in loc2:
            code = urllib.parse.parse_qs(urllib.parse.urlparse(loc2).query).get("code", [""])[0]
            callback_url = loc2
            break
        if r.status_code not in (301, 302, 303, 307, 308) or not loc2:
            raise RuntimeError(f"Chain broke: {r.status_code} body={r.text[:200]}")
        cur = loc2

    if not code:
        raise RuntimeError("Failed to extract auth code")

    log(f"Got auth code: {code[:30]}...")
    return code, pkce_v, callback_url, redirect_uri, hydra_url

def exchange_token_via_idp(s, code, pkce_v, callback_url):
    """Exchange auth code via IDP's token-request endpoint."""
    # Visit callback URL to initialize IDP's SPA context
    log("Visiting IDP callback URL...")
    s.get(callback_url, headers={"Accept": "text/html,*/*"}, allow_redirects=True)

    log("Calling IDP token-request endpoint...")
    r = s.post(
        f"https://{IDP}/uas/v1/initiate/token-request",
        json={},
        headers={
            "CODE": code,
            "PKCE-verifier": pkce_v,
            "Accept": "application/json, text/plain, */*",
            "Origin": f"https://{IDP}",
            "Referer": callback_url,
            "X-Requested-With": "XMLHttpRequest",
        },
    )
    ct = r.headers.get("content-type", "")
    if "json" in ct:
        return r.json()
    if r.text and r.text[0] == "{":
        return r.json()
    return None  # returned HTML — IDP session not established

def exchange_token_via_tenant(s, code, pkce_v):
    """Exchange auth code via tenant's token-request endpoint."""
    log("Calling tenant token-request endpoint...")
    r = s.post(
        f"https://{TENANT}/uas/v1/initiate/token-request",
        json={},
        headers={
            "CODE": code,
            "PKCE-verifier": pkce_v,
            "Accept": "application/json, text/plain, */*",
        },
    )
    try:
        return r.json()
    except Exception:
        return None

def exchange_token_via_hydra(s, code, pkce_v, redirect_uri, hydra_url):
    """Try direct Hydra token exchange (PKCE public client attempt)."""
    log("Attempting direct Hydra token exchange...")
    r = requests.post(
        f"{hydra_url}oauth2/token",
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "client_id": "greythr-coral",
            "code_verifier": pkce_v,
        },
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "Origin": f"https://{IDP}",
        },
        proxies={"http": PROXY, "https": PROXY},
        verify=CA,
    )
    try:
        data = r.json()
        if r.status_code == 200 and "access_token" in data:
            return data["access_token"]
        log(f"Hydra direct failed: {r.status_code} {data.get('error_description','')[:100]}")
    except Exception:
        pass
    return None

def setup_tenant_session(s, access_token):
    """Use access_token to create tenant session via known endpoints."""
    log("Setting up tenant session with access_token...")
    headers = {"ACCESS-TOKEN": access_token, "Accept": "application/json"}

    for endpoint in ["/uas/v1/initiate/callback", "/uas/v1/session-cookie"]:
        r = s.post(f"https://{TENANT}{endpoint}", json={}, headers=headers)
        log(f"  {endpoint}: {r.status_code} {r.text[:100]}")

    # Test if we have a valid session
    r = s.get(f"https://{TENANT}/api/v2/employee/me")
    if r.status_code == 200:
        log(f"Session established! Employee: {r.json().get('name','?')}")
        return True
    return False

def get_attendance_status(s):
    """Get current attendance status."""
    endpoints = [
        "/api/v2/attendance/me",
        "/api/attendance/todayattendance",
        "/api/v2/attendance/todayattendance",
    ]
    for ep in endpoints:
        r = s.get(f"https://{TENANT}{ep}")
        if r.status_code == 200:
            log(f"Attendance status ({ep}): {r.text[:200]}")
            return r.json()
    return None

def do_sign_out(s):
    """Perform attendance sign-out."""
    from datetime import datetime
    now = datetime.now()
    swipe_time = now.strftime("%H:%M:%S")
    swipe_date = now.strftime("%Y-%m-%d")

    swipe_payloads = [
        {"swipeType": "OUT", "swipeDate": swipe_date, "swipeTime": swipe_time, "swipeMode": "MANUAL"},
        {"type": "OUT", "date": swipe_date, "time": swipe_time},
        {"signInOut": "OUT"},
        {"action": "signout"},
    ]
    endpoints = [
        "/api/v2/attendance/swipes",
        "/api/attendance/swipes",
        "/api/v2/attendance/sign",
        "/api/attendance/signin-signout",
    ]

    for ep in endpoints:
        for payload in swipe_payloads:
            r = s.post(f"https://{TENANT}{ep}", json=payload,
                       headers={"Accept": "application/json", "Content-Type": "application/json"})
            log(f"  POST {ep}: {r.status_code} {r.text[:150]}")
            if r.status_code in (200, 201):
                try:
                    data = r.json()
                    if data.get("success") or data.get("status") == "success" or "swipe" in str(data).lower():
                        log(f"SIGN-OUT SUCCESSFUL via {ep}")
                        return True
                except Exception:
                    pass

    return False

def main():
    s = make_session()

    # Step 1: Authenticate and get auth code
    try:
        code, pkce_v, callback_url, redirect_uri, hydra_url = authenticate(s)
    except RuntimeError as e:
        log(f"AUTH FAILED: {e}")
        sys.exit(1)

    # Step 2: Token exchange — try multiple strategies
    access_token = None

    # Strategy A: IDP token-request
    tok_data = exchange_token_via_idp(s, code, pkce_v, callback_url)
    log(f"IDP token-request result: {tok_data}")
    if tok_data:
        access_token = tok_data.get("accessToken") or tok_data.get("access_token")
        if not access_token and tok_data.get("targetUrl"):
            # Follow the targetUrl to get tenant session
            log(f"Following targetUrl: {tok_data['targetUrl'][:100]}")
            r = s.get(tok_data["targetUrl"], allow_redirects=True)
            log(f"  targetUrl result: {r.status_code}, url={r.url[:100]}")

    # Strategy B: Tenant token-request (known to work)
    session_established = False
    tok_data2 = exchange_token_via_tenant(s, code, pkce_v)
    log(f"Tenant token-request result: {tok_data2}")
    if tok_data2 and tok_data2.get("domain") == TENANT:
        log("Tenant session established via token-request!")
        session_established = True
        access_token = tok_data2.get("accessToken") or tok_data2.get("access_token")
        if tok_data2.get("targetUrl"):
            target = tok_data2["targetUrl"]
            if not target.startswith("http"):
                target = f"https://{TENANT}/{target.lstrip('/')}"
            log(f"Following tenant targetUrl: {target}")
            r_nav = s.get(target, allow_redirects=True, headers={"Accept": "text/html,*/*"})
            log(f"  Nav result: {r_nav.status_code}")
        log(f"Session cookies: {[(c.domain, c.name) for c in s.cookies]}")

    if not session_established and not access_token:
        log("Tenant token-request failed, trying Hydra direct exchange...")
        try:
            access_token = exchange_token_via_hydra(s, code, pkce_v, redirect_uri, hydra_url)
        except Exception as e:
            log(f"Hydra exchange error: {e}")

    if access_token and not session_established:
        log(f"Got access_token: {access_token[:40]}...")
        setup_tenant_session(s, access_token)

    # Step 3: Check attendance status
    log("\nChecking attendance status...")
    status = get_attendance_status(s)
    if not status:
        log("Could not get attendance status — checking auth...")
        r_me = s.get(f"https://{TENANT}/api/v2/employee/me")
        log(f"Employee API: {r_me.status_code} {r_me.text[:200]}")
        # Try with access_token in header if we have it
        if access_token:
            r_me2 = s.get(f"https://{TENANT}/api/v2/employee/me",
                          headers={"Authorization": f"Bearer {access_token}"})
            log(f"Employee API (Bearer): {r_me2.status_code} {r_me2.text[:200]}")

    # Step 4: Sign out
    log("\nPerforming sign-out...")
    success = do_sign_out(s)
    if success:
        log("Sign-out completed successfully!")
    else:
        log("Sign-out attempt done — probing APIs for debugging...")
        for ep in ["/api/v2/attendance/me", "/api/attendance/todayattendance",
                   "/api/v2/attendance", "/uas/v1/attendance"]:
            r = s.get(f"https://{TENANT}{ep}")
            log(f"  GET {ep}: {r.status_code} {r.text[:150]}")

if __name__ == "__main__":
    main()
