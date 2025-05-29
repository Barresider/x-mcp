/**
 * Behavior:
 * Goes to home
 */

import { Page } from "playwright";

export async function goHome(page: Page) {
  console.log("Going home...");

  // open twitter
  await page.goto("https://x.com/home");

  // click away the cookie banner
  try {
    await page.click(
      "//span[contains(text(), 'Refuse non-essential cookies')]",
      {
        timeout: 2000,
      }
    );
  } catch (e) {
    // ignore if not found
  }
}
