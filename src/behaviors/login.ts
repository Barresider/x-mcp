// https://www.tiktok.com/@gnublet/video/7195849224968244523

import "dotenv/config";

import { chromium, devices } from "playwright-extra";
import { Page } from "playwright";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";
// import fetch from "node-fetch"; // Not needed in Node.js v18+

// Add stealth plugin to chromium
chromium.use(StealthPlugin());

async function doLogin(page: Page, user: string, password: string) {
  await page.goto("https://twitter.com/i/flow/login");

  const userInput = '//input[@autocomplete="username"]';
  await page.fill(userInput, user);

  await page.click("//span[contains(text(), 'Next')]");

  await page.waitForTimeout(2000);

  // Check for email/phone verification step
  const phoneOrEmailPromptSelector = '//span[contains(text(), "Enter your phone number or email address")]';
  const verificationInputSelector = '//input[@data-testid="ocfEnterTextTextInput"]';

  const isPhoneOrEmailPromptVisible = await page
    .locator(phoneOrEmailPromptSelector)
    .isVisible()
    .catch(() => false);
  const isVerificationInputVisible = await page
    .locator(verificationInputSelector)
    .isVisible()
    .catch(() => false);

  if (isPhoneOrEmailPromptVisible || isVerificationInputVisible) {
    const twitterEmail = process.env.TWITTER_EMAIL;
    const twitterPhone = process.env.TWITTER_PHONE;

    if (twitterEmail) {
      console.log("Email/phone verification prompted. Attempting with TWITTER_EMAIL.");
      await page.fill(verificationInputSelector, twitterEmail);
      await page.click("//span[contains(text(), 'Next')]");
      await page.waitForTimeout(2000); // Wait for password page or further verification
    } else if (twitterPhone) {
      console.log("Email/phone verification prompted. Attempting with TWITTER_PHONE.");
      await page.fill(verificationInputSelector, twitterPhone);
      await page.click("//span[contains(text(), 'Next')]");
      await page.waitForTimeout(2000); // Wait for password page or further verification
    } else {
      throw new Error(
        "Email or phone verification required by Twitter, but neither TWITTER_EMAIL nor TWITTER_PHONE environment variables are set."
      );
    }
  }

  const passwordInput = '//input[@autocomplete="current-password"]';
  const passwordFieldExists = await page
    .locator(passwordInput)
    .isVisible()
    .catch(() => false);

  // Take screenshot here
  await page.screenshot({ path: "debug_screenshot.png" });
  await postFileToWebhook("debug_screenshot.png", "https://n8n.fabiankl.de/webhook/debug");

  if (!passwordFieldExists) {
    // If password field is not found, check for common reasons
    const stillOnEmailPhoneVerification = await page
      .locator(verificationInputSelector) // Check if still on the same verification input
      .isVisible()
      .catch(() => false);
    const confirmIdentityPromptVisible = await page
      .locator('//span[contains(text(), "Confirm your identity")]')
      .isVisible()
      .catch(() => false);

    if (stillOnEmailPhoneVerification) {
      throw new Error(
        "Failed to proceed past email/phone verification. The provided TWITTER_EMAIL/TWITTER_PHONE might be incorrect, or further verification is needed."
      );
    } else if (confirmIdentityPromptVisible) {
      throw new Error(
        "Twitter requires additional identity confirmation that cannot be automated (e.g., 'Confirm your identity' prompt). Please login manually."
      );
    } else {
      throw new Error(
        "Password field not found, and no recognized verification step is active. The login flow may have changed or an unexpected verification is required."
      );
    }
  }

  await page.fill(passwordInput, password);

  await page.click("//span[contains(text(), 'Log in')]");

  try {
    await Promise.race([
      page.waitForURL("https://x.com/home", { timeout: 10000 }),
      page.waitForSelector('//span[contains(text(), "Wrong password")]', { timeout: 5000 }),
      page.waitForSelector('//span[contains(text(), "Incorrect")]', { timeout: 5000 }),
      page.waitForSelector('//div[@role="alert"]', { timeout: 5000 }),
    ]);
  } catch (error) {
    // Check if we're still on login page (indicates error)
    if (page.url().includes("/i/flow/login") || page.url().includes("twitter.com/login")) {
      const wrongPasswordError = await page
        .locator('//span[contains(text(), "Wrong password")]')
        .isVisible()
        .catch(() => false);
      const incorrectError = await page
        .locator('//span[contains(text(), "Incorrect")]')
        .isVisible()
        .catch(() => false);
      const alertError = await page
        .locator('//div[@role="alert"]')
        .isVisible()
        .catch(() => false);

      if (wrongPasswordError || incorrectError) {
        throw new Error("Wrong password. Please check your credentials and try again.");
      } else if (alertError) {
        const alertText = await page
          .locator('//div[@role="alert"]')
          .textContent()
          .catch(() => "");
        throw new Error(`Login failed: ${alertText || "Unknown error occurred"}`);
      } else {
        throw new Error("Login failed. Unable to navigate to home page after login attempt.");
      }
    }
  }

  // Final check to ensure we're logged in
  if (!page.url().includes("x.com/home")) {
    throw new Error("Login failed. Did not reach the home page after login.");
  }
}

