import { Page } from "playwright-core";
import { r } from "../utils";

/**
 * Like a specific comment
 * @param page - The authenticated page
 * @param postUrl - URL of the post containing the comment
 * @param commentIndex - Index of the comment to like (0-based)
 */
export async function likeComment(page: Page, postUrl: string, commentIndex: number): Promise<boolean> {
  try {
    await page.goto(postUrl);
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for comments to load
    await page.waitForSelector('article[data-testid="tweet"]', { timeout: 5000 });
    
    // Get all comment articles (first one is usually the main post)
    const comments = await page.locator('article[data-testid="tweet"]').all();
    
    // Skip the first article (main post) and get the target comment
    const targetComment = comments[commentIndex + 1];
    
    if (!targetComment) {
      throw new Error(`Comment at index ${commentIndex} not found`);
    }
    
    // Find the like button within the comment
    const likeButton = await targetComment.locator('[data-testid="like"]').first();
    await likeButton.click();
    await page.waitForTimeout(r(500, 800));
    
    return true;
  } catch (error) {
    console.error("Error liking comment:", error);
    throw error;
  }
}

/**
 * Unlike a specific comment
 * @param page - The authenticated page
 * @param postUrl - URL of the post containing the comment
 * @param commentIndex - Index of the comment to unlike (0-based)
 */
export async function unlikeComment(page: Page, postUrl: string, commentIndex: number): Promise<boolean> {
  try {
    await page.goto(postUrl);
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for comments to load
    await page.waitForSelector('article[data-testid="tweet"]', { timeout: 5000 });
    
    // Get all comment articles (first one is usually the main post)
    const comments = await page.locator('article[data-testid="tweet"]').all();
    
    // Skip the first article (main post) and get the target comment
    const targetComment = comments[commentIndex + 1];
    
    if (!targetComment) {
      throw new Error(`Comment at index ${commentIndex} not found`);
    }
    
    // Find the unlike button within the comment
    const unlikeButton = await targetComment.locator('[data-testid="unlike"]').first();
    await unlikeButton.click();
    await page.waitForTimeout(r(500, 800));
    
    return true;
  } catch (error) {
    console.error("Error unliking comment:", error);
    throw error;
  }
}

/**
 * Reply to a specific comment
 * @param page - The authenticated page
 * @param postUrl - URL of the post containing the comment
 * @param commentIndex - Index of the comment to reply to (0-based)
 * @param replyText - The text to reply with
 */
export async function replyToComment(page: Page, postUrl: string, commentIndex: number, replyText: string): Promise<boolean> {
  try {
    await page.goto(postUrl);
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for comments to load
    await page.waitForSelector('article[data-testid="tweet"]', { timeout: 5000 });
    
    // Get all comment articles (first one is usually the main post)
    const comments = await page.locator('article[data-testid="tweet"]').all();
    
    // Skip the first article (main post) and get the target comment
    const targetComment = comments[commentIndex + 1];
    
    if (!targetComment) {
      throw new Error(`Comment at index ${commentIndex} not found`);
    }
    
    // Find the reply button within the comment
    const replyButton = await targetComment.locator('[data-testid="reply"]').first();
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
    console.error("Error replying to comment:", error);
    throw error;
  }
}

/**
 * Like a comment by its ID (if you have scraped comments and have their IDs)
 * @param page - The authenticated page
 * @param commentUrl - Direct URL to the comment
 */
export async function likeCommentById(page: Page, commentUrl: string): Promise<boolean> {
  try {
    await page.goto(commentUrl);
    await page.waitForLoadState('domcontentloaded');
    
    // The main article on a comment page is the comment itself
    const likeButton = page.locator('[data-testid="like"]').first();
    await likeButton.click();
    await page.waitForTimeout(r(500, 800));
    
    return true;
  } catch (error) {
    console.error("Error liking comment by ID:", error);
    throw error;
  }
} 