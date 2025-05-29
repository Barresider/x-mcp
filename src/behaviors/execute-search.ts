import { Page } from "playwright-core";
import { waitSecs } from "./wait-secs";

export async function executeSearch(page: Page, query: string) {
  console.log("Searching for", query);
  const searchInput = page.locator("input[aria-label='Search query']");

  await searchInput.waitFor();
  await waitSecs(page);

  await searchInput.click();
  await searchInput.fill(query);
  await page.waitForTimeout(250);
  await searchInput.press("Enter");
}
