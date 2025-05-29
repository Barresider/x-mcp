import { Page } from "playwright";
import { TwitterProfile, ScrapeOptions } from "../types";
import { waitForTwitterReady, parseCount, dismissPopups } from "./utils";
import { scrapePosts } from "./post-scraper";

/**
 * Scrape a Twitter/X user profile
 */
export async function scrapeProfile(
  page: Page, 
  username: string,
  options: ScrapeOptions = {}
): Promise<TwitterProfile | null> {
  try {
    // Navigate to profile
    const profileUrl = `https://x.com/${username.replace('@', '')}`;
    await page.goto(profileUrl);
    await waitForTwitterReady(page);
    await dismissPopups(page);
    
    // Check if profile exists
    const notFound = await page.$('text="This account doesn\'t exist"').catch(() => null);
    if (notFound) {
      console.error(`Profile not found: ${username}`);
      return null;
    }
    
    // Wait for profile data to load
    await page.waitForSelector('[data-testid="UserName"]', { timeout: 10000 }).catch(() => {});
    
    // Extract basic profile info
    const profileData = await extractProfileData(page);
    if (!profileData) return null;
    
    // Scrape latest posts if requested
    let latestPosts = undefined;
    if (options.maxPosts && options.maxPosts > 0) {
      console.log(`Scraping ${options.maxPosts} latest posts from profile...`);
      latestPosts = await scrapePosts(page, options);
    }
    
    return {
      ...profileData,
      latestPosts
    };
  } catch (error) {
    console.error('Error scraping profile:', error);
    return null;
  }
}

/**
 * Extract profile data from the page
 */
async function extractProfileData(page: Page): Promise<Omit<TwitterProfile, 'latestPosts'> | null> {
  try {
    // Extract username and display name
    const userNameElement = await page.$('[data-testid="UserName"]');
    if (!userNameElement) return null;
    
    const displayName = await userNameElement.$eval('span:first-child', el => el.textContent || '').catch(() => '');
    const usernameText = await userNameElement.$eval('span:last-child', el => el.textContent || '').catch(() => '');
    const username = usernameText.replace('@', '');
    
    // Extract avatar URL
    const avatarUrl = await page.$eval(
      'a[href$="/photo"] img, div[data-testid="UserAvatar-Container-unknown"] img',
      (el: any) => el.src
    ).catch(() => '');
    
    // Extract banner URL
    const bannerUrl = await page.$eval(
      'a[href$="/header_photo"] img',
      (el: any) => el.src
    ).catch(() => '');
    
    // Extract bio
    const bio = await page.$eval(
      '[data-testid="UserDescription"]',
      el => el.textContent || ''
    ).catch(() => '');
    
    // Extract location
    const location = await page.$eval(
      '[data-testid="UserLocation"] span',
      el => el.textContent || ''
    ).catch(() => '');
    
    // Extract website
    const website = await page.$eval(
      '[data-testid="UserUrl"] a',
      (el: any) => el.href || ''
    ).catch(() => '');
    
    // Extract joined date
    const joinedDateText = await page.$eval(
      '[data-testid="UserJoinDate"] span',
      el => el.textContent || ''
    ).catch(() => '');
    const joinedDate = joinedDateText ? parseJoinedDate(joinedDateText) : undefined;
    
    // Extract following/followers counts
    const followingElement = await page.$(`a[href="/${username}/following"]`).catch(() => null);
    const followersElement = await page.$(`a[href="/${username}/verified_followers"]`).catch(() => null);
    
    const followingText = followingElement ? await followingElement.textContent() : '0';
    const followersText = followersElement ? await followersElement.textContent() : '0';
    
    const followingCount = parseCount(followingText?.split(' ')[0] || '0');
    const followersCount = parseCount(followersText?.split(' ')[0] || '0');
    
    // Extract posts count from nav
    const postsCountElement = await page.$('nav[role="navigation"] div[dir="ltr"] span').catch(() => null);
    const postsCountText = postsCountElement ? await postsCountElement.textContent() : '0';
    const postsCount = parseCount(postsCountText?.replace(' posts', '').replace(' post', '') || '0');
    
    // Check verification status
    const isVerified = await page.$('[data-testid="UserName"] [aria-label="Verified account"]').catch(() => null) !== null;
    const isBlueVerified = await page.$('[data-testid="UserName"] svg[aria-label*="verified"]').catch(() => null) !== null;
    
    // Check follow status
    const followButton = await page.$('[data-testid$="-follow"]').catch(() => null);
    const followButtonText = followButton ? await followButton.textContent() : '';
    const isFollowing = followButtonText?.toLowerCase().includes('following') || false;
    
    // Check if followed by
    const followedByElement = await page.$('text=/Follows you/i').catch(() => null);
    const isFollowedBy = followedByElement !== null;
    
    return {
      userId: username, // In real implementation, we'd extract the actual numeric ID
      username,
      displayName,
      avatarUrl,
      bannerUrl,
      bio,
      location,
      website,
      joinedDate,
      followingCount,
      followersCount,
      postsCount,
      isVerified,
      isBlueVerified,
      isFollowing,
      isFollowedBy
    };
  } catch (error) {
    console.error('Error extracting profile data:', error);
    return null;
  }
}

/**
 * Parse joined date from Twitter format
 */
function parseJoinedDate(dateText: string): Date | undefined {
  try {
    // Remove "Joined " prefix
    const cleanedText = dateText.replace('Joined ', '');
    // Parse date (format: "Month Year")
    return new Date(cleanedText);
  } catch {
    return undefined;
  }
}

/**
 * Scrape multiple profiles
 */
export async function scrapeProfiles(
  page: Page,
  usernames: string[],
  options: ScrapeOptions = {}
): Promise<TwitterProfile[]> {
  const profiles: TwitterProfile[] = [];
  
  for (const username of usernames) {
    console.log(`Scraping profile: ${username}`);
    const profile = await scrapeProfile(page, username, options);
    if (profile) {
      profiles.push(profile);
    }
    
    // Add a small delay between profiles to avoid rate limiting
    await page.waitForTimeout(2000);
  }
  
  return profiles;
}