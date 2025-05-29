/**
 * Behavior:
 * Goes to home
 * Clicks on Explore
 */

import { Page } from "playwright";
import { goHome } from "./go-home";
import { waitSecs } from "./wait-secs";

export async function goExplore(page: Page) {
  await goHome(page);

  console.log("Going to explore...");
  await page.click("//span[contains(text(), 'Explore')]");
  await waitSecs(page);
}
