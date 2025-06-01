import { r } from "../utils";
import { Page } from "playwright";

export async function waitSecs(page: Page, r1: number = 50, r2: number = 300) {
  const secs = r(r1, r2);
  console.log(`Waiting ${secs} milliseconds...`);
  await page.waitForTimeout(secs);
}
