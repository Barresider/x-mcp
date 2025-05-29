// https://www.tiktok.com/@gnublet/video/7195849224968244523

import "dotenv/config";

import { chromium, devices } from "playwright-extra";
import { Page } from "playwright";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

// Add stealth plugin to chromium
chromium.use(StealthPlugin());

async function doLogin(page: Page, user: string, password: string) {
  await page.goto("https://twitter.com/i/flow/login");

  // type username
  const userInput = '//input[@autocomplete="username"]';
  await page.fill(userInput, user);

  // click next
  await page.click("//span[contains(text(), 'Next')]");

  // type password
  const passwordInput = '//input[@autocomplete="current-password"]';
  await page.fill(passwordInput, password);

  // click login
  await page.click("//span[contains(text(), 'Log in')]");

  // wait for login
  await page.waitForURL("https://x.com/home");
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
  
  if (proxyUrl.includes('@')) {
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
    headless: process.env.NODE_ENV !== 'development',
    slowMo: 1000,
    ...(proxyConfig && { proxy: proxyConfig }),
  });
  const context = await browser.newContext({
    ...devices["Desktop Chrome"],
    locale: 'en-US',
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
    headless: process.env.NODE_ENV !== 'development',
    slowMo: 1000,
    ...(proxyConfig && { proxy: proxyConfig }),
  });
  
  let context;
  try {
    context = await browser.newContext({
      ...devices["Desktop Chrome"],
      storageState: authFile,
      locale: 'en-US',
    });
  } catch (error) {
    console.log("No auth file found, creating new context...");
    context = await browser.newContext({
      ...devices["Desktop Chrome"],
      locale: 'en-US',
    });
  }
  
  const page = await context.newPage();
  
  // Check if we're actually logged in by navigating to the home page
  await page.goto("https://x.com/home");
  
  if (page.url().includes("/i/flow/login") || page.url().includes("twitter.com/login")) {
    console.log("Not logged in, performing automatic login...");
    
    const user = process.env.TWITTER_USERNAME;
    const password = process.env.TWITTER_PASSWORD;
    if (!user || !password) {
      throw new Error(
        "You need to set the TWITTER_USERNAME and TWITTER_PASSWORD env variables"
      );
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
    throw new Error(
      "You need to set the TWITTER_USERNAME and TWITTER_PASSWORD env variables"
    );
  }

  const { page, close } = await getUnauthenticatedPage();

  console.log("Logging in...");
  await doLogin(page, user, password);

  console.log("Saving auth...");
  await page.context().storageState({ path: authFile });

  await close();

  console.log("Done!");
}
