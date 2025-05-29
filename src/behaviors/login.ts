// https://www.tiktok.com/@gnublet/video/7195849224968244523

import "dotenv/config";

import { chromium, devices, Page } from "playwright";

async function logPageState(page: Page, context: string) {
  console.log(`\n========== PAGE STATE: ${context} ==========`);
  
  try {
    const url = page.url();
    const title = await page.title();
    console.log(`URL: ${url}`);
    console.log(`Title: ${title}`);
    
    // Log all visible buttons
    const buttons = await page.$$('button, [role="button"], input[type="submit"], input[type="button"]');
    console.log(`Found ${buttons.length} button elements`);
    
    for (const button of buttons) {
      if (await button.isVisible()) {
        const text = await button.innerText().catch(() => '');
        const value = await button.getAttribute('value').catch(() => '');
        const ariaLabel = await button.getAttribute('aria-label').catch(() => '');
        const dataTestId = await button.getAttribute('data-testid').catch(() => '');
        
        if (text || value || ariaLabel) {
          console.log(`  Visible button: text="${text}", value="${value}", aria-label="${ariaLabel}", data-testid="${dataTestId}"`);
        }
      }
    }
    
    // Log all visible input fields
    const inputs = await page.$$('input, textarea');
    console.log(`Found ${inputs.length} input elements`);
    
    for (const input of inputs) {
      if (await input.isVisible()) {
        const type = await input.getAttribute('type').catch(() => '');
        const name = await input.getAttribute('name').catch(() => '');
        const placeholder = await input.getAttribute('placeholder').catch(() => '');
        const autocomplete = await input.getAttribute('autocomplete').catch(() => '');
        const dataTestId = await input.getAttribute('data-testid').catch(() => '');
        const value = await input.inputValue().catch(() => '');
        
        console.log(`  Visible input: type="${type}", name="${name}", placeholder="${placeholder}", autocomplete="${autocomplete}", data-testid="${dataTestId}", value="${value ? '[has value]' : '[empty]'}"`);
      }
    }
    
    // Log any visible headers or labels
    const headers = await page.$$('h1, h2, h3, label');
    console.log(`Found ${headers.length} header/label elements`);
    
    for (const header of headers) {
      if (await header.isVisible()) {
        const text = await header.innerText().catch(() => '');
        const tagName = await header.evaluate(el => el.tagName.toLowerCase());
        if (text) {
          console.log(`  Visible ${tagName}: "${text}"`);
        }
      }
    }
    
    // Log any error or alert messages
    const alerts = await page.$$('[role="alert"], .error, .alert, .message');
    for (const alert of alerts) {
      if (await alert.isVisible()) {
        const text = await alert.innerText().catch(() => '');
        if (text) {
          console.log(`  Alert/Error: "${text}"`);
        }
      }
    }
    
  } catch (error) {
    console.log(`Error logging page state: ${error}`);
  }
  
  console.log(`========================================\n`);
}

async function logVisibleText(page: Page, context: string) {
  console.log(`\n---------- VISIBLE TEXT: ${context} ----------`);
  try {
    // Get all visible text from the page
    const visibleText = await page.evaluate(() => {
      const texts: string[] = [];
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            
            const style = window.getComputedStyle(parent);
            if (style.display === 'none' || style.visibility === 'hidden') {
              return NodeFilter.FILTER_REJECT;
            }
            
            const text = node.textContent?.trim();
            if (text && text.length > 0) {
              return NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_REJECT;
          }
        }
      );
      
      let node;
      while (node = walker.nextNode()) {
        const text = node.textContent?.trim();
        if (text && !texts.includes(text)) {
          texts.push(text);
        }
      }
      
      return texts;
    });
    
    console.log("Visible text elements:");
    visibleText.forEach(text => {
      if (text.length < 100) { // Only log reasonably sized text
        console.log(`  - "${text}"`);
      }
    });
    
  } catch (error) {
    console.log(`Error getting visible text: ${error}`);
  }
  console.log(`------------------------------------------\n`);
}

async function saveScreenshot(page: Page, name: string) {
  try {
    const screenshotPath = `playwright/screenshots/${name}-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved to: ${screenshotPath}`);
  } catch (error) {
    console.log("Failed to save screenshot:", error);
  }
}

