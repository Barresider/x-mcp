import { Page } from "playwright-core";
import { scrollDown } from "./scroll-down";
import { r } from "../../utils";

export async function followPeople(page: Page) {
  const peopleToFollow = r(5, 10);
  console.log(`Following ${peopleToFollow} people...`);
  let followedPeople = 0;
  while (followedPeople < peopleToFollow) {
    const followButtons = page.getByText("Follow", { exact: true });
    page.locator("");
    const list = await followButtons.all();
    console.log(`Found ${list.length} people to follow...`);
    for (const button of list) {
      if (followedPeople >= peopleToFollow) {
        break;
      }
      try {
        await button.click({ timeout: 1000 });
        followedPeople++;
        console.log(`Followed ${followedPeople}/${peopleToFollow} people`);
        await page.waitForTimeout(r(600, 900));
      } catch (e) {
        // ignore if not found
      }
    }

    if (list.length < peopleToFollow - followedPeople) {
      console.log("Scrolling down to find more people...");
      await scrollDown(page);
    }
  }
}
