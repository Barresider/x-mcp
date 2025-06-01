import { r } from "../utils";
import { Page } from "playwright";

export async function waitSecs(page: Page) {
  const secs = r(250, 1250);
  console.log(`Waiting ${secs} milliseconds...`);
  await page.waitForTimeout(secs);
}