async function doLogin(page: Page, user: string, password: string) {
  await page.goto("https://twitter.com/i/flow/login");

  // Wait for the page to load
  await page.waitForLoadState('networkidle');
  
  await logPageState(page, "Initial login page loaded");

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
    await logPageState(page, "Failed to fill username");
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
    await logPageState(page, "Failed to click next button");
    throw new Error("Failed to click Next button");
  }

  // Wait for password field or any intermediate steps
  await page.waitForTimeout(2000);
  
  await logPageState(page, "After clicking Next button");
  
  // Check for phone/email verification step
  const phoneVerificationSelectors = [
    'input[data-testid="ocfEnterTextTextInput"]',
    'input[name="text"]'
  ];
  
  // let hasPhoneVerification = false;
  for (const selector of phoneVerificationSelectors) {
    try {
      const phoneField = await page.$(selector);
      if (phoneField) {
        const isVisible = await phoneField.isVisible();
        if (isVisible) {
          // hasPhoneVerification = true;
          console.log("Phone/email verification step detected");
          
          await logPageState(page, "Phone/email verification screen");
          
          // Take screenshot for debugging
          await saveScreenshot(page, "phone-verification-detected");
          
          // Fill phone/email if available in env
          const phoneOrEmail = process.env.TWITTER_PHONE || process.env.TWITTER_EMAIL || user;
          console.log(`Filling verification field with: ${phoneOrEmail.substring(0, 3)}...`);
          
          await page.fill(selector, phoneOrEmail);
          await page.waitForTimeout(1000);
          
          // Click next again - try multiple methods
          let verificationNextClicked = false;
          
          // First try clicking any visible "Next" button
          for (const nextSelector of nextButtonSelectors) {
            try {
              const nextButton = await page.$(nextSelector);
              if (nextButton && await nextButton.isVisible()) {
                await page.click(nextSelector, { timeout: 5000 });
                verificationNextClicked = true;
                console.log("Clicked Next after phone/email verification");
                break;
              }
            } catch (error) {
              // Continue trying other selectors
            }
          }
          
          // If no Next button, try pressing Enter
          if (!verificationNextClicked) {
            console.log("No Next button found, trying Enter key");
            await page.keyboard.press('Enter');
          }
          
          // Wait for the next screen to load
          await page.waitForTimeout(3000);
          
          await logPageState(page, "After phone/email verification");
          
          await saveScreenshot(page, "after-phone-verification");
          
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
  
  await logPageState(page, "Before password entry");
  
  // Check if we're still on a verification screen
  const currentUrl = page.url();
  console.log(`Current URL before password: ${currentUrl}`);
  
  // Check for any error messages or captcha
  try {
    const errorMessage = await page.$('div[role="alert"]');
    if (errorMessage && await errorMessage.isVisible()) {
      const errorText = await errorMessage.innerText();
      console.log(`Alert message found: ${errorText}`);
      await logPageState(page, "Alert/Error message present");
      await saveScreenshot(page, "error-or-alert-message");
    }
  } catch (e) {
    // No error message
  }
  
  // Check if we need to handle "Unusual activity" or other security screens
  try {
    const securityHeaders = [
      "text=Verify it's you",
      "text=Help us keep your account safe",
      "text=There was unusual login activity",
      "text=Suspicious activity"
    ];
    
    for (const header of securityHeaders) {
      const securityElement = await page.$(header);
      if (securityElement && await securityElement.isVisible()) {
        console.log("Security verification screen detected");
        await logPageState(page, "Security verification required");
        await saveScreenshot(page, "security-verification");
        
        // Look for "Send email" or similar button
        const sendButtons = [
          "button:has-text('Send email')",
          "button:has-text('Send code')",
          "button:has-text('Get code')",
          "button:has-text('Continue')"
        ];
        
        for (const button of sendButtons) {
          try {
            await page.click(button, { timeout: 3000 });
            console.log(`Clicked security button: ${button}`);
            await page.waitForTimeout(3000);
            break;
          } catch (e) {
            // Try next button
          }
        }
        break;
      }
    }
  } catch (e) {
    // No security screen
  }

  let passwordFilled = false;
  
  // First, let's check if there's ANY input field visible that might be the password field
  try {
    const allInputs = await page.$$('input');
    console.log(`Found ${allInputs.length} input fields on page`);
    
    // Also check for any text that might indicate what we should do
    await logVisibleText(page, "Looking for password field");
    
    for (const input of allInputs) {
      if (await input.isVisible()) {
        const type = await input.getAttribute('type');
        const placeholder = await input.getAttribute('placeholder');
        const name = await input.getAttribute('name');
        const autocomplete = await input.getAttribute('autocomplete');
        
        console.log(`Visible input: type=${type}, placeholder=${placeholder}, name=${name}, autocomplete=${autocomplete}`);
        
        // Check if this might be a password field
        if (type === 'password' || 
            placeholder?.toLowerCase().includes('password') ||
            name?.toLowerCase().includes('password') ||
            autocomplete?.includes('password')) {
          
          console.log("Found potential password field, attempting to fill");
          await input.click();
          await page.keyboard.press('Control+A');
          await page.keyboard.press('Delete');
          await input.type(password, { delay: 100 });
          passwordFilled = true;
          console.log("Password filled using dynamic field detection");
          break;
        }
      }
    }
  } catch (e) {
    console.log("Error checking all inputs:", e);
  }
  
  // If still not filled, try the standard selectors
  if (!passwordFilled) {
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
  }

  if (!passwordFilled) {
    // Check for iframes that might contain the password field
    try {
      const iframes = await page.$$('iframe');
      console.log(`Found ${iframes.length} iframes on page`);
      
      for (let i = 0; i < iframes.length; i++) {
        const frame = await iframes[i].contentFrame();
        if (frame) {
          console.log(`Checking iframe ${i}...`);
          
          // Try to find password fields in the iframe
          const iframeInputs = await frame.$$('input[type="password"], input[autocomplete="current-password"]');
          for (const input of iframeInputs) {
            if (await input.isVisible()) {
              console.log("Found password field in iframe!");
              await input.click();
              await input.fill(password);
              passwordFilled = true;
              break;
            }
          }
          
          if (passwordFilled) break;
        }
      }
    } catch (error) {
      console.log("Error checking iframes:", error);
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
    await logPageState(page, "Unable to find password field");
    await logVisibleText(page, "No password field found");
    
    // Take a screenshot to see what's on screen
    await saveScreenshot(page, "password-field-not-found");
    
    // Log current page state
    const pageTitle = await page.title();
    const pageUrl = page.url();
    console.log(`Page title: ${pageTitle}`);
    console.log(`Page URL: ${pageUrl}`);
    
    // Try to log any visible text on the page
    try {
      const bodyText = await page.$eval('body', el => el.innerText);
      console.log(`Page text preview: ${bodyText.substring(0, 500)}...`);
    } catch (e) {
      console.log("Could not get page text");
    }
    
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
