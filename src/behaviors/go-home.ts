/**
 * Behavior:
 * Goes to home
 */

import { Page } from "playwright";

export async function goHome(page: Page) {
  console.log("Going home...");

  if (!page.url().includes("x.com/home")) {
    await page.goto("https://x.com/home");
  }

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