const authFile = "playwright/.auth/twitter.json";

function getProxyConfig() {
  const proxyUrl = process.env.PROXY_URL;
  if (!proxyUrl) {
    return undefined;
  }

  const proxyConfig = {
    server: proxyUrl,
    username: process.env.PROXY_USERNAME,
    password: process.env.PROXY_PASSWORD,
  };

  if (proxyUrl.includes("@")) {
    const match = proxyUrl.match(/^(https?:\/\/)(?:([^:]+):([^@]+)@)?(.+)$/);
    if (match) {
      proxyConfig.server = match[1] + match[4];
      proxyConfig.username = proxyConfig.username || match[2];
      proxyConfig.password = proxyConfig.password || match[3];
    }
  }

  console.log("Using proxy config:", proxyConfig);
  return {
    server: proxyConfig.server,
    ...(proxyConfig.username && { username: proxyConfig.username }),
    ...(proxyConfig.password && { password: proxyConfig.password }),
  };
}

export async function getUnauthenticatedPage() {
  const proxyConfig = getProxyConfig();

  const browser = await chromium.launch({
    timeout: 60000,
    headless: false,
    slowMo: 1000,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1280,1024',
    ],
    ...(proxyConfig && { proxy: proxyConfig }),
  });
  const context = await browser.newContext({
    ...devices["Desktop Chrome"],
    locale: "en-US",
  });
  const page = await context.newPage();

  return {
    page,
    close: async () => {
      await page.close();
      await context.close();
      await browser.close();
    },
  };
}

export async function getAuthenticatedPage() {
  const proxyConfig = getProxyConfig();

  const browser = await chromium.launch({
    timeout: 60000,
    headless: false,
    slowMo: 1000,
    ...(proxyConfig && { proxy: proxyConfig }),
  });

  let context;
  try {
    context = await browser.newContext({
      ...devices["Desktop Chrome"],
      storageState: authFile,
      locale: "en-US",
    });
  } catch (error) {
    console.log("No auth file found, creating new context...");
    context = await browser.newContext({
      ...devices["Desktop Chrome"],
      locale: "en-US",
    });
  }

  await context.addInitScript(
    "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
  );

  const page = await context.newPage();

  // Check if we're actually logged in by navigating to the home page
  await page.goto("https://x.com/home");

  if (page.url().includes("/i/flow/login") || page.url().includes("twitter.com/login")) {
    console.log("Not logged in, performing automatic login...");

    const user = process.env.TWITTER_USERNAME;
    const password = process.env.TWITTER_PASSWORD;
    if (!user || !password) {
      throw new Error("You need to set the TWITTER_USERNAME and TWITTER_PASSWORD env variables");
    }

    await doLogin(page, user, password);

    console.log("Saving new auth state...");
    await saveState(page);
  }

  return {
    page,
    close: async () => {
      await page.close();
      await context.close();
      await browser.close();
    },
  };
}

export async function saveState(page: Page) {
  return page.context().storageState({ path: authFile });
}

export async function login() {
  const user = process.env.TWITTER_USERNAME;
  const password = process.env.TWITTER_PASSWORD;
  if (!user || !password) {
    throw new Error("You need to set the TWITTER_USERNAME and TWITTER_PASSWORD env variables");
  }

  const { page, close } = await getUnauthenticatedPage();

  console.log("Logging in...");
  await doLogin(page, user, password);

  console.log("Saving auth...");
  await page.context().storageState({ path: authFile });

  await close();

  console.log("Done!");
}

async function postFileToWebhook(filePath: string, webhookUrl: string) {
  const fileBuffer = fs.readFileSync(filePath);
  // Use global fetch (Node.js v18+)
  console.log("Posting file to webhook...");
  await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename=\"${filePath}\"`,
    },
    body: fileBuffer,
  });
}
