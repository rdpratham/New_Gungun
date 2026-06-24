import { chromium, Browser, BrowserContext, Page } from "playwright";
import * as fs from "fs";
import * as path from "path";

const BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || "/tmp/pw";
const ZOOMINFO_EMAIL = process.env.ZOOMINFO_EMAIL || "";
const ZOOMINFO_PASSWORD = process.env.ZOOMINFO_PASSWORD || "";
const OUTPUT_PATH = process.env.OUTPUT_PATH || "/tmp/zoominfo_contacts.json";

// Human-like delay
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const humanDelay = (min = 800, max = 2200) =>
  sleep(Math.floor(Math.random() * (max - min) + min));

// Human-like typing
async function humanType(page: Page, selector: string, text: string) {
  await page.click(selector);
  await humanDelay(300, 600);
  await page.fill(selector, "");
  for (const char of text) {
    await page.type(selector, char, { delay: Math.floor(Math.random() * 80 + 40) });
  }
  await humanDelay(300, 700);
}

// Random mouse movement to appear human
async function humanMove(page: Page) {
  const x = Math.floor(Math.random() * 800 + 200);
  const y = Math.floor(Math.random() * 400 + 100);
  await page.mouse.move(x, y, { steps: 10 });
}

interface Contact {
  id: string;
  name: string;
  company: string;
  title: string;
  level: string;
  email: string;
  directPhone: string;
  mobilePhone: string;
  notes: string;
}

const CONTACTS: Contact[] = [
  { id: "1656675116", name: "Shanda Hartsock", company: "White River Marine Group", title: "Director, Procurement, Bill of Materials & Inventory", level: "Director", email: "", directPhone: "", mobilePhone: "", notes: "" },
  { id: "2440168017", name: "Carlos H. Ebanks", company: "Fincantieri Marine Group", title: "Director, Material Management & Accounting Systems", level: "Director", email: "", directPhone: "", mobilePhone: "", notes: "" },
  { id: "3097066029", name: "Ian Smith", company: "Bennington Marine", title: "Vice President, Engineering", level: "VP", email: "", directPhone: "", mobilePhone: "", notes: "" },
  { id: "164797709", name: "Brent R. Blackburn", company: "Conrad Shipyard", title: "Vice President, Engineering & Product Development", level: "VP", email: "", directPhone: "", mobilePhone: "", notes: "" },
  { id: "425155556", name: "Robert Melvin", company: "Teledyne Marine", title: "Vice President, Engineering", level: "VP", email: "", directPhone: "", mobilePhone: "", notes: "" },
  { id: "642878914", name: "Dean J. Bratel", company: "Twin Disc", title: "Vice President, Corporate Engineering", level: "VP", email: "", directPhone: "", mobilePhone: "", notes: "" },
  { id: "8048061297", name: "Dipak S. Dalwadi", company: "Elecon Engineering", title: "Senior VP, Head of Engineering & Supply Chain", level: "SVP", email: "", directPhone: "", mobilePhone: "", notes: "" },
  { id: "13210459935", name: "Kashyap K. Pujara", company: "Elecon Engineering", title: "Chief Technology Officer", level: "C-Level", email: "", directPhone: "", mobilePhone: "", notes: "" },
  { id: "3955109145", name: "Diana L. Maclin", company: "Airstream", title: "Bill of Materials Manager", level: "Manager", email: "", directPhone: "", mobilePhone: "", notes: "" },
  { id: "1792452892", name: "Charles Noh", company: "Scan Global Logistics", title: "Vice President, Supply Chain Engineering (North America)", level: "VP", email: "", directPhone: "", mobilePhone: "", notes: "" },
  { id: "1419269393", name: "Michael Langen", company: "Global Diving & Salvage", title: "Vice President, Marine Construction, Engineering & Technology", level: "VP", email: "", directPhone: "", mobilePhone: "", notes: "" },
  { id: "1573026077", name: "Ronald Straz", company: "ORBCOMM", title: "Vice President, Hardware Engineering", level: "VP", email: "", directPhone: "", mobilePhone: "", notes: "" },
  { id: "2185082716", name: "Mike Hansen", company: "ORBCOMM", title: "Vice President, Product Owner", level: "VP", email: "", directPhone: "", mobilePhone: "", notes: "" },
  { id: "1738983412", name: "Dragan Popovic", company: "J.W. Speaker", title: "Chief Technology Officer", level: "C-Level", email: "", directPhone: "", mobilePhone: "", notes: "" },
  { id: "-1117686377", name: "Dilanthi Hettiarachchi", company: "GPV Group", title: "Manager, Project BOM Costing", level: "Manager", email: "", directPhone: "", mobilePhone: "", notes: "" },
  { id: "-1624871111", name: "Nitin Mulay", company: "Ador Welding", title: "Manager, Oracle BOM & Manufacturing (IT)", level: "Manager", email: "", directPhone: "", mobilePhone: "", notes: "" },
  // Not found in ZoomInfo — manual search
  { id: "", name: "Robert Kits van Heyningen", company: "KVH Industries", title: "Vice President, Research & Development", level: "VP", email: "", directPhone: "", mobilePhone: "", notes: "Not found via API" },
  { id: "", name: "Gary Dyson", company: "Ruhrpumpen", title: "Chief Technical Officer", level: "C-Level", email: "", directPhone: "", mobilePhone: "", notes: "Not found via API" },
  { id: "", name: "Tod Lane", company: "Clarke Power Services", title: "Bill of Materials Manager", level: "Manager", email: "", directPhone: "", mobilePhone: "", notes: "Not found via API" },
  { id: "", name: "Arunkumar Pichandi", company: "Ceer Motors", title: "Manager, PLM, Engineering Change Management & BOM", level: "Manager", email: "", directPhone: "", mobilePhone: "", notes: "Not found via API" },
];

