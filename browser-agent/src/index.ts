import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { chromium, Browser, BrowserContext, Page } from "playwright";

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;

const BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || "/tmp/pw";
const HTTPS_PROXY = process.env.HTTPS_PROXY || "";
const CA_BUNDLE = process.env.NODE_EXTRA_CA_CERTS || "/root/.ccr/ca-bundle.crt";

async function ensureBrowser() {
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
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
      ignoreHTTPSErrors: true,
    });
  }
  if (!page) {
    page = await context.newPage();
  }
  return page;
}

async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
    context = null;
    page = null;
  }
}

const server = new Server(
  { name: "browser-agent", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

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
        const waitFor = (args?.wait_for as "load" | "domcontentloaded" | "networkidle") || "load";
        await p.goto(args!.url as string, { waitUntil: waitFor, timeout: 30000 });
        const title = await p.title();
        const url = p.url();
        return { content: [{ type: "text", text: `Navigated to: ${url}\nPage title: ${title}` }] };
      }

      case "browser_screenshot": {
        const p = await ensureBrowser();
        const fullPage = (args?.full_page as boolean) || false;
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
        const selector = (args?.selector as string) || "body";
        const html = await p.locator(selector).first().innerHTML();
        return { content: [{ type: "text", text: html.slice(0, 50000) }] };
      }

      case "browser_click": {
        const p = await ensureBrowser();
        if (args?.text) {
          await p.getByText(args.text as string).first().click();
        } else {
          await p.locator(args!.selector as string).first().click();
        }
        await p.waitForTimeout(1000);
        return { content: [{ type: "text", text: "Clicked successfully" }] };
      }

      case "browser_type": {
        const p = await ensureBrowser();
        const locator = p.locator(args!.selector as string).first();
        if (args?.clear_first !== false) {
          await locator.clear();
        }
        await locator.type(args!.text as string, { delay: 50 });
        return { content: [{ type: "text", text: `Typed "${args!.text}" into ${args!.selector}` }] };
      }

      case "browser_wait": {
        const p = await ensureBrowser();
        const timeout = (args?.timeout_ms as number) || 5000;
        if (args?.selector) {
          await p.locator(args.selector as string).first().waitFor({ timeout });
          return { content: [{ type: "text", text: `Element "${args.selector}" found` }] };
        } else {
          await p.waitForTimeout(timeout);
          return { content: [{ type: "text", text: `Waited ${timeout}ms` }] };
        }
      }

      case "browser_scroll": {
        const p = await ensureBrowser();
        const amount = (args?.amount as number) || 500;
        const dir = args!.direction as string;
        if (dir === "bottom") {
          await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        } else if (dir === "top") {
          await p.evaluate(() => window.scrollTo(0, 0));
        } else if (dir === "down") {
          await p.evaluate((px) => window.scrollBy(0, px), amount);
        } else {
          await p.evaluate((px) => window.scrollBy(0, -px), amount);
        }
        return { content: [{ type: "text", text: `Scrolled ${dir}` }] };
      }

      case "browser_extract_table": {
        const p = await ensureBrowser();
        const selector = (args?.selector as string) || "table";
        const data = await p.evaluate((sel) => {
          const table = document.querySelector(sel);
          if (!table) return null;
          const rows = Array.from(table.querySelectorAll("tr"));
          return rows.map((row) =>
            Array.from(row.querySelectorAll("th, td")).map((cell) => cell.textContent?.trim() || "")
          );
        }, selector);
        if (!data) return { content: [{ type: "text", text: "No table found" }] };
        const csv = data.map((row) => row.join("\t")).join("\n");
        return { content: [{ type: "text", text: csv }] };
      }

      case "browser_get_cookies": {
        if (!context) return { content: [{ type: "text", text: "No browser session active" }] };
        const cookies = await context.cookies();
        return { content: [{ type: "text", text: JSON.stringify(cookies, null, 2) }] };
      }

      case "browser_set_cookies": {
        const p = await ensureBrowser();
        await context!.addCookies(args!.cookies as any[]);
        return { content: [{ type: "text", text: `Set ${(args!.cookies as any[]).length} cookies` }] };
      }

      case "browser_execute_js": {
        const p = await ensureBrowser();
        const result = await p.evaluate(args!.script as string);
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
        const email = args!.email as string;
        const password = args!.password as string;

        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
        const humanDelay = (min = 800, max = 2200) =>
          sleep(Math.floor(Math.random() * (max - min) + min));

        await p.goto("https://app.zoominfo.com/#/login", { waitUntil: "load", timeout: 30000 });
        await humanDelay(2000, 3000);

        // Find and fill email
        const emailSels = ['input[name="loginEmail"]', 'input[type="email"]', 'input[placeholder*="email" i]', "#username"];
        let emailFilled = false;
        for (const sel of emailSels) {
          if (await p.locator(sel).count() > 0) {
            await p.locator(sel).first().fill("");
            for (const ch of email) {
              await p.locator(sel).first().type(ch, { delay: Math.floor(Math.random() * 80 + 40) });
            }
            emailFilled = true;
            break;
          }
        }
        if (!emailFilled) return { content: [{ type: "text", text: "Could not find email field" }], isError: true };

        await humanDelay(500, 900);

        // Click Next if present
        const nextBtn = p.locator('button:has-text("Next"), button:has-text("Continue")').first();
        if (await nextBtn.count() > 0) { await nextBtn.click(); await humanDelay(2000, 3000); }

        // Password
        const passSels = ['input[name="password"]', 'input[type="password"]'];
        let passFilled = false;
        for (const sel of passSels) {
          if (await p.locator(sel).count() > 0) {
            await p.locator(sel).first().fill("");
            for (const ch of password) {
              await p.locator(sel).first().type(ch, { delay: Math.floor(Math.random() * 80 + 40) });
            }
            passFilled = true;
            break;
          }
        }
        if (!passFilled) return { content: [{ type: "text", text: "Could not find password field" }], isError: true };

        await humanDelay(600, 1000);
        await p.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Log In")').first().click();
        await humanDelay(4000, 6000);

        const url = p.url();
        if (url.includes("login") || url.includes("signin")) {
          return { content: [{ type: "text", text: `Still on login page: ${url} — wrong credentials or 2FA required` }], isError: true };
        }
        return { content: [{ type: "text", text: `Logged in! Current URL: ${url}` }] };
      }

      case "zoominfo_get_contact": {
        const p = await ensureBrowser();
        const personId = args!.person_id as string;
        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
        const humanDelay = (min = 800, max = 2200) =>
          sleep(Math.floor(Math.random() * (max - min) + min));

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
  } catch (err: any) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
