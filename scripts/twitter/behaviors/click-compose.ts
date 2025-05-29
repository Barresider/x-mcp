import { Page } from "playwright";

export async function clickCompose(page: Page) {
  console.log("Clicking compose...");
  // click tweet
  await page.click("a[href='/compose/post']");
}