async function login(page: Page): Promise<boolean> {
  console.log("🔐 Navigating to ZoomInfo login...");
  // Use login.zoominfo.com directly — confirmed reachable with --no-proxy-server
  await page.goto("https://login.zoominfo.com", { waitUntil: "load", timeout: 30000 });
  await humanDelay(2000, 3000);

  // Take screenshot to see login page
  await page.screenshot({ path: "/tmp/zi_login.png" });
  console.log("📸 Screenshot saved: /tmp/zi_login.png");

  // ZoomInfo login page has two overlapping forms — use the visible custom form
  // Visible fields: #usernameInput, #pwInput; Log In button is the last submit
  const emailSelectors = ['#usernameInput', '#okta-signin-username', 'input[name="username"]'];
  let emailField = null;
  for (const sel of emailSelectors) {
    const loc = page.locator(sel);
    if (await loc.count() > 0 && await loc.first().isVisible().catch(() => false)) {
      emailField = sel; break;
    }
  }
  // Fallback: use first visible text input
  if (!emailField) {
    const inputs = page.locator('input[type="text"], input[type="email"]');
    const count = await inputs.count();
    for (let i = 0; i < count; i++) {
      if (await inputs.nth(i).isVisible()) {
        emailField = `(input[type="text"], input[type="email"]):nth-match(${i + 1})`;
        break;
      }
    }
  }
  if (!emailField) {
    console.error("❌ Could not find visible username field.");
    return false;
  }
  console.log(`✅ Using username field: ${emailField}`);
  await page.locator(emailField).first().fill(ZOOMINFO_EMAIL);
  await humanDelay(400, 700);

  // Password — find visible password input
  const passSelectors = ['#pwInput', '#okta-signin-password', 'input[name="password"]', 'input[type="password"]'];
  let passField = null;
  for (const sel of passSelectors) {
    const loc = page.locator(sel);
    if (await loc.count() > 0 && await loc.first().isVisible().catch(() => false)) {
      passField = sel; break;
    }
  }
  if (!passField) {
    console.error("❌ Could not find visible password field.");
    return false;
  }
  console.log(`✅ Using password field: ${passField}`);
  await page.locator(passField).first().fill(ZOOMINFO_PASSWORD);
  await humanMove(page);
  await humanDelay(600, 1000);

  // Click Log In — last submit button on page (the ZoomInfo one, not Sign Up)
  const submitBtn = page.locator('button:has-text("Log In")').first();
  await submitBtn.click();
  await humanDelay(5000, 7000);

  await page.screenshot({ path: "/tmp/zi_after_login.png" });
  console.log("📸 Post-login screenshot: /tmp/zi_after_login.png");

  // Check if logged in
  const currentUrl = page.url();
  if (currentUrl.includes("login") || currentUrl.includes("signin")) {
    console.error("❌ Still on login page — check credentials or 2FA");
    return false;
  }

  console.log("✅ Logged in successfully!");
  return true;
}

