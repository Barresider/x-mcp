import fs from "fs";
import { Page } from "playwright";
import { getAuthenticatedPage, saveState } from "./login";
import { goHome } from "./behaviors/go-home";
import { waitSecs } from "./behaviors/wait-secs";
import { clickCompose } from "./behaviors/click-compose";
import { scrollDown } from "./behaviors/scroll-down";

async function fill(page: Page, text: string) {
  console.log("Filling tweet...");
  await page.keyboard.insertText(text);
  await waitSecs(page);
}

async function postAll(page: Page) {
  console.log("Posting all...");
  const tabs = 7;
  for (let i = 0; i < tabs; i++) {
    await page.keyboard.press("Tab");
  }

  await page.keyboard.press("Enter");
}

async function addTweet(page: Page, firstTime: boolean) {
  const tabs = firstTime ? 7 : 6;
  for (let i = 0; i < tabs; i++) {
    await page.keyboard.press("Tab");
  }

  await page.keyboard.press("Enter");
}

async function composeThread(page: Page, tweets: string[]) {
  let firstTime = true;
  do {
    const tweet = tweets.shift();
    if (tweet) {
      await fill(page, tweet);
    }

    if (tweets.length > 0) {
      await addTweet(page, firstTime);
      firstTime = false;
    }
  } while (tweets.length > 0);
  console.log("All tweets filled!");
}

export async function thread() {
  const { page, close } = await getAuthenticatedPage();

  const tweets = loadMessages();

  await goHome(page);
  await waitSecs(page);

  await clickCompose(page);
  await composeThread(page, tweets);
  await postAll(page);
  await waitSecs(page);

  await goHome(page);
  await scrollDown(page);

  await saveState(page);
  await close();

  console.log("Done!");
}

/**
 * Reads a `messages.jsonl` file in the root and returns an array of messages.
 * Each line is a JSON object with a `message` key.
 */
function loadMessages() {
  const content = fs.readFileSync("messages.jsonl", "utf-8");
  const tweets = content
    .split("\n")
    .filter((l) => l.length > 0)
    .map((line) => JSON.parse(line).message);
  return tweets;
}
