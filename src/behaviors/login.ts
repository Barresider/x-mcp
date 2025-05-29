// https://www.tiktok.com/@gnublet/video/7195849224968244523

import "dotenv/config";

import { chromium, devices, Page } from "playwright";

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
export async function getUnauthenticatedPage() {
  const browser = await chromium.launch({
    timeout: 60000,
    headless: false,
    slowMo: 1000,
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
  const browser = await chromium.launch({
    timeout: 60000,
    headless: false,
    slowMo: 1000,
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
