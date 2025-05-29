import { Page } from "playwright";
import { TwitterPost, PostMetrics, ScrapeOptions } from "../types";
import { 
  waitForTwitterReady, 
  scrollAndWait, 
  parseCount, 
  calculateEngagementRate,
  extractUserFromElement,
  extractMediaFromElement,
  parseTwitterDate,
  isAdElement
} from "./utils";

/**
 * Scrape posts from the current page
 */
export async function scrapePosts(
  page: Page, 
  options: ScrapeOptions = {}
): Promise<TwitterPost[]> {
  const { 
    maxPosts = 10, 
    scrollTimeout = 30000,
    waitBetweenScrolls = 2000 
  } = options;
  
  await waitForTwitterReady(page);
  
  const posts: TwitterPost[] = [];
  const seenPostIds = new Set<string>();
  const startTime = Date.now();
  
  while (posts.length < maxPosts && (Date.now() - startTime) < scrollTimeout) {
    // Get all tweet articles on the page
    const tweetElements = await page.$$('article[data-testid="tweet"]');
    
    for (const element of tweetElements) {
      if (posts.length >= maxPosts) break;
      
      try {
        if (await isAdElement(element)) {
          console.log('Skipping ad post');
          continue;
        }
        
        const post = await extractPostFromElement(element, page);
        
        if (post && !seenPostIds.has(post.postId)) {
          seenPostIds.add(post.postId);
          posts.push(post);
          console.log(`Scraped post ${posts.length}/${maxPosts}: ${post.postId}`);
        }
      } catch (error) {
        console.error('Error extracting post:', error);
      }
    }
    
    // If we don't have enough posts, scroll to load more
    if (posts.length < maxPosts) {
      await scrollAndWait(page, waitBetweenScrolls);
    }
  }
  
  return posts;
}

/**
 * Extract post data from a tweet element
 */
async function extractPostFromElement(element: any, page: Page): Promise<TwitterPost | null> {
  try {
    // Extract post URL and ID
    const postLink = await element.$('a[href*="/status/"]');
    if (!postLink) return null;
    
    const href = await postLink.getAttribute('href');
    if (!href) return null;
    
    const postIdMatch = href.match(/\/status\/(\d+)/);
    if (!postIdMatch) return null;
    
    const postId = postIdMatch[1];
    const url = `https://x.com${href}`;
    
    // Extract author
    const author = await extractUserFromElement(element);
    
    // Extract content
    const contentElement = await element.$('[data-testid="tweetText"]');
    const content = contentElement ? await contentElement.textContent() : '';
    
    // Extract timestamp
    const timeElement = await element.$('time');
    const dateTime = await timeElement?.getAttribute('datetime');
    const timestamp = dateTime ? new Date(dateTime) : new Date();
    
    // Extract media
    const media = await extractMediaFromElement(element);
    
    // Extract metrics
    const metrics = await extractMetricsFromElement(element);
    
    // Calculate engagement rate
    const engagementRate = calculateEngagementRate(
      metrics.likesCount,
      metrics.retweetsCount,
      metrics.repliesCount,
      metrics.impressionsCount
    );
    
    // Check if it's a retweet
    const retweetIndicator = await element.$('[data-testid="socialContext"]');
    const isRetweet = retweetIndicator !== null;
    
    let retweetedFrom = undefined;
    if (isRetweet) {
      const retweetText = await retweetIndicator?.textContent();
      if (retweetText && retweetText.includes('reposted')) {
        // Extract original author from retweet context
        const retweetAuthorElement = await retweetIndicator.$('a');
        if (retweetAuthorElement) {
          const retweetAuthorHref = await retweetAuthorElement.getAttribute('href');
          const retweetAuthorName = await retweetAuthorElement.textContent();
          if (retweetAuthorHref) {
            retweetedFrom = {
              userId: retweetAuthorHref.replace('/', ''),
              username: retweetAuthorHref.replace('/', ''),
              displayName: retweetAuthorName || ''
            };
          }
        }
      }
    }
    
    return {
      postId,
      author,
      content,
      timestamp,
      media,
      metrics,
      engagementRate,
      isRetweet,
      retweetedFrom,
      url
    };
  } catch (error) {
    console.error('Error in extractPostFromElement:', error);
    return null;
  }
}

/**
 * Extract metrics from a tweet element
 */
async function extractMetricsFromElement(element: any): Promise<PostMetrics> {
  const metrics: PostMetrics = {
    likesCount: 0,
    retweetsCount: 0,
    quotesCount: 0,
    repliesCount: 0,
    impressionsCount: 0,
    bookmarksCount: 0
  };
  
  try {
    // Extract reply count
    const replyButton = await element.$('[data-testid="reply"]');
    if (replyButton) {
      const replyText = await replyButton.textContent();
      metrics.repliesCount = parseCount(replyText || '0');
    }
    
    // Extract retweet count
    const retweetButton = await element.$('[data-testid="retweet"]');
    if (retweetButton) {
      const retweetText = await retweetButton.textContent();
      metrics.retweetsCount = parseCount(retweetText || '0');
    }
    
    // Extract like count
    const likeButton = await element.$('[data-testid="like"]');
    if (likeButton) {
      const likeText = await likeButton.textContent();
      metrics.likesCount = parseCount(likeText || '0');
    }
    
    // Extract view/impression count
    const viewsElement = await element.$('[href$="/analytics"]');
    if (viewsElement) {
      const viewsText = await viewsElement.textContent();
      metrics.impressionsCount = parseCount(viewsText || '0');
    }
    
    // Extract bookmark count (usually not visible in feed)
    const bookmarkButton = await element.$('[data-testid="bookmark"]');
    if (bookmarkButton) {
      const bookmarkText = await bookmarkButton.textContent();
      metrics.bookmarksCount = parseCount(bookmarkText || '0');
    }
    
  } catch (error) {
    console.error('Error extracting metrics:', error);
  }
  
  return metrics;
}

/**
 * Scrape a single post by URL
 */
export async function scrapeSinglePost(page: Page, postUrl: string): Promise<TwitterPost | null> {
  await page.goto(postUrl);
  await waitForTwitterReady(page);
  
  // Find the main tweet (not replies)
  const mainTweet = await page.$('article[data-testid="tweet"]').catch(() => null);
  if (!mainTweet) return null;
  
  // Check if it's an ad
  if (await isAdElement(mainTweet)) {
    console.log('Main tweet is an ad, skipping');
    return null;
  }
  
  return extractPostFromElement(mainTweet, page);
} 