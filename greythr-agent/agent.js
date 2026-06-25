const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const GREYTHR_URL = 'https://shorthillstech.greythr.com/';
const USERNAME = process.env.GREYTHR_USERNAME || 'YOUR_USERNAME_HERE';
const PASSWORD = process.env.GREYTHR_PASSWORD || 'YOUR_PASSWORD_HERE';

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

async function takeScreenshot(page, name) {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  // Also save as screenshot.png for quick access
  await page.screenshot({ path: path.join(__dirname, 'screenshot.png'), fullPage: true });
  console.log(`Screenshot saved: ${filePath}`);
}

async function login(page) {
  console.log(`Navigating to ${GREYTHR_URL}...`);
  await page.goto(GREYTHR_URL, { waitUntil: 'networkidle' });
  await takeScreenshot(page, '01-login-page');

  console.log('Filling login credentials...');

  // Try multiple selectors for username field
  const usernameSelectors = [
    'input[name="username"]',
    'input[type="email"]',
    'input[placeholder*="username" i]',
    'input[placeholder*="email" i]',
    'input[id*="username" i]',
    'input[id*="email" i]',
  ];

  let usernameFilled = false;
  for (const sel of usernameSelectors) {
    try {
      await page.waitForSelector(sel, { timeout: 3000 });
      await page.fill(sel, USERNAME);
      console.log(`Username entered using selector: ${sel}`);
      usernameFilled = true;
      break;
    } catch (_) {}
  }

  if (!usernameFilled) {
    throw new Error('Could not find username input field');
  }

  // Try multiple selectors for password field
  const passwordSelectors = [
    'input[name="password"]',
    'input[type="password"]',
    'input[placeholder*="password" i]',
    'input[id*="password" i]',
  ];

  let passwordFilled = false;
  for (const sel of passwordSelectors) {
    try {
      await page.waitForSelector(sel, { timeout: 3000 });
      await page.fill(sel, PASSWORD);
      console.log(`Password entered using selector: ${sel}`);
      passwordFilled = true;
      break;
    } catch (_) {}
  }

  if (!passwordFilled) {
    throw new Error('Could not find password input field');
  }

  await takeScreenshot(page, '02-credentials-entered');

  // Click login button
  const loginSelectors = [
    'button[type="submit"]',
    'button:has-text("Login")',
    'button:has-text("Sign In")',
    'button:has-text("Log In")',
    'input[type="submit"]',
    '[class*="login"] button',
    '[class*="submit"] button',
  ];

  let loginClicked = false;
  for (const sel of loginSelectors) {
    try {
      await page.waitForSelector(sel, { timeout: 3000 });
      await page.click(sel);
      console.log(`Login button clicked using selector: ${sel}`);
      loginClicked = true;
      break;
    } catch (_) {}
  }

  if (!loginClicked) {
    throw new Error('Could not find login button');
  }

  // Wait for navigation after login
  await page.waitForLoadState('networkidle');
  await takeScreenshot(page, '03-after-login');
  console.log('Login successful! Dashboard loaded.');
}

async function clickAttendanceButton(page, action) {
  // action: 'Sign In' or 'Sign Out'
  console.log(`Looking for "${action}" attendance button...`);

  await page.waitForLoadState('networkidle');

  // Try various selectors for attendance buttons
  const selectors = [
    `button:has-text("${action}")`,
    `a:has-text("${action}")`,
    `[class*="attendance"] button:has-text("${action}")`,
    `[class*="punch"] button:has-text("${action}")`,
    `span:has-text("${action}")`,
    `div:has-text("${action}")`,
  ];

  // Also try case variations
  const lowerAction = action.toLowerCase();
  selectors.push(
    `button:has-text("${lowerAction}")`,
    `[data-action*="${lowerAction}"]`,
    `[aria-label*="${action}" i]`,
  );

  let buttonClicked = false;
  for (const sel of selectors) {
    try {
      const el = await page.waitForSelector(sel, { timeout: 3000 });
      if (el) {
        await el.scrollIntoViewIfNeeded();
        await takeScreenshot(page, `04-found-${lowerAction.replace(' ', '-')}-button`);
        await el.click();
        console.log(`"${action}" button clicked using selector: ${sel}`);
        buttonClicked = true;
        break;
      }
    } catch (_) {}
  }

  if (!buttonClicked) {
    // Dump page content for debugging
    const content = await page.content();
    const debugPath = path.join(SCREENSHOT_DIR, 'page-debug.html');
    fs.writeFileSync(debugPath, content);
    console.log(`Page HTML saved for debugging: ${debugPath}`);
    await takeScreenshot(page, '04-button-not-found');
    throw new Error(`Could not find "${action}" attendance button. Check screenshot and page-debug.html.`);
  }

  // Wait for confirmation
  await page.waitForLoadState('networkidle');
  await takeScreenshot(page, `05-after-${lowerAction.replace(' ', '-')}`);
}

async function run(action) {
  if (!['signin', 'signout'].includes(action)) {
    console.error('Usage: node agent.js <signin|signout>');
    process.exit(1);
  }

  if (USERNAME === 'YOUR_USERNAME_HERE' || PASSWORD === 'YOUR_PASSWORD_HERE') {
    console.error('ERROR: Please set GREYTHR_USERNAME and GREYTHR_PASSWORD environment variables.');
    console.error('  export GREYTHR_USERNAME=your_email@shorthills.ai');
    console.error('  export GREYTHR_PASSWORD=your_password');
    process.exit(1);
  }

  const browser = await chromium.launch({
    headless: false,
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  try {
    await login(page);

    const attendanceAction = action === 'signin' ? 'Sign In' : 'Sign Out';
    await clickAttendanceButton(page, attendanceAction);

    console.log(`\n✅ ${attendanceAction} completed successfully!`);
    console.log(`Screenshot saved to: ${path.join(__dirname, 'screenshot.png')}`);
  } catch (err) {
    console.error(`\n❌ Error: ${err.message}`);
    await takeScreenshot(page, 'error-state');
    await browser.close();
    process.exit(1);
  }

  await browser.close();
}

const action = process.argv[2];
run(action).catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
