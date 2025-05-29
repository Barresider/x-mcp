// https://www.tiktok.com/@gnublet/video/7195849224968244523

import "dotenv/config";

import { chromium, devices, Page } from "playwright";

async function doLogin(page: Page, user: string, password: string) {
  await page.goto("https://twitter.com/i/flow/login");

  // Wait for the page to load
  await page.waitForLoadState('networkidle');

  // Username input with retry logic
  const usernameSelectors = [
    '//input[@autocomplete="username"]',
    'input[autocomplete="username"]',
    'input[name="text"]',
    'input[type="text"]'
  ];

  let userInputFilled = false;
  for (const selector of usernameSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 10000 });
      await page.fill(selector, user);
      userInputFilled = true;
      console.log(`Username filled using selector: ${selector}`);
      break;
    } catch (error) {
      console.log(`Failed to fill username with selector ${selector}`);
    }
  }

  if (!userInputFilled) {
    throw new Error("Failed to fill username field");
  }

  // Add a small delay to mimic human behavior
  await page.waitForTimeout(1000);

  // Click next button with multiple selectors
  const nextButtonSelectors = [
    "//span[contains(text(), 'Next')]",
    "button:has-text('Next')",
    "[role='button']:has-text('Next')",
    "div[role='button'] span:text('Next')"
  ];

  let nextClicked = false;
  for (const selector of nextButtonSelectors) {
    try {
      await page.click(selector, { timeout: 5000 });
      nextClicked = true;
      console.log(`Next button clicked using selector: ${selector}`);
      break;
    } catch (error) {
      console.log(`Failed to click next with selector ${selector}`);
    }
  }

  if (!nextClicked) {
    throw new Error("Failed to click Next button");
  }

  // Wait for password field or any intermediate steps
  await page.waitForTimeout(2000);
  
  // Check for phone/email verification step
  const phoneVerificationSelectors = [
    'input[data-testid="ocfEnterTextTextInput"]',
    'input[name="text"]'
  ];
  
  let hasPhoneVerification = false;
  for (const selector of phoneVerificationSelectors) {
    try {
      const phoneField = await page.$(selector);
      if (phoneField) {
        const isVisible = await phoneField.isVisible();
        if (isVisible) {
          hasPhoneVerification = true;
          console.log("Phone/email verification step detected");
          
          // Fill phone/email if available in env
          const phoneOrEmail = process.env.TWITTER_PHONE || process.env.TWITTER_EMAIL || user;
          await page.fill(selector, phoneOrEmail);
          await page.waitForTimeout(1000);
          
          // Click next again
          for (const nextSelector of nextButtonSelectors) {
            try {
              await page.click(nextSelector, { timeout: 5000 });
              break;
            } catch (error) {
              // Continue trying other selectors
            }
          }
          break;
        }
      }
    } catch (error) {
      // Continue checking other selectors
    }
  }

  // Wait for password field with multiple strategies
  const passwordSelectors = [
    '//input[@autocomplete="current-password"]',
    'input[autocomplete="current-password"]',
    'input[type="password"]',
    'input[name="password"]',
    '[data-testid="LoginForm_password_field"]'
  ];

  // Wait a bit more to ensure password field is ready
  await page.waitForTimeout(2000);

  let passwordFilled = false;
  for (const selector of passwordSelectors) {
    try {
      // Wait for the selector to be visible and stable
      await page.waitForSelector(selector, { 
        timeout: 10000,
        state: 'visible'
      });
      
      // Clear field first in case there's any pre-filled content
      await page.click(selector);
      await page.keyboard.press('Control+A');
      await page.keyboard.press('Delete');
      
      // Type password slowly to mimic human behavior
      await page.type(selector, password, { delay: 100 });
      
      passwordFilled = true;
      console.log(`Password filled using selector: ${selector}`);
      break;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`Failed to fill password with selector ${selector}: ${errorMessage}`);
    }
  }

  if (!passwordFilled) {
    // Last resort: try to find any visible password field
    try {
      const passwordFields = await page.$$('input[type="password"]');
      for (const field of passwordFields) {
        if (await field.isVisible()) {
          await field.click();
          await field.fill(password);
          passwordFilled = true;
          console.log("Password filled using visible password field search");
          break;
        }
      }
    } catch (error) {
      console.log("Failed to fill password using fallback method");
    }
  }

  if (!passwordFilled) {
    throw new Error("Failed to fill password field");
  }

  // Add delay before clicking login
  await page.waitForTimeout(1000);

  // Click login button with multiple selectors
  const loginButtonSelectors = [
    "//span[contains(text(), 'Log in')]",
    "button:has-text('Log in')",
    "[role='button']:has-text('Log in')",
    "[data-testid='LoginForm_Login_Button']",
    "div[role='button'] span:text('Log in')"
  ];

  let loginClicked = false;
  for (const selector of loginButtonSelectors) {
    try {
      await page.click(selector, { timeout: 5000 });
      loginClicked = true;
      console.log(`Login button clicked using selector: ${selector}`);
      break;
    } catch (error) {
      console.log(`Failed to click login with selector ${selector}`);
    }
  }

  if (!loginClicked) {
    throw new Error("Failed to click Log in button");
  }

  // wait for login with longer timeout
  try {
    await page.waitForURL("https://x.com/home", { timeout: 30000 });
  } catch (error) {
    // Check if we're on the home page with a different URL pattern
    const currentUrl = page.url();
    if (!currentUrl.includes('/home') && !currentUrl.includes('x.com')) {
      throw new Error(`Login failed. Current URL: ${currentUrl}`);
    }
  }
}

const authFile = "playwright/.auth/twitter.json";
export async function getUnauthenticatedPage() {
  const browser = await chromium.launch({
    timeout: 60000,
    headless: process.env.NODE_ENV !== 'development',
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
    headless: process.env.NODE_ENV !== 'development',
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
