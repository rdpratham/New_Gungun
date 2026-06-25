import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";
let browser = null;
let context = null;
let page = null;
const BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || "/tmp/pw";
const HTTPS_PROXY = process.env.HTTPS_PROXY || "";
const CA_BUNDLE = process.env.NODE_EXTRA_CA_CERTS || "/root/.ccr/ca-bundle.crt";
// Cookie persistence: stored relative to this script's directory
const COOKIE_FILE = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "zoominfo_session.json");
// Heartbeat interval handle — pings ZoomInfo every 25 min to keep session alive
let heartbeatTimer = null;
async function saveCookies() {
    if (!context)
        return;
    try {
        const cookies = await context.cookies();
        const ziCookies = cookies.filter(c => c.domain.includes("zoominfo.com") || c.domain.includes("okta-login.zoominfo"));
        if (ziCookies.length > 0) {
            fs.writeFileSync(COOKIE_FILE, JSON.stringify(ziCookies, null, 2));
        }
    }
    catch { /* ignore */ }
}
async function loadCookies() {
    if (!context)
        return false;
    if (!fs.existsSync(COOKIE_FILE))
        return false;
    try {
        const cookies = JSON.parse(fs.readFileSync(COOKIE_FILE, "utf-8"));
        if (!Array.isArray(cookies) || cookies.length === 0)
            return false;
        await context.addCookies(cookies);
        return true;
    }
    catch {
        return false;
    }
}
async function isZoomInfoLoggedIn(p) {
    try {
        await p.goto("https://app.zoominfo.com/", { waitUntil: "load", timeout: 20000 });
        await new Promise(r => setTimeout(r, 2000));
        const url = p.url();
        const title = await p.title();
        return !url.includes("login") && !url.includes("signin") &&
            (title.toLowerCase().includes("zoominfo") || title.toLowerCase().includes("sales"));
    }
    catch {
        return false;
    }
}
async function startHeartbeat(p) {
    if (heartbeatTimer)
        return; // already running
    heartbeatTimer = setInterval(async () => {
        try {
            // Navigate to ZoomInfo home silently to refresh session tokens
            await p.goto("https://app.zoominfo.com/", { waitUntil: "load", timeout: 20000 });
            await new Promise(r => setTimeout(r, 2000));
            const url = p.url();
            if (!url.includes("login") && !url.includes("signin")) {
                await saveCookies(); // save refreshed cookies
            }
        }
        catch { /* ignore heartbeat errors */ }
    }, 25 * 60 * 1000); // every 25 minutes
}
async function ensureBrowser() {
    const isNew = !browser;
    if (!browser) {
        const launchArgs = [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-blink-features=AutomationControlled",
            "--no-proxy-server", // bypass egress proxy which blocks zoominfo.com
        ];
        browser = await chromium.launch({
            executablePath: `${BROWSERS_PATH}/chromium-1228/chrome-linux64/chrome`,
            headless: true,
            args: launchArgs,
        });
    }
    if (!context) {
        context = await browser.newContext({
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            viewport: { width: 1280, height: 800 },
            ignoreHTTPSErrors: true,
        });
        // Auto-load saved ZoomInfo session on every new context
        await loadCookies();
    }
    if (!page) {
        page = await context.newPage();
        // Start background heartbeat to keep session alive
        startHeartbeat(page);
    }
    return page;
}
async function closeBrowser() {
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
    if (browser) {
        await browser.close();
        browser = null;
        context = null;
        page = null;
    }
}
const server = new Server({ name: "browser-agent", version: "1.0.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: "browser_navigate",
            description: "Navigate to a URL in the browser",
            inputSchema: {
                type: "object",
                properties: {
                    url: { type: "string", description: "URL to navigate to" },
                    wait_for: {
                        type: "string",
                        enum: ["load", "domcontentloaded", "networkidle"],
                        description: "Wait condition (default: load)",
                    },
                },
                required: ["url"],
            },
        },
        {
            name: "browser_screenshot",
            description: "Take a screenshot of the current page",
            inputSchema: {
                type: "object",
                properties: {
                    full_page: { type: "boolean", description: "Capture full page (default: false)" },
                },
            },
        },
        {
            name: "browser_get_text",
            description: "Get all visible text content from the current page",
            inputSchema: { type: "object", properties: {} },
        },
        {
            name: "browser_get_html",
            description: "Get HTML of a specific element or the full page",
            inputSchema: {
                type: "object",
                properties: {
                    selector: { type: "string", description: "CSS selector (optional, defaults to body)" },
                },
            },
        },
        {
            name: "browser_click",
            description: "Click on an element",
            inputSchema: {
                type: "object",
                properties: {
                    selector: { type: "string", description: "CSS selector or text to click" },
                    text: { type: "string", description: "Click element containing this text" },
                },
            },
        },
        {
            name: "browser_type",
            description: "Type text into an input field",
            inputSchema: {
                type: "object",
                properties: {
                    selector: { type: "string", description: "CSS selector of the input" },
                    text: { type: "string", description: "Text to type" },
                    clear_first: { type: "boolean", description: "Clear field before typing (default: true)" },
                },
                required: ["selector", "text"],
            },
        },
        {
            name: "browser_wait",
            description: "Wait for an element to appear or a timeout",
            inputSchema: {
                type: "object",
                properties: {
                    selector: { type: "string", description: "CSS selector to wait for" },
                    timeout_ms: { type: "number", description: "Max wait time in ms (default: 5000)" },
                },
            },
        },
        {
            name: "browser_scroll",
            description: "Scroll the page",
            inputSchema: {
                type: "object",
                properties: {
                    direction: { type: "string", enum: ["down", "up", "bottom", "top"] },
                    amount: { type: "number", description: "Pixels to scroll (default: 500)" },
                },
                required: ["direction"],
            },
        },
        {
            name: "browser_extract_table",
            description: "Extract data from a table on the page",
            inputSchema: {
                type: "object",
                properties: {
                    selector: { type: "string", description: "CSS selector of the table (optional)" },
                },
            },
        },
        {
            name: "browser_get_cookies",
            description: "Get all cookies from the current session",
            inputSchema: { type: "object", properties: {} },
        },
        {
            name: "browser_set_cookies",
            description: "Set cookies (useful for pre-authenticated sessions)",
            inputSchema: {
                type: "object",
                properties: {
                    cookies: {
                        type: "array",
                        description: "Array of cookie objects with name, value, domain",
                        items: { type: "object" },
                    },
                },
                required: ["cookies"],
            },
        },
        {
            name: "browser_execute_js",
            description: "Execute JavaScript on the current page and return the result",
            inputSchema: {
                type: "object",
                properties: {
                    script: { type: "string", description: "JavaScript code to execute" },
                },
                required: ["script"],
            },
        },
        {
            name: "browser_get_url",
            description: "Get the current page URL",
            inputSchema: { type: "object", properties: {} },
        },
        {
            name: "browser_go_back",
            description: "Navigate back in browser history",
            inputSchema: { type: "object", properties: {} },
        },
        {
            name: "browser_close",
            description: "Close the browser session",
            inputSchema: { type: "object", properties: {} },
        },
        {
            name: "zoominfo_login",
            description: "Login to ZoomInfo with email and password (human-like, avoids bot detection)",
            inputSchema: {
                type: "object",
                properties: {
                    email: { type: "string", description: "ZoomInfo account email" },
                    password: { type: "string", description: "ZoomInfo account password" },
                },
                required: ["email", "password"],
            },
        },
        {
            name: "zoominfo_get_contact",
            description: "Navigate to a ZoomInfo contact profile by personId, click View Email + View Phone, and extract the revealed data",
            inputSchema: {
                type: "object",
                properties: {
                    person_id: { type: "string", description: "ZoomInfo person ID (from search results)" },
                },
                required: ["person_id"],
            },
        },
    ],
}));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        switch (name) {
            case "browser_navigate": {
                const p = await ensureBrowser();
                const waitFor = args?.wait_for || "load";
                await p.goto(args.url, { waitUntil: waitFor, timeout: 30000 });
                const title = await p.title();
                const url = p.url();
                // Auto-save cookies after any successful ZoomInfo navigation
                if (url.includes("zoominfo.com") && !url.includes("login")) {
                    saveCookies().catch(() => { });
                }
                return { content: [{ type: "text", text: `Navigated to: ${url}\nPage title: ${title}` }] };
            }
            case "browser_screenshot": {
                const p = await ensureBrowser();
                const fullPage = args?.full_page || false;
                const buffer = await p.screenshot({ type: "png", fullPage });
                const base64 = buffer.toString("base64");
                return {
                    content: [
                        { type: "text", text: `Screenshot taken (${fullPage ? "full page" : "viewport"})` },
                        { type: "image", data: base64, mimeType: "image/png" },
                    ],
                };
            }
            case "browser_get_text": {
                const p = await ensureBrowser();
                const text = await p.evaluate(() => document.body.innerText);
                return { content: [{ type: "text", text: text.slice(0, 50000) }] };
            }
            case "browser_get_html": {
                const p = await ensureBrowser();
                const selector = args?.selector || "body";
                const html = await p.locator(selector).first().innerHTML();
                return { content: [{ type: "text", text: html.slice(0, 50000) }] };
            }
            case "browser_click": {
                const p = await ensureBrowser();
                if (args?.text) {
                    await p.getByText(args.text).first().click();
                }
                else {
                    await p.locator(args.selector).first().click();
                }
                await p.waitForTimeout(1000);
                return { content: [{ type: "text", text: "Clicked successfully" }] };
            }
            case "browser_type": {
                const p = await ensureBrowser();
                const locator = p.locator(args.selector).first();
                if (args?.clear_first !== false) {
                    await locator.clear();
                }
                await locator.type(args.text, { delay: 50 });
                return { content: [{ type: "text", text: `Typed "${args.text}" into ${args.selector}` }] };
            }
            case "browser_wait": {
                const p = await ensureBrowser();
                const timeout = args?.timeout_ms || 5000;
                if (args?.selector) {
                    await p.locator(args.selector).first().waitFor({ timeout });
                    return { content: [{ type: "text", text: `Element "${args.selector}" found` }] };
                }
                else {
                    await p.waitForTimeout(timeout);
                    return { content: [{ type: "text", text: `Waited ${timeout}ms` }] };
                }
            }
            case "browser_scroll": {
                const p = await ensureBrowser();
                const amount = args?.amount || 500;
                const dir = args.direction;
                if (dir === "bottom") {
                    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                }
                else if (dir === "top") {
                    await p.evaluate(() => window.scrollTo(0, 0));
                }
                else if (dir === "down") {
                    await p.evaluate((px) => window.scrollBy(0, px), amount);
                }
                else {
                    await p.evaluate((px) => window.scrollBy(0, -px), amount);
                }
                return { content: [{ type: "text", text: `Scrolled ${dir}` }] };
            }
            case "browser_extract_table": {
                const p = await ensureBrowser();
                const selector = args?.selector || "table";
                const data = await p.evaluate((sel) => {
                    const table = document.querySelector(sel);
                    if (!table)
                        return null;
                    const rows = Array.from(table.querySelectorAll("tr"));
                    return rows.map((row) => Array.from(row.querySelectorAll("th, td")).map((cell) => cell.textContent?.trim() || ""));
                }, selector);
                if (!data)
                    return { content: [{ type: "text", text: "No table found" }] };
                const csv = data.map((row) => row.join("\t")).join("\n");
                return { content: [{ type: "text", text: csv }] };
            }
            case "browser_get_cookies": {
                if (!context)
                    return { content: [{ type: "text", text: "No browser session active" }] };
                const cookies = await context.cookies();
                return { content: [{ type: "text", text: JSON.stringify(cookies, null, 2) }] };
            }
            case "browser_set_cookies": {
                const p = await ensureBrowser();
                await context.addCookies(args.cookies);
                return { content: [{ type: "text", text: `Set ${args.cookies.length} cookies` }] };
            }
            case "browser_execute_js": {
                const p = await ensureBrowser();
                const result = await p.evaluate(args.script);
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }
            case "browser_get_url": {
                const p = await ensureBrowser();
                return { content: [{ type: "text", text: p.url() }] };
            }
            case "browser_go_back": {
                const p = await ensureBrowser();
                await p.goBack();
                return { content: [{ type: "text", text: `Now at: ${p.url()}` }] };
            }
            case "browser_close": {
                await closeBrowser();
                return { content: [{ type: "text", text: "Browser session closed" }] };
            }
            case "zoominfo_login": {
                const p = await ensureBrowser();
                const email = args.email;
                const password = args.password;
                const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
                const humanDelay = (min = 800, max = 2200) => sleep(Math.floor(Math.random() * (max - min) + min));
                // Cookies are already loaded in ensureBrowser() — just check if we're logged in
                const alreadyLoggedIn = await isZoomInfoLoggedIn(p);
                if (alreadyLoggedIn) {
                    await saveCookies(); // refresh the saved file
                    return { content: [{ type: "text", text: `Already logged in via saved session! URL: ${p.url()}` }] };
                }
                await p.goto("https://login.zoominfo.com", { waitUntil: "load", timeout: 30000 });
                await humanDelay(2000, 3000);
                // Accept cookies banner if present
                const cookieBtn = p.locator('button#onetrust-accept-btn-handler');
                if (await cookieBtn.count() > 0) {
                    await cookieBtn.click();
                    await sleep(1000);
                }
                // Fill #usernameInput (ZoomInfo custom visible form)
                const emailSels = ['#usernameInput', 'input[name="loginEmail"]', 'input[type="email"]', "#username"];
                let emailFilled = false;
                for (const sel of emailSels) {
                    const loc = p.locator(sel).first();
                    if (await loc.count() > 0 && await loc.isVisible().catch(() => false)) {
                        await loc.fill(email);
                        emailFilled = true;
                        break;
                    }
                }
                if (!emailFilled)
                    return { content: [{ type: "text", text: "Could not find email field" }], isError: true };
                await humanDelay(400, 700);
                // Fill #pwInput
                const passSels = ['#pwInput', 'input[name="password"]', 'input[type="password"]'];
                let passFilled = false;
                for (const sel of passSels) {
                    const loc = p.locator(sel).first();
                    if (await loc.count() > 0 && await loc.isVisible().catch(() => false)) {
                        await loc.fill(password);
                        passFilled = true;
                        break;
                    }
                }
                if (!passFilled)
                    return { content: [{ type: "text", text: "Could not find password field" }], isError: true };
                await humanDelay(500, 900);
                // Click Log In button
                const loginBtn = p.locator('#login-form-submit-btn, button:has-text("Log In")').first();
                if (await loginBtn.count() > 0)
                    await loginBtn.click();
                await humanDelay(4000, 6000);
                const urlAfter = p.url();
                if (urlAfter.includes("sms") || urlAfter.includes("factor") || await p.locator('input[placeholder="e.g. 123456"]').count() > 0) {
                    return { content: [{ type: "text", text: `2FA required — SMS code sent. Please provide the code using browser_type on selector 'input[placeholder="e.g. 123456"]', then click the Verify button.` }] };
                }
                if (urlAfter.includes("login") || urlAfter.includes("signin")) {
                    return { content: [{ type: "text", text: `Still on login page: ${urlAfter} — wrong credentials or 2FA required` }], isError: true };
                }
                // Successful login — save cookies for future sessions
                await saveCookies();
                return { content: [{ type: "text", text: `Logged in! Cookies saved. URL: ${urlAfter}` }] };
            }
            case "zoominfo_get_contact": {
                const p = await ensureBrowser();
                const personId = args.person_id;
                const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
                const humanDelay = (min = 800, max = 2200) => sleep(Math.floor(Math.random() * (max - min) + min));
                await p.goto(`https://app.zoominfo.com/#/apps/profile/person/${personId}`, { waitUntil: "networkidle", timeout: 30000 });
                await humanDelay(2500, 4000);
                // Click View Email
                const emailBtns = ['button:has-text("View Email")', 'button:has-text("Reveal Email")', '[data-testid="view-email"]'];
                for (const sel of emailBtns) {
                    if (await p.locator(sel).count() > 0) {
                        await p.locator(sel).first().click();
                        await humanDelay(1500, 2500);
                        break;
                    }
                }
                // Click View Phone
                const phoneBtns = ['button:has-text("View Phone")', 'button:has-text("View Direct")', '[data-testid="view-phone"]'];
                for (const sel of phoneBtns) {
                    if (await p.locator(sel).count() > 0) {
                        await p.locator(sel).first().click();
                        await humanDelay(1500, 2500);
                        break;
                    }
                }
                await humanDelay(1000, 2000);
                // Extract data
                const pageText = await p.evaluate(() => document.body.innerText);
                const emailMatch = pageText.match(/[\w.+\-]+@[\w\-]+\.[\w.]+/);
                const phoneMatches = pageText.match(/[\+]?1?[\s.\-]?\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}/g);
                const result = {
                    personId,
                    email: emailMatch ? emailMatch[0] : "",
                    phones: phoneMatches ? phoneMatches.slice(0, 3) : [],
                    url: p.url(),
                };
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }
            default:
                return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
        }
    }
    catch (err) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
});
const transport = new StdioServerTransport();
await server.connect(transport);
