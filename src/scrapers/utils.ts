import { Page } from "playwright";
import { TwitterMedia, TwitterUser } from "../types";

/**
 * Wait for the page to be ready and content to be loaded
 */
export async function waitForTwitterReady(page: Page) {
  await page.waitForLoadState('load');
  await page.waitForTimeout(1000); // Extra safety
}

/**
 * Scroll down and wait for new content to load
 */
export async function scrollAndWait(page: Page, waitTime: number = 2000) {
  const previousHeight = await page.evaluate(() => document.body.scrollHeight);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(waitTime);
  
  // Wait for new content to potentially load
  try {
    await page.waitForFunction(
      (prevHeight) => document.body.scrollHeight > prevHeight,
      previousHeight,
      { timeout: 5000 }
    );
  } catch {
    // No new content loaded
  }
}

/**
 * Parse a number from text (handles K, M suffixes)
 */
export function parseCount(text: string): number {
  if (!text || text === '') return 0;
  
  text = text.trim().toLowerCase();
  
  if (text.includes('k')) {
    return parseFloat(text.replace('k', '')) * 1000;
  } else if (text.includes('m')) {
    return parseFloat(text.replace('m', '')) * 1000000;
  }
  
  // Remove commas and parse
  return parseInt(text.replace(/,/g, ''), 10) || 0;
}

/**
 * Calculate engagement rate
 */
export function calculateEngagementRate(
  likes: number,
  retweets: number,
  replies: number,
  impressions: number
): number {
  if (impressions === 0) return 0;
  return ((likes + retweets + replies) / impressions) * 100;
}

/**
 * Extract user data from a tweet element
 */
export async function extractUserFromElement(element: any): Promise<TwitterUser> {
  const username = await element.$eval('[data-testid="User-Name"] a', (el: any) => {
    const href = el.getAttribute('href');
    return href ? href.replace('/', '') : '';
  }).catch(() => '');
  
  const displayName = await element.$eval('[data-testid="User-Name"] span', (el: any) => el.textContent)
    .catch(() => '');
  
  const avatarUrl = await element.$eval('img[src*="profile_images"]', (el: any) => el.src)
    .catch(() => '');
  
  // Check for verification badges
  const isVerified = await element.$('[aria-label="Verified account"]').then((el: any) => el !== null).catch(() => false);
  const isBlueVerified = await element.$('[aria-label*="verified"]').then((el: any) => el !== null).catch(() => false);
  
  return {
    userId: username, // In a real implementation, we'd extract the actual ID
    username,
    displayName,
    avatarUrl,
    isVerified,
    isBlueVerified
  };
}

/**
 * Extract media from a tweet element
 */
export async function extractMediaFromElement(element: any): Promise<TwitterMedia[]> {
  const media: TwitterMedia[] = [];
  
  // Images
  const images = await element.$$('[data-testid="tweetPhoto"] img');
  for (const img of images) {
    const src = await img.getAttribute('src');
    if (src) {
      media.push({
        type: 'image',
        url: src.replace(/&name=\w+/, '&name=large') // Get large version
      });
    }
  }
  
  // Videos
  const videos = await element.$$('video');
  for (const video of videos) {
    const src = await video.getAttribute('src');
    const poster = await video.getAttribute('poster');
    if (src) {
      media.push({
        type: 'video',
        url: src,
        thumbnailUrl: poster || undefined
      });
    }
  }
  
  return media;
}

/**
 * Parse date from Twitter's relative time format
 */
export function parseTwitterDate(dateText: string): Date {
  const now = new Date();
  
  if (dateText.includes('s')) {
    // seconds ago
    const seconds = parseInt(dateText);
    return new Date(now.getTime() - seconds * 1000);
  } else if (dateText.includes('m')) {
    // minutes ago
    const minutes = parseInt(dateText);
    return new Date(now.getTime() - minutes * 60 * 1000);
  } else if (dateText.includes('h')) {
    // hours ago
    const hours = parseInt(dateText);
    return new Date(now.getTime() - hours * 60 * 60 * 1000);
  } else {
    // Try to parse as actual date
    return new Date(dateText);
  }
}

/**
 * Wait for and dismiss any popups or modals
 */
export async function dismissPopups(page: Page) {
  // Dismiss cookie banner if present
  const cookieBanner = page.locator('[data-testid="BottomBar"]');
  if (await cookieBanner.isVisible({ timeout: 1000 }).catch(() => false)) {
    const dismissButton = cookieBanner.locator('button').first();
    await dismissButton.click().catch(() => {});
  }
  
  // Dismiss any other modals
  const closeButtons = page.locator('[aria-label="Close"]');
  const count = await closeButtons.count();
  for (let i = 0; i < count; i++) {
    await closeButtons.nth(i).click().catch(() => {});
  }
} 