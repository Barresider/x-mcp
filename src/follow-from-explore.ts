/**
 * Goes Home
 * Clicks on Explore
 * Types the given text in the search bar
 * Clicks on the people tab
 * Follows a random number of people
 */

import { goExplore } from "./behaviors/go-explore";
import { getAuthenticatedPage, saveState } from "./login";
import { waitSecs } from "./behaviors/wait-secs";
import { scrollDown } from "./behaviors/scroll-down";
import { executeSearch } from "./behaviors/execute-search";
import { followPeople } from "./behaviors/follow-people";

export async function followFromExplore(query: string) {
  const { page, close } = await getAuthenticatedPage();

  await goExplore(page);
  await executeSearch(page, query);
  await page.click("//span[contains(text(), 'People')]");
  await followPeople(page);

  await waitSecs(page);
  await scrollDown(page);
  await saveState(page);
  await close();
  console.log("Done!");
}
