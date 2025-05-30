import { Page } from "playwright-core";
import { r } from "../utils";
import { TweetWithMedia } from "../types";
import { goHome } from "./go-home";
import { uploadMedia } from "./upload-media";
import { waitSecs } from "./wait-secs";
import { clickCompose } from "./click-compose";
import { saveState } from "./login";
import { scrollDown } from "./scroll-down";

/**
 * Like a specific post by URL
 */
export async function likePost(page: Page, postUrl: string): Promise<boolean> {
  try {
    await page.goto(postUrl);
    await page.waitForLoadState("domcontentloaded");

    // Find the like button
    const likeButton = page.locator('[data-testid="like"]').first();
    const isLiked = (await likeButton.getAttribute("data-testid")) === "unlike";

    if (!isLiked) {
      await likeButton.click();
      await page.waitForTimeout(r(500, 800));
      return true;
    }

    console.log("Post already liked");
    return false;
  } catch (error) {
    console.error("Error liking post:", error);
    throw error;
  }
}

/**
 * Unlike a specific post by URL
 */
export async function unlikePost(page: Page, postUrl: string): Promise<boolean> {
  try {
    await page.goto(postUrl);
    await page.waitForLoadState("domcontentloaded");

    // Find the unlike button
    const likeButton = page.locator('[data-testid="unlike"]').first();
    const isLiked = (await likeButton.count()) > 0;

    if (isLiked) {
      await likeButton.click();
      await page.waitForTimeout(r(500, 800));
      return true;
    }

    console.log("Post not liked");
    return false;
  } catch (error) {
    console.error("Error unliking post:", error);
    throw error;
  }
}

/**
 * Bookmark a specific post by URL
 */
export async function bookmarkPost(page: Page, postUrl: string): Promise<boolean> {
  try {
    await page.goto(postUrl);
    await page.waitForLoadState("domcontentloaded");

    // Find the bookmark button
    const bookmarkButton = page.locator('[data-testid="bookmark"]').first();
    await bookmarkButton.click();
    await page.waitForTimeout(r(500, 800));

    return true;
  } catch (error) {
    console.error("Error bookmarking post:", error);
    throw error;
  }
}

/**
 * Remove bookmark from a specific post by URL
 */
export async function unbookmarkPost(page: Page, postUrl: string): Promise<boolean> {
  try {
    await page.goto(postUrl);
    await page.waitForLoadState("domcontentloaded");

    // Find the bookmark button (when bookmarked, it has different styling but same testid)
    const bookmarkButton = page.locator('[data-testid="bookmark"]').first();
    await bookmarkButton.click();
    await page.waitForTimeout(r(500, 800));

    return true;
  } catch (error) {
    console.error("Error removing bookmark:", error);
    throw error;
  }
}

/**
 * Retweet/Repost a specific post by URL
 */
export async function retweetPost(page: Page, postUrl: string): Promise<boolean> {
  try {
    await page.goto(postUrl);
    await page.waitForLoadState("domcontentloaded");

    // Find the retweet button
    const retweetButton = page.locator('[data-testid="retweet"]').first();
    await retweetButton.click();

    // Click on "Repost" option in the menu
    const repostOption = page.locator('[data-testid="retweetConfirm"]');
    await repostOption.click();
    await page.waitForTimeout(r(500, 800));

    return true;
  } catch (error) {
    console.error("Error retweeting post:", error);
    throw error;
  }
}

/**
 * Undo retweet/repost of a specific post by URL
 */
export async function unretweetPost(page: Page, postUrl: string): Promise<boolean> {
  try {
    await page.goto(postUrl);
    await page.waitForLoadState("domcontentloaded");

    // Find the unretweet button
    const unretweetButton = page.locator('[data-testid="unretweet"]').first();
    await unretweetButton.click();

    // Confirm unretweet
    const confirmButton = page.locator('[data-testid="unretweetConfirm"]');
    await confirmButton.click();
    await page.waitForTimeout(r(500, 800));

    return true;
  } catch (error) {
    console.error("Error unretweeting post:", error);
    throw error;
  }
}

/**
 * Quote tweet a post with custom text
 */
export async function quoteTweet(page: Page, postUrl: string, quoteText: string): Promise<boolean> {
  try {
    await page.goto(postUrl);
    await page.waitForLoadState("domcontentloaded");

    // Find the retweet button
    const retweetButton = page.locator('[data-testid="retweet"]').first();
    await retweetButton.click();

    // Click on "Quote" option in the menu
    const quoteOption = page.locator('text="Quote"').first();
    await quoteOption.click();

    // Wait for compose modal
    await page.waitForSelector('[data-testid="tweetTextarea_0"]');

    // Type the quote text
    const textArea = page.locator('[data-testid="tweetTextarea_0"]');
    await textArea.fill(quoteText);
    await page.waitForTimeout(r(300, 500));

    // Click tweet button
    const tweetButton = page.locator('[data-testid="tweetButton"]');
    await tweetButton.click();
    await page.waitForTimeout(r(1000, 1500));

    return true;
  } catch (error) {
    console.error("Error quote tweeting:", error);
    throw error;
  }
}