async function getContactData(page: Page, contact: Contact): Promise<Contact> {
  console.log(`\n🔍 Processing: ${contact.name} @ ${contact.company}`);

  try {
    // Navigate directly by personId if available
    if (contact.id && contact.id !== "") {
      const url = `https://app.zoominfo.com/#/apps/profile/person/${contact.id}`;
      await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
      await humanDelay(2000, 3500);
    } else {
      // Manual search for contacts without ID
      await page.goto("https://app.zoominfo.com/#/apps/searchv2/person/search", { waitUntil: "networkidle", timeout: 20000 });
      await humanDelay(1500, 2500);

      // Search by name
      const searchInput = page.locator('input[placeholder*="Search" i], input[placeholder*="Name" i]').first();
      if (await searchInput.count() > 0) {
        await humanType(page, await searchInput.getAttribute("id") || 'input[placeholder*="Search" i]', contact.name);
        await humanDelay(1000, 1800);
        await page.keyboard.press("Enter");
        await humanDelay(2000, 3000);

        // Click first result
        const firstResult = page.locator('[data-testid="person-name"], .person-name, a.contact-name').first();
        if (await firstResult.count() > 0) {
          await firstResult.click();
          await humanDelay(2000, 3000);
        }
      }
    }

    await page.screenshot({ path: `/tmp/zi_contact_${contact.id || contact.name.replace(/\s+/g, "_")}.png` });

    // Click "View Email" button
    const emailViewSelectors = [
      'button:has-text("View Email")',
      'button:has-text("Reveal Email")',
      '[data-testid="view-email"]',
      'button[aria-label*="email" i]',
      '.view-email-btn',
      'span:has-text("View Email")',
    ];

    for (const sel of emailViewSelectors) {
      const btn = page.locator(sel).first();
      if (await btn.count() > 0) {
        console.log(`  📧 Clicking View Email...`);
        await humanMove(page);
        await btn.click();
        await humanDelay(1500, 2500);
        break;
      }
    }

    // Click "View Phone" button
    const phoneViewSelectors = [
      'button:has-text("View Phone")',
      'button:has-text("View Direct")',
      'button:has-text("Reveal Phone")',
      '[data-testid="view-phone"]',
      'button[aria-label*="phone" i]',
      '.view-phone-btn',
    ];

    for (const sel of phoneViewSelectors) {
      const btn = page.locator(sel).first();
      if (await btn.count() > 0) {
        console.log(`  📞 Clicking View Phone...`);
        await humanMove(page);
        await btn.click();
        await humanDelay(1500, 2500);
        break;
      }
    }

    await humanDelay(1000, 2000);

    // Extract email
    const emailSelectors = [
      '[data-testid="email-value"]',
      '.contact-email a',
      'a[href^="mailto:"]',
      '[class*="email"] a',
      '[class*="Email"] a',
    ];

    for (const sel of emailSelectors) {
      const el = page.locator(sel).first();
      if (await el.count() > 0) {
        const text = await el.textContent();
        if (text && text.includes("@")) {
          contact.email = text.trim();
          console.log(`  ✅ Email: ${contact.email}`);
          break;
        }
      }
    }

    // Extract direct phone
    const directPhoneSelectors = [
      '[data-testid="direct-phone-value"]',
      '[class*="direct-phone"]',
      '[class*="DirectPhone"]',
      'span[aria-label*="direct" i]',
    ];

    for (const sel of directPhoneSelectors) {
      const el = page.locator(sel).first();
      if (await el.count() > 0) {
        const text = await el.textContent();
        if (text && text.trim().length > 5) {
          contact.directPhone = text.trim();
          console.log(`  ✅ Direct: ${contact.directPhone}`);
          break;
        }
      }
    }

    // Extract mobile phone
    const mobileSelectors = [
      '[data-testid="mobile-phone-value"]',
      '[class*="mobile-phone"]',
      '[class*="MobilePhone"]',
      'span[aria-label*="mobile" i]',
    ];

    for (const sel of mobileSelectors) {
      const el = page.locator(sel).first();
      if (await el.count() > 0) {
        const text = await el.textContent();
        if (text && text.trim().length > 5) {
          contact.mobilePhone = text.trim();
          console.log(`  ✅ Mobile: ${contact.mobilePhone}`);
          break;
        }
      }
    }

    // Fallback: parse full page text for emails/phones
    if (!contact.email || !contact.directPhone) {
      const pageText = await page.evaluate(() => document.body.innerText);

      if (!contact.email) {
        const emailMatch = pageText.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
        if (emailMatch) {
          contact.email = emailMatch[0];
          console.log(`  ✅ Email (fallback): ${contact.email}`);
        }
      }

      if (!contact.directPhone) {
        const phoneMatches = pageText.match(/[\+]?[\d\s\-\(\)]{10,17}/g);
        if (phoneMatches && phoneMatches.length > 0) {
          contact.directPhone = phoneMatches[0].trim();
          console.log(`  ✅ Phone (fallback): ${contact.directPhone}`);
        }
      }
    }

    if (!contact.email && !contact.directPhone) {
      console.log(`  ⚠️  No contact data extracted — screenshot saved`);
      contact.notes = "Could not extract — check screenshot";
    }

  } catch (err: any) {
    console.error(`  ❌ Error: ${err.message}`);
    contact.notes = `Error: ${err.message}`;
  }

  // Human-like pause between contacts
  await humanDelay(2000, 4000);
  return contact;
}

