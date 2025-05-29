/**
 * Behavior:
 * Goes to home
 * Scrolls a random number of times
 * Clicks on a random tweet with a "Show more" button
 * Goes to the profile of the user who posted the tweet
 * Goes to the following of that user
 * Follows a random number of users by clicking on the follow button
 */
import { Page, ElementHandle } from "playwright";
import { goHome } from "./behaviors/go-home";
import { r } from "../utils";
import { scrollDown } from "./behaviors/scroll-down";
import { getAuthenticatedPage, saveState } from "./login";
import { waitSecs } from "./behaviors/wait-secs";

async function doFollowFromFollowing(page: Page) {
  console.log("Following from following...");

  await goHome(page);

  let showMore: ElementHandle | null = null;
  while (!showMore) {
    await scrollDown(page);
    console.log('Looking for a "Show more" button...');
    showMore = await page.$("span:has-text('Show more')");
  }

  console.log('Clicking on a "Show more" button...');
  await waitSecs(page);
  await showMore.click();
  await page.waitForSelector("span:has-text('Post')");

  await waitSecs(page);
  const tweetUrl = page.url(); // https://x.com/ThorHartvigsen/status/1783396463579472126
  const username = tweetUrl.split("/")[3];
  console.log(`Going to the profile of ${username}...`);
  await page.goto(`https://x.com/${username}`);

  // go to the following
  await waitSecs(page);
  console.log("Going to the following...");
  await page.click("a[href*='/following']");

  // follow a random number of users
  console.log("Following users...");
  let accountsToFollow = r(5, 15);
  const followButtons = await page
    .locator("//span[contains(text(), 'Follow')]")
    .all();
  for (let i = r(0, 2); i < accountsToFollow; i += 2) {
    await followButtons[i].click();
    await waitSecs(page);
  }

  console.log("Done following users!");
}

export async function followFromFollowing() {
  const { page, close } = await getAuthenticatedPage();
  await doFollowFromFollowing(page);
  await goHome(page);
  await scrollDown(page);
  await saveState(page);
  await close();
  console.log("Done!");
}