/**
 * Reply to a post with a comment
 */
export async function replyToPost(
  page: Page,
  postUrl: string,
  replyText: string
): Promise<boolean> {
  try {
    await page.goto(postUrl);
    await page.waitForLoadState("domcontentloaded");

    // Click the reply button
    const replyButton = page.locator('[data-testid="reply"]').first();
    await replyButton.click();

    // Wait for reply compose area
    await page.waitForSelector('[data-testid="tweetTextarea_0"]');

    // Type the reply
    const textArea = page.locator('[data-testid="tweetTextarea_0"]');
    await textArea.fill(replyText);
    await page.waitForTimeout(r(300, 500));

    // Click reply button
    const tweetButton = page.locator('[data-testid="tweetButton"]');
    await tweetButton.click();
    await page.waitForTimeout(r(1000, 1500));

    return true;
  } catch (error) {
    console.error("Error replying to post:", error);
    throw error;
  }
}

export async function postTweet(page: Page, tweet: TweetWithMedia) {
  await goHome(page);

  console.log("Clicking tweet...");
  await page.click("a[href='/compose/post']");

  if (tweet.media && tweet.media.length > 0) {
    console.log("Uploading media...");
    await uploadMedia(page, tweet.media);
  }

  console.log("Typing tweet...");
  await page.fill(
    "//div[@data-viewportview='true']//div[@class='DraftEditor-editorContainer']/div[@role='textbox']",
    tweet.text
  );

  console.log("Clicking post...");
  await page.click("//span[contains(text(), 'Post')]");

  const isDuplicate = await page
    .waitForSelector("text=Whoops! You already said that.", { timeout: 2000 })
    .then(() => true)
    .catch(() => false);
  if (isDuplicate) {
    throw new Error(
      "Twitter/X rejected this tweet as a duplicate: 'Whoops! You already said that.' Please change the tweet text and try again."
    );
  }

  console.log("Waiting for tweet...");
  await page.waitForTimeout(r(1000, 2500));

  console.log("Simulating random behaviour...");
  await simulateRandomBehaviour(page);

  const composeOpen = await page
    .locator("[data-testid=mask]")
    .isVisible()
    .catch(() => false);
  if (composeOpen) {
    throw new Error(
      "Tweet compose box still open after posting tweet. Posting was not successful."
    );
  }

  console.log("Done!");
}

async function simulateRandomBehaviour(page: Page) {
  // simulate scrolling
  const times = r(2, 5);
  for (let i = 0; i < times; i++) {
    await page.mouse.wheel(0, r(100, 500));
    await page.waitForTimeout(r(1000, 2500));
  }
}

async function fillForThread(page: Page, text: string) {
  console.log("Filling tweet...");
  await page.keyboard.insertText(text);
  await waitSecs(page);
}

async function postAllForThread(page: Page) {
  console.log("Posting all...");
  const tabs = 7;
  for (let i = 0; i < tabs; i++) {
    await page.keyboard.press("Tab");
  }

  await page.keyboard.press("Enter");
}

async function addTweetForThread(page: Page, firstTime: boolean) {
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

      await fillForThread(page, tweet.text);
    }

    if (tweets.length > 0) {
      await addTweetForThread(page, firstTime);
      firstTime = false;
    }
  } while (tweets.length > 0);
  console.log("All tweets filled!");
}

export async function postThread(page: Page, tweets: TweetWithMedia[]): Promise<void> {
  // Validate tweets
  if (!tweets || tweets.length === 0) {
    throw new Error("No tweets provided for the thread");
  }

  if (tweets.length < 2) {
    throw new Error("A thread must contain at least 2 tweets");
  }

  // Make a copy to avoid mutating the original array
  const tweetsCopy = [...tweets];

  await goHome(page);
  await waitSecs(page);

  await clickCompose(page);
  await composeThread(page, tweetsCopy);
  await postAllForThread(page);
  await waitSecs(page);

  await goHome(page);
  await scrollDown(page);

  await saveState(page);
  await close();

  const composeOpenThread = await page
    .locator('[data-testid=mask]')
    .isVisible()
    .catch(() => false);
  if (composeOpenThread) {
    throw new Error(
      "Tweet compose box still open after posting thread. Posting was not successful."
    );
  }

  console.log("Done!");
}
