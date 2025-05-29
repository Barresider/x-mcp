import { Page } from "playwright";
import { TwitterComment, ScrapeOptions } from "../types";
import { 
  waitForTwitterReady, 
  scrollAndWait, 
  parseCount,
  extractUserFromElement,
  dismissPopups,
  extractMediaFromElement,
  isAdElement
} from "./utils";

/**
 * Scrape comments from a tweet
 */
export async function scrapeComments(
  page: Page,
  postUrl: string,
  options: ScrapeOptions = {}
): Promise<TwitterComment[]> {
  const {
    maxPosts: maxComments = 50,
    scrollTimeout = 30000,
    waitBetweenScrolls = 2000
  } = options;
  
  // Navigate to the tweet if not already there
  if (!page.url().includes(postUrl)) {
    await page.goto(postUrl);
    await waitForTwitterReady(page);
    await dismissPopups(page);
  }
  
  const comments: TwitterComment[] = [];
  const seenCommentIds = new Set<string>();
  const startTime = Date.now();
  
  // Wait for replies section to load
  await page.waitForSelector('section[role="region"]', { timeout: 10000 }).catch(() => {});
  
  while (comments.length < maxComments && (Date.now() - startTime) < scrollTimeout) {
    // Get all reply articles
    const replyElements = await page.$$('article[data-testid="tweet"]');
    
    // Skip the first one as it's usually the main tweet
    for (let i = 1; i < replyElements.length; i++) {
      if (comments.length >= maxComments) break;
      
      const element = replyElements[i];
      try {
        if (await isAdElement(element)) {
          console.log('Skipping ad comment');
          continue;
        }
        
        const comment = await extractCommentFromElement(element, page);
        
        if (comment && !seenCommentIds.has(comment.commentId)) {
          seenCommentIds.add(comment.commentId);
          comments.push(comment);
          console.log(`Scraped comment ${comments.length}/${maxComments}`);
        }
      } catch (error) {
        console.error('Error extracting comment:', error);
      }
    }
    
    // Scroll to load more comments
    if (comments.length < maxComments) {
      await scrollAndWait(page, waitBetweenScrolls);
    }
  }
  
  return comments;
}

/**
 * Extract comment data from element
 */
async function extractCommentFromElement(element: any, _page: Page): Promise<TwitterComment | null> {
  try {
    // Extract comment URL and ID
    const commentLink = await element.$('a[href*="/status/"]');
    if (!commentLink) return null;
    
    const href = await commentLink.getAttribute('href');
    if (!href) return null;
    
    const commentIdMatch = href.match(/\/status\/(\d+)/);
    if (!commentIdMatch) return null;
    
    const commentId = commentIdMatch[1];
    const commentUrl = `https://twitter.com${href}`;
    
    // Extract author
    const author = await extractUserFromElement(element);
    
    // Extract content
    const contentElement = await element.$('[data-testid="tweetText"]');
    const content = contentElement ? await contentElement.textContent() : '';
    
    // Extract timestamp
    const timeElement = await element.$('time');
    const dateTime = await timeElement?.getAttribute('datetime');
    const timestamp = dateTime ? new Date(dateTime) : new Date();
    
    // Extract media if any
    const media = await extractMediaFromElement(element);
    
    // Extract metrics
    const likeButton = await element.$('[data-testid="like"]');
    const likeText = await likeButton?.textContent() || '0';
    const likesCount = parseCount(likeText);
    
    const replyButton = await element.$('[data-testid="reply"]');
    const replyText = await replyButton?.textContent() || '0';
    const repliesCount = parseCount(replyText);
    
    // Check if this is a reply to another comment and extract parent URL if available
    let parentCommentId: string | undefined;
    let parentCommentUrl: string | undefined;
    
    // Look for "Replying to" section which contains parent tweet info
    const replyingToLinks = await element.$$('a[href*="/status/"]');
    for (const link of replyingToLinks) {
      const linkHref = await link.getAttribute('href');
      if (linkHref && linkHref !== href) {
        const parentMatch = linkHref.match(/\/status\/(\d+)/);
        if (parentMatch) {
          parentCommentId = parentMatch[1];
          parentCommentUrl = `https://twitter.com${linkHref}`;
          break;
        }
      }
    }
    
    return {
      commentId,
      commentUrl,
      author,
      content,
      timestamp,
      likesCount,
      repliesCount,
      parentCommentId,
      parentCommentUrl,
      media: media.length > 0 ? media : undefined
    };
  } catch (error) {
    console.error('Error in extractCommentFromElement:', error);
    return null;
  }
}

/**
 * Get comment thread (comment and all its replies)
 */
export async function scrapeCommentThread(
  page: Page,
  commentUrl: string,
  options: ScrapeOptions = {}
): Promise<{
  mainComment: TwitterComment | null;
  replies: TwitterComment[];
}> {
  await page.goto(commentUrl);
  await waitForTwitterReady(page);
  await dismissPopups(page);
  
  // First article is usually the main comment
  const mainCommentElement = await page.$('article[data-testid="tweet"]').catch(() => null);
  let mainComment: TwitterComment | null = null;
  
  if (mainCommentElement && !(await isAdElement(mainCommentElement))) {
    mainComment = await extractCommentFromElement(mainCommentElement, page);
  } else if (mainCommentElement && await isAdElement(mainCommentElement)) {
    console.log('Main comment is an ad, skipping');
  }
  
  // Get all replies
  const replies = await scrapeComments(page, commentUrl, options);
  
  return {
    mainComment,
    replies
  };
}

/**
 * Get top comments sorted by engagement
 */
export function getTopComments(comments: TwitterComment[], limit: number = 10): TwitterComment[] {
  return comments
    .sort((a, b) => {
      const engagementA = a.likesCount + a.repliesCount;
      const engagementB = b.likesCount + b.repliesCount;
      return engagementB - engagementA;
    })
    .slice(0, limit);
} 