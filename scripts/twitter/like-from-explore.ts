/**
 * Goes Home
 * Clicks on Explore
 * Types the given text in the search bar
 * Likes a random number of posts
 */

import { goExplore } from "./behaviors/go-explore";
import { getAuthenticatedPage, saveState } from "./login";
import { waitSecs } from "./behaviors/wait-secs";
import { scrollDown } from "./behaviors/scroll-down";
import { executeSearch } from "./behaviors/execute-search";
import { likePosts } from "./behaviors/like-posts";

export async function likeFromExplore(query: string) {
  const { page, close } = await getAuthenticatedPage();

  await goExplore(page);
  await executeSearch(page, query);
  await likePosts(page);
  await waitSecs(page);
  await scrollDown(page);
  await saveState(page);
  await close();
  console.log("Done!");
}
