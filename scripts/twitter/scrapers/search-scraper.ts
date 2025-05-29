import { Page } from "playwright";
import { TwitterPost, SearchOptions, ScrapeOptions } from "../types";
import { waitForTwitterReady, dismissPopups } from "./utils";
import { scrapePosts } from "./post-scraper";

/**
 * Build advanced search URL from options
 */
function buildSearchUrl(options: SearchOptions): string {
  const params: string[] = [];
  
  // Basic query
  if (options.query) {
    params.push(encodeURIComponent(options.query));
  }
  
  // From user
  if (options.fromUser) {
    params.push(`(from:${options.fromUser})`);
  }
  
  // To user
  if (options.toUser) {
    params.push(`(to:${options.toUser})`);
  }
  
  // Minimum engagement filters
  if (options.minLikes) {
    params.push(`min_faves:${options.minLikes}`);
  }
  
  if (options.minRetweets) {
    params.push(`min_retweets:${options.minRetweets}`);
  }
  
  if (options.minReplies) {
    params.push(`min_replies:${options.minReplies}`);
  }
  
  // Include/exclude replies
  if (options.includeReplies === false) {
    params.push('-filter:replies');
  }
  
  // Only verified accounts
  if (options.onlyVerified) {
    params.push('filter:verified');
  }
  
  // Has media
  if (options.hasMedia) {
    params.push('filter:media');
  }
  
  // Language
  if (options.language) {
    params.push(`lang:${options.language}`);
  }
  
  // Date range
  if (options.dateFrom) {
    const fromDate = options.dateFrom.toISOString().split('T')[0];
    params.push(`since:${fromDate}`);
  }
  
  if (options.dateTo) {
    const toDate = options.dateTo.toISOString().split('T')[0];
    params.push(`until:${toDate}`);
  }
  
  const query = params.join(' ');
  return `https://x.com/search?q=${encodeURIComponent(query)}&src=typed_query&f=live`;
}

/**
 * Perform advanced search and scrape results
 */
export async function searchTwitter(
  page: Page,
  searchOptions: SearchOptions,
  scrapeOptions: ScrapeOptions = {}
): Promise<TwitterPost[]> {
  const searchUrl = buildSearchUrl(searchOptions);
  
  console.log('Searching with URL:', searchUrl);
  
  await page.goto(searchUrl);
  await waitForTwitterReady(page);
  await dismissPopups(page);
  
  // Wait for search results to load
  await page.waitForSelector('section[role="region"]', { timeout: 10000 }).catch(() => {});
  
  // Scrape posts from search results
  const posts = await scrapePosts(page, scrapeOptions);
  
  console.log(`Found ${posts.length} posts matching search criteria`);
  
  return posts;
}

/**
 * Common search presets
 */
export const SearchPresets = {
  /**
   * Search for viral posts
   */
  viral: (query: string, minLikes: number = 1000): SearchOptions => ({
    query,
    minLikes,
    minRetweets: 100,
    includeReplies: false
  }),
  
  /**
   * Search for posts with media
   */
  withMedia: (query: string): SearchOptions => ({
    query,
    hasMedia: true,
    includeReplies: false
  }),
  
  /**
   * Search from verified accounts only
   */
  verifiedOnly: (query: string): SearchOptions => ({
    query,
    onlyVerified: true,
    includeReplies: false
  }),
  
  /**
   * Search posts from specific user
   */
  fromUser: (username: string, query?: string): SearchOptions => ({
    query: query || '',
    fromUser: username.replace('@', ''),
    includeReplies: false
  }),
  
  /**
   * Search recent posts (last 7 days)
   */
  recent: (query: string): SearchOptions => ({
    query,
    dateFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    includeReplies: false
  }),
  
  /**
   * Search for conversations between users
   */
  conversation: (user1: string, user2: string): SearchOptions => ({
    query: '',
    fromUser: user1.replace('@', ''),
    toUser: user2.replace('@', ''),
    includeReplies: true
  })
};

/**
 * Search for trending topics
 */
export async function scrapeTrendingTopics(page: Page): Promise<string[]> {
  await page.goto('https://x.com/explore');
  await waitForTwitterReady(page);
  await dismissPopups(page);
  
  const trends: string[] = [];
  
  try {
    // Wait for trends to load
    await page.waitForSelector('[data-testid="trend"]', { timeout: 10000 });
    
    // Get all trend elements
    const trendElements = await page.$$('[data-testid="trend"]');
    
    for (const element of trendElements) {
      const trendText = await element.$eval('span[dir="ltr"]', el => el.textContent || '').catch(() => '');
      if (trendText && !trendText.includes('·')) {
        trends.push(trendText);
      }
    }
  } catch (error) {
    console.error('Error scraping trending topics:', error);
  }
  
  return trends;
} 