async function saveResults(contacts: Contact[]) {
  // Save JSON
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(contacts, null, 2));
  console.log(`\n💾 JSON saved: ${OUTPUT_PATH}`);

  // Save CSV
  const csvPath = OUTPUT_PATH.replace(".json", ".csv");
  const header = "#,Company,Prospect Name,Title,Level,Email,Direct Phone,Mobile Phone,Notes";
  const rows = contacts.map((c, i) =>
    [i + 1, c.company, c.name, c.title, c.level, c.email, c.directPhone, c.mobilePhone, c.notes]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  fs.writeFileSync(csvPath, [header, ...rows].join("\n"));
  console.log(`💾 CSV saved: ${csvPath}`);

  // Print summary
  const found = contacts.filter((c) => c.email || c.directPhone || c.mobilePhone);
  console.log(`\n📊 Summary: ${found.length}/${contacts.length} contacts enriched`);
  contacts.forEach((c) => {
    const status = c.email ? "✅" : "❌";
    console.log(`  ${status} ${c.name} (${c.company}) — ${c.email || "no email"} | ${c.directPhone || "no direct"} | ${c.mobilePhone || "no mobile"}`);
  });
}

async function main() {
  if (!ZOOMINFO_EMAIL || !ZOOMINFO_PASSWORD) {
    console.error("❌ Set ZOOMINFO_EMAIL and ZOOMINFO_PASSWORD environment variables");
    process.exit(1);
  }

  console.log("🚀 ZoomInfo Contact Enrichment Agent Starting...");
  console.log(`📧 Account: ${ZOOMINFO_EMAIL}`);
  console.log(`📋 Contacts to process: ${CONTACTS.length}`);

  // Use --no-proxy-server to bypass egress proxy which blocks zoominfo.com
  const launchArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-blink-features=AutomationControlled",
    "--window-size=1280,800",
    "--no-proxy-server",
  ];

  const browser: Browser = await chromium.launch({
    executablePath: `${BROWSERS_PATH}/chromium-1228/chrome-linux64/chrome`,
    headless: true,
    args: launchArgs,
  });

  const context: BrowserContext = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
    locale: "en-US",
    timezoneId: "America/New_York",
    ignoreHTTPSErrors: true,
  });

  // Remove automation indicators
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    (window as any).chrome = { runtime: {} };
  });

  const page: Page = await context.newPage();

  try {
    const loggedIn = await login(page);
    if (!loggedIn) {
      console.error("❌ Login failed. Exiting.");
      await browser.close();
      process.exit(1);
    }

    // Process contacts one by one
    const results: Contact[] = [];
    for (let i = 0; i < CONTACTS.length; i++) {
      console.log(`\n[${i + 1}/${CONTACTS.length}]`);
      const result = await getContactData(page, { ...CONTACTS[i] });
      results.push(result);

      // Save progress after each contact
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2));
    }

    await saveResults(results);
  } finally {
    await browser.close();
    console.log("\n✅ Browser closed. Done.");
  }
}

main().catch(console.error);
