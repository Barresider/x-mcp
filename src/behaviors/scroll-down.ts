/**
 * Behavior:
 * Scrolls and waits a random number of times
 */

import { r } from "../utils";
import { Page } from "playwright";

export async function scrollDown(page: Page) {
  // simulate scrolling
  const times = r(2, 5);
  for (let i = 0; i < times; i++) {
    await page.mouse.wheel(0, r(100, 500));
    await page.waitForTimeout(r(1000, 2500));
  }
}
