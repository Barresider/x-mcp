import * as fs from "fs";
import { Page } from "playwright";
import { getAuthenticatedPage, saveState } from "./login";
import { goHome } from "./behaviors/go-home";
import { waitSecs } from "./behaviors/wait-secs";
import { clickCompose } from "./behaviors/click-compose";
import { scrollDown } from "./behaviors/scroll-down";
import { uploadMedia } from "./behaviors/upload-media";
import { TweetWithMedia } from "./types";

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

async function composeThread(page: Page, tweets: TweetWithMedia[]) {
  let firstTime = true;
  do {
    const tweet = tweets.shift();
    if (tweet) {
      // Upload media for this tweet if provided
      if (tweet.media && tweet.media.length > 0) {
        await uploadMedia(page, tweet.media);
      }
      
      await fill(page, tweet.text);
    }

    if (tweets.length > 0) {
      await addTweet(page, firstTime);
      firstTime = false;
    }
  } while (tweets.length > 0);
  console.log("All tweets filled!");
}

export async function thread(tweets?: TweetWithMedia[]): Promise<void> {
  const { page, close } = await getAuthenticatedPage();

  let tweetsToPost: TweetWithMedia[];
  
  if (!tweets) {
    // Load from file
    tweetsToPost = loadMessages().map(text => ({ text }));
  } else {
    tweetsToPost = tweets;
  }

  // Validate tweets
  if (!tweetsToPost || tweetsToPost.length === 0) {
    throw new Error("No tweets provided for the thread");
  }

  if (tweetsToPost.length < 2) {
    throw new Error("A thread must contain at least 2 tweets");
  }

  // Make a copy to avoid mutating the original array
  const tweetsCopy = [...tweetsToPost];

  await goHome(page);
  await waitSecs(page);

  await clickCompose(page);
  await composeThread(page, tweetsCopy);
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
