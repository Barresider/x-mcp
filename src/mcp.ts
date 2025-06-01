#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  TextContent,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { Page } from "playwright";
import { z } from "zod";

import { getAuthenticatedPage } from "./behaviors/login";
import {
  getTopComments,
  scrapeComments,
  scrapePosts,
  scrapeProfile,
  scrapeTimeline,
  scrapeTrendingTopics,
  SearchPresets,
  searchTwitter,
} from "./scrapers";
import { TweetWithMedia } from "./types";

// Import post interaction functions
import {
  bookmarkPost,
  likePost,
  postThread,
  postTweet,
  quoteTweet,
  replyToPost,
  retweetPost,
  unbookmarkPost,
  unlikePost,
  unretweetPost,
} from "./behaviors/interact-with-post";

// Import comment interaction functions
import {
  likeCommentById,
  replaceCommentById,
  replyToCommentById,
  unlikeCommentById,
} from "./behaviors/interact-with-comment";
import { readFileSync, unlinkSync } from "fs";

// Validation schemas using Zod
const TweetSchema = z.object({
  text: z.string().min(1).max(280).describe("The text content of the tweet"),
  media: z
    .array(z.string())
    .optional()
    .describe("Array of media file paths (images/videos) to attach to the tweet"),
});

const ThreadSchema = z.object({
  tweets: z
    .array(TweetSchema)
    .min(2)
    .describe("Array of tweet objects with text and optional media"),
});

const ScrapePostsSchema = z.object({
  maxPosts: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .default(10)
    .describe("Maximum number of posts to scrape"),
});

const ScrapeProfileSchema = z.object({
  username: z.string().describe("Username to scrape (without @)"),
  maxPosts: z
    .number()
    .min(1)
    .max(50)
    .optional()
    .default(5)
    .describe("Maximum number of posts to include"),
});

const ScrapeCommentsSchema = z.object({
  postUrl: z.string().url().describe("URL of the post to scrape comments from"),
  maxComments: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .default(20)
    .describe("Maximum number of comments to scrape"),
});

const SearchTwitterSchema = z.object({
  query: z.string().describe("Search query"),
  maxPosts: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .default(10)
    .describe("Maximum number of posts to return"),
});

const SearchViralSchema = z.object({
  query: z.string().describe("Search query"),
  minLikes: z
    .number()
    .min(100)
    .optional()
    .default(1000)
    .describe("Minimum number of likes for viral posts"),
  maxPosts: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .default(10)
    .describe("Maximum number of posts to return"),
});

const ScrapeTimelineSchema = z.object({
  type: z
    .enum(["for-you", "following"])
    .optional()
    .default("for-you")
    .describe("Timeline type to scrape"),
  maxPosts: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .default(10)
    .describe("Maximum number of posts to scrape"),
});

// Post interaction schemas
const LikePostSchema = z.object({
  postUrl: z.string().url().describe("URL of the post to like"),
});

const UnlikePostSchema = z.object({
  postUrl: z.string().url().describe("URL of the post to unlike"),
});

const BookmarkPostSchema = z.object({
  postUrl: z.string().url().describe("URL of the post to bookmark"),
});

const UnbookmarkPostSchema = z.object({
  postUrl: z.string().url().describe("URL of the post to remove bookmark from"),
});

const RetweetPostSchema = z.object({
  postUrl: z.string().url().describe("URL of the post to retweet/repost"),
});

const UnretweetPostSchema = z.object({
  postUrl: z.string().url().describe("URL of the post to unretweet"),
});

const QuoteTweetSchema = z.object({
  postUrl: z.string().url().describe("URL of the post to quote tweet"),
  quoteText: z.string().min(1).max(280).describe("Text for the quote tweet"),
});

const ReplyToPostSchema = z.object({
  postUrl: z.string().url().describe("URL of the post to reply to"),
  replyText: z.string().min(1).max(280).describe("Text for the reply"),
});

// Comment interaction schemas
const LikeCommentByIdSchema = z.object({
  commentUrl: z.string().url().describe("Direct URL to the comment"),
});

