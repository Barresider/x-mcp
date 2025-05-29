import { r } from "../../utils";
import { Page } from "playwright";

export async function waitSecs(page: Page) {
  const secs = r(1000, 5000);
  console.log(`Waiting ${secs} milliseconds...`);
  await page.waitForTimeout(secs);
}
