import { Page } from "playwright-core";
import { scrollDown } from "./scroll-down";
import { r } from "../utils";

export async function likePosts(page: Page) {
  const postsToLike = r(5, 10);
  console.log(`Liking ${postsToLike} posts...`);
  let likedPosts = 0;
  while (likedPosts < postsToLike) {
    const likeButtons = page.locator("button[aria-label$='Like']");
    const list = await likeButtons.all();
    console.log(`Found ${list.length} posts to like...`);
    for (const button of list) {
      if (likedPosts >= postsToLike) {
        break;
      }
      try {
        await button.click({ timeout: 1000 });
        likedPosts++;
        console.log(`Liked ${likedPosts}/${postsToLike} posts`);
        await page.waitForTimeout(r(600, 900));
      } catch (e) {
        // ignore if not found
      }
    }

    if (list.length < postsToLike - likedPosts) {
      console.log("Scrolling down to find more posts...");
      await scrollDown(page);
    }
  }
}