const UnlikeCommentByIdSchema = z.object({
  commentUrl: z.string().url().describe("Direct URL to the comment"),
});

const ReplyToCommentByIdSchema = z.object({
  commentUrl: z.string().url().describe("Direct URL to the comment"),
  replyText: z.string().min(1).max(280).describe("Text for the reply"),
});

const ReplaceCommentByIdSchema = z.object({
  commentUrl: z.string().url().describe("Direct URL to the comment"),
  newText: z.string().min(1).max(280).describe("The new text to replace the comment with"),
});

export class TwitterMCPServer {
  private server: Server;
  private authenticatedPage: Page | null = null;
  private browserContextClose: (() => Promise<void>) | null = null;

  constructor() {
    this.server = new Server(
      {
        name: "twitter-playwright-mcp",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Error handler
    this.server.onerror = (error) => {
      console.error("[MCP Error]:", error);
    };

    // Graceful shutdown
    process.on("SIGINT", async () => {
      console.error("Shutting down server...");
      if (this.browserContextClose) {
        await this.browserContextClose();
      }
      await this.server.close();
      process.exit(0);
    });

    // Register tool handlers
    this.setupToolHandlers();
  }

  private async ensureAuthenticated() {
    if (!this.authenticatedPage) {
      const { page, close } = await getAuthenticatedPage();
      this.authenticatedPage = page;
      this.browserContextClose = close;
    }
    return this.authenticatedPage;
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "tweet",
          description: "Post a tweet to Twitter/X",
          inputSchema: {
            type: "object",
            properties: {
              text: {
                type: "string",
                description: "The text content of the tweet",
                maxLength: 280,
                minLength: 1,
              },
              media: {
                type: "array",
                description: "Array of media file paths (images/videos) to attach to the tweet",
                items: {
                  type: "string",
                },
              },
            },
            required: ["text"],
          },
        } as Tool,
        {
          name: "thread",
          description: "Post a thread of tweets",
          inputSchema: {
            type: "object",
            properties: {
              tweets: {
                type: "array",
                description: "Array of tweet objects with text and optional media",
                items: {
                  type: "object",
                  properties: {
                    text: {
                      type: "string",
                      description: "Tweet text",
                    },
                    media: {
                      type: "array",
                      description: "Media files for this tweet",
                      items: {
                        type: "string",
                      },
                    },
                  },
                  required: ["text"],
                },
                minItems: 2,
              },
            },
            required: ["tweets"],
          },
        } as Tool,
        {
          name: "scrape_posts",
          description: "Scrape posts from current page",
          inputSchema: {
            type: "object",
            properties: {
              maxPosts: {
                type: "number",
                description: "Maximum number of posts to scrape",
                minimum: 1,
                maximum: 100,
                default: 10,
              },
            },
            required: [],
          },
        } as Tool,
        {
          name: "scrape_profile",
          description: "Scrape a user profile",
          inputSchema: {
            type: "object",
            properties: {
              username: {
                type: "string",
                description: "Username to scrape (without @)",
              },
              maxPosts: {
                type: "number",
                description: "Maximum number of posts to include",
                minimum: 1,
                maximum: 50,
                default: 5,
              },
            },
            required: ["username"],
          },
        } as Tool,
        {
          name: "scrape_comments",
          description: "Scrape comments from a post",
          inputSchema: {
            type: "object",
            properties: {
              postUrl: {
                type: "string",
                description: "URL of the post to scrape comments from",
              },
              maxComments: {
                type: "number",
                description: "Maximum number of comments to scrape",
                minimum: 1,
                maximum: 100,
                default: 20,
              },
            },
            required: ["postUrl"],
          },
        } as Tool,
        {
          name: "search_twitter",
          description: "Search for tweets",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query",
              },
              maxPosts: {
                type: "number",
                description: "Maximum number of posts to return",
                minimum: 1,
                maximum: 100,
                default: 10,
              },
            },
            required: ["query"],
          },
        } as Tool,
        {
          name: "search_viral",
          description: "Search for viral posts",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query",
              },
              minLikes: {
                type: "number",
                description: "Minimum number of likes for viral posts",
                minimum: 100,
                default: 1000,
              },
              maxPosts: {
                type: "number",
                description: "Maximum number of posts to return",
                minimum: 1,
                maximum: 100,
                default: 10,
              },
            },
            required: ["query"],
          },
        } as Tool,
        {
          name: "scrape_timeline",
          description: "Scrape posts from timeline",
          inputSchema: {
            type: "object",
            properties: {
              type: {
                type: "string",
                description: "Timeline type to scrape",
                enum: ["for-you", "following"],
                default: "for-you",
              },
              maxPosts: {
                type: "number",
                description: "Maximum number of posts to scrape",
                minimum: 1,
                maximum: 100,
                default: 10,
              },
            },
            required: [],
          },
        } as Tool,
        {
          name: "scrape_trending",
          description: "Get trending topics",
          inputSchema: {
            type: "object",
            properties: {},
            required: [],
          },
        } as Tool,
        // Post interaction tools
        {
          name: "like_post",
          description: "Like a specific post",
          inputSchema: {
            type: "object",
            properties: {
              postUrl: {
                type: "string",
                description: "URL of the post to like",
              },
            },
            required: ["postUrl"],
          },
        } as Tool,
        {
          name: "unlike_post",
          description: "Unlike a specific post",
          inputSchema: {
            type: "object",
            properties: {
              postUrl: {
                type: "string",
                description: "URL of the post to unlike",
              },
            },
            required: ["postUrl"],
          },
        } as Tool,
        {
          name: "bookmark_post",
          description: "Bookmark a specific post",
          inputSchema: {
            type: "object",
            properties: {
              postUrl: {
                type: "string",
                description: "URL of the post to bookmark",
              },
            },
            required: ["postUrl"],
          },
        } as Tool,
        {
          name: "unbookmark_post",
          description: "Remove bookmark from a specific post",
          inputSchema: {
            type: "object",
            properties: {
              postUrl: {
                type: "string",
                description: "URL of the post to remove bookmark from",
              },
            },
            required: ["postUrl"],
          },
        } as Tool,
        {
          name: "retweet_post",
          description: "Retweet/repost a specific post",
          inputSchema: {
            type: "object",
            properties: {
              postUrl: {
                type: "string",
                description: "URL of the post to retweet/repost",
              },
            },
            required: ["postUrl"],
          },
        } as Tool,
        {
          name: "unretweet_post",
          description: "Remove retweet/repost of a specific post",
          inputSchema: {
            type: "object",
            properties: {
              postUrl: {
                type: "string",
                description: "URL of the post to unretweet",
              },
            },
            required: ["postUrl"],
          },
        } as Tool,
        {
          name: "quote_tweet",
          description: "Quote tweet a post with custom text",
          inputSchema: {
            type: "object",
            properties: {
              postUrl: {
                type: "string",
                description: "URL of the post to quote tweet",
              },
              quoteText: {
                type: "string",
                description: "Text for the quote tweet",
                minLength: 1,
                maxLength: 280,
              },
            },
            required: ["postUrl", "quoteText"],
          },
        } as Tool,
        {
          name: "reply_to_post",
          description: "Reply to a post with a comment",
          inputSchema: {
            type: "object",
            properties: {
              postUrl: {
                type: "string",
                description: "URL of the post to reply to",
              },
              replyText: {
                type: "string",
                description: "Text for the reply",
                minLength: 1,
                maxLength: 280,
              },
            },
            required: ["postUrl", "replyText"],
          },
        } as Tool,
        // Comment interaction tools
        {
          name: "like_comment_by_id",
          description: "Like a comment by its direct URL",
          inputSchema: {
            type: "object",
            properties: {
              commentUrl: {
                type: "string",
                description: "Direct URL to the comment",
              },
            },
            required: ["commentUrl"],
          },
        } as Tool,
        {
          name: "unlike_comment_by_id",
          description: "Unlike a comment by its direct URL",
          inputSchema: {
            type: "object",
            properties: {
              commentUrl: {
                type: "string",
                description: "Direct URL to the comment",
              },
            },
            required: ["commentUrl"],
          },
        } as Tool,
        {
          name: "reply_to_comment_by_id",
          description: "Reply to a comment with a comment",
          inputSchema: {
            type: "object",
            properties: {
              commentUrl: {
                type: "string",
                description: "Direct URL to the comment",
              },
              replyText: {
                type: "string",
                description: "Text for the reply",
                minLength: 1,
                maxLength: 280,
              },
            },
            required: ["commentUrl", "replyText"],
          },
        } as Tool,
        {
          name: "replace_comment_by_id",
          description:
            "Replace/edit a comment by its direct URL (Note: Twitter/X may not support comment editing)",
          inputSchema: {
            type: "object",
            properties: {
              commentUrl: {
                type: "string",
                description: "Direct URL to the comment",
              },
              newText: {
                type: "string",
                description: "The new text to replace the comment with",
                minLength: 1,
                maxLength: 280,
              },
            },
            required: ["commentUrl", "newText"],
          },
        } as Tool,
      ],
    }));

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      console.error(`Tool called: ${name}`, args);

      try {
        switch (name) {
          case "tweet":
            return await this.handleTweet(args);
          case "thread":
            return await this.handleThread(args);
          case "scrape_posts":
            return await this.handleScrapePosts(args);
          case "scrape_profile":
            return await this.handleScrapeProfile(args);
          case "scrape_comments":
            return await this.handleScrapeComments(args);
          case "search_twitter":
            return await this.handleSearchTwitter(args);
          case "search_viral":
            return await this.handleSearchViral(args);
          case "scrape_timeline":
            return await this.handleScrapeTimeline(args);
          case "scrape_trending":
            return await this.handleScrapeTrending();
          // Post interaction tools
          case "like_post":
            return await this.handleLikePost(args);
          case "unlike_post":
            return await this.handleUnlikePost(args);
          case "bookmark_post":
            return await this.handleBookmarkPost(args);
          case "unbookmark_post":
            return await this.handleUnbookmarkPost(args);
          case "retweet_post":
            return await this.handleRetweetPost(args);
          case "unretweet_post":
            return await this.handleUnretweetPost(args);
          case "quote_tweet":
            return await this.handleQuoteTweet(args);
          case "reply_to_post":
            return await this.handleReplyToPost(args);
          // Comment interaction tools
          case "like_comment_by_id":
            return await this.handleLikeCommentById(args);
          case "unlike_comment_by_id":
            return await this.handleUnlikeCommentById(args);
          case "reply_to_comment_by_id":
            return await this.handleReplyToCommentById(args);
          case "replace_comment_by_id":
            return await this.handleReplaceCommentById(args);
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        return this.handleError(error);
      }
    });
  }

  // Tool handlers
  private async handleTweet(args: unknown) {
    const result = TweetSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${result.error.message}`);
    }

    const tweetData: TweetWithMedia = {
      text: result.data.text,
      media: result.data.media,
    };
    const page = await this.ensureAuthenticated();
    await postTweet(page, tweetData);
    return {
      content: [
        {
          type: "text",
          text: `Tweet posted successfully: "${result.data.text}"${
            result.data.media ? ` with ${result.data.media.length} media file(s)` : ""
          }`,
        },
      ] as TextContent[],
    };
  }

  private async handleThread(args: unknown) {
    const result = ThreadSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${result.error.message}`);
    }

    const page = await this.ensureAuthenticated();
    await postThread(page, result.data.tweets);

    // Count tweets and media
    let mediaCount = 0;
    result.data.tweets.forEach((tweet) => {
      if (tweet.media && Array.isArray(tweet.media)) {
        mediaCount += tweet.media.length;
      }
    });

    return {
      content: [
        {
          type: "text",
          text: `Thread posted successfully with ${result.data.tweets.length} tweets${
            mediaCount > 0 ? ` and ${mediaCount} media file(s)` : ""
          }`,
        },
      ] as TextContent[],
    };
  }

  private async handleScrapePosts(args: unknown) {
    const result = ScrapePostsSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${result.error.message}`);
    }

    const page = await this.ensureAuthenticated();
    const posts = await scrapePosts(page, {
      maxPosts: result.data.maxPosts,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              count: posts.length,
              posts: posts.map((post) => ({
                author: post.author.username,
                content: post.content.substring(0, 100) + "...",
                likes: post.metrics.likesCount,
                retweets: post.metrics.retweetsCount,
                engagement: post.engagementRate.toFixed(2) + "%",
                url: post.url,
              })),
            },
            null,
            2
          ),
        },
      ] as TextContent[],
    };
  }

  private async handleScrapeProfile(args: unknown) {
    const result = ScrapeProfileSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${result.error.message}`);
    }

    const page = await this.ensureAuthenticated();
    const profile = await scrapeProfile(page, result.data.username, {
      maxPosts: result.data.maxPosts,
    });

    if (!profile) {
      throw new McpError(
        ErrorCode.InternalError,
        `Could not find profile for @${result.data.username}`
      );
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              username: profile.username,
              displayName: profile.displayName,
              bio: profile.bio,
              followers: profile.followersCount,
              following: profile.followingCount,
              posts: profile.postsCount,
              verified: profile.isVerified,
              latestPosts: profile.latestPosts?.map((post) => ({
                content: post.content.substring(0, 100) + "...",
                likes: post.metrics.likesCount,
                retweets: post.metrics.retweetsCount,
              })),
            },
            null,
            2
          ),
        },
      ] as TextContent[],
    };
  }

  private async handleScrapeComments(args: unknown) {
    const result = ScrapeCommentsSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${result.error.message}`);
    }

    const page = await this.ensureAuthenticated();
    const comments = await scrapeComments(page, result.data.postUrl, {
      maxPosts: result.data.maxComments, // maxPosts is used as maxComments in the function
    });

    const topComments = getTopComments(comments, 5);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              totalComments: comments.length,
              topComments: topComments.map((comment) => ({
                author: comment.author.username,
                content: comment.content,
                likes: comment.likesCount,
                replies: comment.repliesCount,
              })),
            },
            null,
            2
          ),
        },
      ] as TextContent[],
    };
  }

  private async handleSearchTwitter(args: unknown) {
    const result = SearchTwitterSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${result.error.message}`);
    }

    const page = await this.ensureAuthenticated();
    const posts = await searchTwitter(
      page,
      { query: result.data.query },
      {
        maxPosts: result.data.maxPosts,
      }
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              query: result.data.query,
              count: posts.length,
              posts: posts.map((post) => ({
                author: post.author.username,
                content: post.content.substring(0, 100) + "...",
                likes: post.metrics.likesCount,
                retweets: post.metrics.retweetsCount,
                engagement: post.engagementRate.toFixed(2) + "%",
                url: post.url,
              })),
            },
            null,
            2
          ),
        },
      ] as TextContent[],
    };
  }

  private async handleSearchViral(args: unknown) {
    const result = SearchViralSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${result.error.message}`);
    }

    const page = await this.ensureAuthenticated();
    const posts = await searchTwitter(
      page,
      SearchPresets.viral(result.data.query, result.data.minLikes),
      { maxPosts: result.data.maxPosts }
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              query: result.data.query,
              minLikes: result.data.minLikes,
              count: posts.length,
              posts: posts.map((post) => ({
                author: post.author.username,
                content: post.content.substring(0, 100) + "...",
                likes: post.metrics.likesCount,
                retweets: post.metrics.retweetsCount,
                engagement: post.engagementRate.toFixed(2) + "%",
                url: post.url,
              })),
            },
            null,
            2
          ),
        },
      ] as TextContent[],
    };
  }

  private async handleScrapeTimeline(args: unknown) {
    const result = ScrapeTimelineSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${result.error.message}`);
    }

    const page = await this.ensureAuthenticated();
    const posts = await scrapeTimeline(page, result.data.type as any, {
      maxPosts: result.data.maxPosts,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              timeline: result.data.type,
              count: posts.length,
              avgEngagement:
                (posts.reduce((sum, post) => sum + post.engagementRate, 0) / posts.length).toFixed(
                  2
                ) + "%",
              posts: posts.map((post) => ({
                author: post.author.username,
                content: post.content.substring(0, 100) + "...",
                likes: post.metrics.likesCount,
                retweets: post.metrics.retweetsCount,
                engagement: post.engagementRate.toFixed(2) + "%",
              })),
            },
            null,
            2
          ),
        },
      ] as TextContent[],
    };
  }

  private async handleScrapeTrending() {
    const page = await this.ensureAuthenticated();
    const trends = await scrapeTrendingTopics(page);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              trendingTopics: trends,
            },
            null,
            2
          ),
        },
      ] as TextContent[],
    };
  }

  private async handleError(error: unknown) {
    if (this.authenticatedPage && process.env.DEBUG_WEBHOOK_URL) {
      try {
        const filePath = "debug_screenshot.png";
        this.authenticatedPage?.screenshot({ path: filePath });
        const fileBuffer = readFileSync(filePath);
        await fetch(process.env.DEBUG_WEBHOOK_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename=\"${filePath}\"`,
          },
          body: fileBuffer,
        });
        unlinkSync(filePath);
      } catch {}
    }

    if (error instanceof McpError) {
      throw error;
    }

    console.error("Unexpected error:", error);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        },
      ] as TextContent[],
      isError: true,
    };
  }

  // Post interaction handlers
  private async handleLikePost(args: unknown) {
    const result = LikePostSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${result.error.message}`);
    }

    const page = await this.ensureAuthenticated();
    const success = await likePost(page, result.data.postUrl);

    return {
      content: [
        {
          type: "text",
          text: success
            ? `Successfully liked post: ${result.data.postUrl}`
            : `Post was already liked: ${result.data.postUrl}`,
        },
      ] as TextContent[],
    };
  }

  private async handleUnlikePost(args: unknown) {
    const result = UnlikePostSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${result.error.message}`);
    }

    const page = await this.ensureAuthenticated();
    const success = await unlikePost(page, result.data.postUrl);

    return {
      content: [
        {
          type: "text",
          text: success
            ? `Successfully unliked post: ${result.data.postUrl}`
            : `Post was not liked: ${result.data.postUrl}`,
        },
      ] as TextContent[],
    };
  }

  private async handleBookmarkPost(args: unknown) {
    const result = BookmarkPostSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${result.error.message}`);
    }

    const page = await this.ensureAuthenticated();
    await bookmarkPost(page, result.data.postUrl);

    return {
      content: [
        {
          type: "text",
          text: `Successfully bookmarked post: ${result.data.postUrl}`,
        },
      ] as TextContent[],
    };
  }

  private async handleUnbookmarkPost(args: unknown) {
    const result = UnbookmarkPostSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${result.error.message}`);
    }

    const page = await this.ensureAuthenticated();
    await unbookmarkPost(page, result.data.postUrl);

    return {
      content: [
        {
          type: "text",
          text: `Successfully removed bookmark from post: ${result.data.postUrl}`,
        },
      ] as TextContent[],
    };
  }

  private async handleRetweetPost(args: unknown) {
    const result = RetweetPostSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${result.error.message}`);
    }

    const page = await this.ensureAuthenticated();
    await retweetPost(page, result.data.postUrl);

    return {
      content: [
        {
          type: "text",
          text: `Successfully retweeted post: ${result.data.postUrl}`,
        },
      ] as TextContent[],
    };
  }

  private async handleUnretweetPost(args: unknown) {
    const result = UnretweetPostSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${result.error.message}`);
    }

    const page = await this.ensureAuthenticated();
    await unretweetPost(page, result.data.postUrl);

    return {
      content: [
        {
          type: "text",
          text: `Successfully unretweeted post: ${result.data.postUrl}`,
        },
      ] as TextContent[],
    };
  }

  private async handleQuoteTweet(args: unknown) {
    const result = QuoteTweetSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${result.error.message}`);
    }

    const page = await this.ensureAuthenticated();
    await quoteTweet(page, result.data.postUrl, result.data.quoteText);

    return {
      content: [
        {
          type: "text",
          text: `Successfully quote tweeted: "${result.data.quoteText}" on post ${result.data.postUrl}`,
        },
      ] as TextContent[],
    };
  }

  private async handleReplyToPost(args: unknown) {
    const result = ReplyToPostSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${result.error.message}`);
    }

    const page = await this.ensureAuthenticated();
    await replyToPost(page, result.data.postUrl, result.data.replyText);

    return {
      content: [
        {
          type: "text",
          text: `Successfully replied to post ${result.data.postUrl} with: "${result.data.replyText}"`,
        },
      ] as TextContent[],
    };
  }

  // Comment interaction handlers
  private async handleLikeCommentById(args: unknown) {
    const result = LikeCommentByIdSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${result.error.message}`);
    }

    const page = await this.ensureAuthenticated();
    await likeCommentById(page, result.data.commentUrl);

    return {
      content: [
        {
          type: "text",
          text: `Successfully liked comment: ${result.data.commentUrl}`,
        },
      ] as TextContent[],
    };
  }

  private async handleUnlikeCommentById(args: unknown) {
    const result = UnlikeCommentByIdSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${result.error.message}`);
    }

    const page = await this.ensureAuthenticated();
    await unlikeCommentById(page, result.data.commentUrl);

    return {
      content: [
        {
          type: "text",
          text: `Successfully unliked comment: ${result.data.commentUrl}`,
        },
      ] as TextContent[],
    };
  }

  private async handleReplyToCommentById(args: unknown) {
    const result = ReplyToCommentByIdSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${result.error.message}`);
    }

    const page = await this.ensureAuthenticated();
    await replyToCommentById(page, result.data.commentUrl, result.data.replyText);

    return {
      content: [
        {
          type: "text",
          text: `Successfully replied to comment ${result.data.commentUrl} with: "${result.data.replyText}"`,
        },
      ] as TextContent[],
    };
  }

  private async handleReplaceCommentById(args: unknown) {
    const result = ReplaceCommentByIdSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${result.error.message}`);
    }

    const page = await this.ensureAuthenticated();
    await replaceCommentById(page, result.data.commentUrl, result.data.newText);

    return {
      content: [
        {
          type: "text",
          text: `Successfully replaced comment: ${result.data.commentUrl} with: "${result.data.newText}"`,
        },
      ] as TextContent[],
    };
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Twitter Playwright MCP server running on stdio");
  }

  async startSSE(port: number = 3000): Promise<void> {
    const app = express();
    app.use(express.json());

    // Store transports for multiple connections
    const transports: { [sessionId: string]: SSEServerTransport } = {};

    // SSE connection endpoint
    app.get("/sse", async (_req, res) => {
      const transport = new SSEServerTransport("/messages", res);
      transports[transport.sessionId] = transport;

      res.on("close", () => {
        console.error(`SSE connection closed: ${transport.sessionId}`);
        delete transports[transport.sessionId];
      });

      await this.server.connect(transport);
      console.error(`SSE connection established: ${transport.sessionId}`);
    });

    // Message handling endpoint
    app.post("/messages", async (req, res) => {
      const sessionId = req.query.sessionId as string;
      const transport = transports[sessionId];

      if (transport) {
        await transport.handlePostMessage(req, res, req.body);
      } else {
        res.status(400).send("No transport found for sessionId");
      }
    });

    app.get("/ping", (_req, res) => {
      res.send("pong");
    });

    app.listen(port, () => {
      console.error(`Twitter Playwright MCP server running on HTTP port ${port}`);
      console.error(`SSE endpoint: http://localhost:${port}/sse`);
      console.error(`Messages endpoint: http://localhost:${port}/messages`);
    });
  }
}

if (require.main === module) {
  const server = new TwitterMCPServer();

  const useSSE = process.env.MCP_TRANSPORT === "sse" || process.env.MCP_TRANSPORT === "http";
  const port = parseInt(process.env.MCP_PORT || "3000");

  if (useSSE) {
    server.startSSE(port).catch((error) => {
      console.error("Failed to start SSE server:", error);
      process.exit(1);
    });
  } else {
    server.start().catch((error) => {
      console.error("Failed to start server:", error);
      process.exit(1);
    });
  }
}
