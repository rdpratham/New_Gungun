# GreyHR Sign In/Out Agent

Playwright-based automation agent to sign in or sign out of GreyHR attendance.

## Setup

```bash
cd greythr-agent
npm install
```

## Configuration

Set credentials as environment variables (never hard-code them):

```bash
export GREYTHR_USERNAME=your_email@shorthills.ai
export GREYTHR_PASSWORD=your_password
```

## Usage

**Sign In (mark attendance start):**
```bash
GREYTHR_USERNAME=you@shorthills.ai GREYTHR_PASSWORD=secret npm run signin
# or
node agent.js signin
```

**Sign Out (mark attendance end):**
```bash
GREYTHR_USERNAME=you@shorthills.ai GREYTHR_PASSWORD=secret npm run signout
# or
node agent.js signout
```

## What it does

1. Launches a visible Chromium browser window
2. Navigates to https://shorthillstech.greythr.com/
3. Logs in with your credentials
4. Clicks the Sign In / Sign Out attendance button on the dashboard
5. Takes screenshots at each step — saved to `screenshots/` and `screenshot.png`

## Output

- `screenshot.png` — latest screenshot for quick check
- `screenshots/01-login-page.png` — login page loaded
- `screenshots/02-credentials-entered.png` — before submit
- `screenshots/03-after-login.png` — dashboard after login
- `screenshots/04-found-sign-in-button.png` or `04-found-sign-out-button.png`
- `screenshots/05-after-sign-in.png` or `05-after-sign-out.png`
- `screenshots/page-debug.html` — page HTML dump if button not found

## Troubleshooting

If the attendance button isn't found, open `screenshots/page-debug.html` in a browser
to inspect the actual DOM and update the selectors in `agent.js`.
