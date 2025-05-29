#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  Tool,
  ErrorCode,
  McpError,
  TextContent
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { Page } from 'playwright';

// Import all the functions from your existing scripts
import { followFromExplore } from "./follow-from-explore";
import { followFromFollowing } from "./follow-from-following";
import { likeFromExplore } from "./like-from-explore";
import { login, getAuthenticatedPage } from "./login";
import { thread } from "./thread";
import { tweet } from "./tweet";
import {
  scrapePosts,
  scrapeProfile,
  scrapeComments,
  searchTwitter,
  scrapeTimeline,
  scrapeBothTimelines,
  SearchPresets,
  scrapeTrendingTopics,
  getTopComments,
  TwitterPost,
  TwitterProfile,
  TwitterComment
} from "./scrapers";

// Validation schemas using Zod
const LoginSchema = z.object({});

const TweetSchema = z.object({
  text: z.string().min(1).max(280).describe("The text content of the tweet")
});

const ThreadSchema = z.object({
  tweets: z.array(z.string()).min(2).describe("Array of tweet texts for the thread")
});

const FollowFromFollowingSchema = z.object({
  count: z.number().min(1).max(50).optional().default(10).describe("Number of users to follow")
});

const LikeFromExploreSchema = z.object({
  query: z.string().optional().describe("Search query for explore section")
});

const FollowFromExploreSchema = z.object({
  query: z.string().optional().describe("Search query for explore section")
});

const ScrapePostsSchema = z.object({
  maxPosts: z.number().min(1).max(100).optional().default(10).describe("Maximum number of posts to scrape")
});

const ScrapeProfileSchema = z.object({
  username: z.string().describe("Username to scrape (without @)"),
  maxPosts: z.number().min(1).max(50).optional().default(5).describe("Maximum number of posts to include")
});

const ScrapeCommentsSchema = z.object({
  postUrl: z.string().url().describe("URL of the post to scrape comments from"),
  maxComments: z.number().min(1).max(100).optional().default(20).describe("Maximum number of comments to scrape")
});

const SearchTwitterSchema = z.object({
  query: z.string().describe("Search query"),
  maxPosts: z.number().min(1).max(100).optional().default(10).describe("Maximum number of posts to return")
});

const SearchViralSchema = z.object({
  query: z.string().describe("Search query"),
  minLikes: z.number().min(100).optional().default(1000).describe("Minimum number of likes for viral posts"),
  maxPosts: z.number().min(1).max(100).optional().default(10).describe("Maximum number of posts to return")
});

const ScrapeTimelineSchema = z.object({
  type: z.enum(['for-you', 'following']).optional().default('for-you').describe("Timeline type to scrape"),
  maxPosts: z.number().min(1).max(100).optional().default(10).describe("Maximum number of posts to scrape")
});

export class TwitterMCPServer {
  private server: Server;
  private authenticatedPage: Page | null = null;
  private browserContextClose: (() => Promise<void>) | null = null;

  constructor() {
    this.server = new Server({
      name: 'twitter-playwright-mcp',
      version: '1.0.0'
    }, {
      capabilities: {
        tools: {}
      }
    });

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Error handler
    this.server.onerror = (error) => {
      console.error('[MCP Error]:', error);
    };

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.error('Shutting down server...');
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
          name: 'login',
          description: 'Login to Twitter/X',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          }
        } as Tool,
        {
          name: 'tweet',
          description: 'Post a tweet to Twitter/X',
          inputSchema: {
            type: 'object',
            properties: {
              text: {
                type: 'string',
                description: 'The text content of the tweet',
                maxLength: 280,
                minLength: 1
              }
            },
            required: ['text']
          }
        } as Tool,
        {
          name: 'thread',
          description: 'Post a thread of tweets',
          inputSchema: {
            type: 'object',
            properties: {
              tweets: {
                type: 'array',
                description: 'Array of tweet texts for the thread',
                items: {
                  type: 'string'
                },
                minItems: 2
              }
            },
            required: ['tweets']
          }
        } as Tool,
        {
          name: 'follow_from_following',
          description: 'Follow users from your following list',
          inputSchema: {
            type: 'object',
            properties: {
              count: {
                type: 'number',
                description: 'Number of users to follow',
                minimum: 1,
                maximum: 50,
                default: 10
              }
            },
            required: []
          }
        } as Tool,
        {
          name: 'like_from_explore',
          description: 'Like posts from the explore section',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query for explore section'
              }
            },
            required: []
          }
        } as Tool,
        {
          name: 'follow_from_explore',
          description: 'Follow users from the explore section',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query for explore section'
              }
            },
            required: []
          }
        } as Tool,
        {
          name: 'scrape_posts',
          description: 'Scrape posts from current page',
          inputSchema: {
            type: 'object',
            properties: {
              maxPosts: {
                type: 'number',
                description: 'Maximum number of posts to scrape',
                minimum: 1,
                maximum: 100,
                default: 10
              }
            },
            required: []
          }
        } as Tool,
        {
          name: 'scrape_profile',
          description: 'Scrape a user profile',
          inputSchema: {
            type: 'object',
            properties: {
              username: {
                type: 'string',
                description: 'Username to scrape (without @)'
              },
              maxPosts: {
                type: 'number',
                description: 'Maximum number of posts to include',
                minimum: 1,
                maximum: 50,
                default: 5
              }
            },
            required: ['username']
          }
        } as Tool,
        {
          name: 'scrape_comments',
          description: 'Scrape comments from a post',
          inputSchema: {
            type: 'object',
            properties: {
              postUrl: {
                type: 'string',
                description: 'URL of the post to scrape comments from'
              },
              maxComments: {
                type: 'number',
                description: 'Maximum number of comments to scrape',
                minimum: 1,
                maximum: 100,
                default: 20
              }
            },
            required: ['postUrl']
          }
        } as Tool,
        {
          name: 'search_twitter',
          description: 'Search for tweets',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query'
              },
              maxPosts: {
                type: 'number',
                description: 'Maximum number of posts to return',
                minimum: 1,
                maximum: 100,
                default: 10
              }
            },
            required: ['query']
          }
        } as Tool,
        {
          name: 'search_viral',
          description: 'Search for viral posts',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query'
              },
              minLikes: {
                type: 'number',
                description: 'Minimum number of likes for viral posts',
                minimum: 100,
                default: 1000
              },
              maxPosts: {
                type: 'number',
                description: 'Maximum number of posts to return',
                minimum: 1,
                maximum: 100,
                default: 10
              }
            },
            required: ['query']
          }
        } as Tool,
        {
          name: 'scrape_timeline',
          description: 'Scrape posts from timeline',
          inputSchema: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                description: 'Timeline type to scrape',
                enum: ['for-you', 'following'],
                default: 'for-you'
              },
              maxPosts: {
                type: 'number',
                description: 'Maximum number of posts to scrape',
                minimum: 1,
                maximum: 100,
                default: 10
              }
            },
            required: []
          }
        } as Tool,
        {
          name: 'scrape_trending',
          description: 'Get trending topics',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          }
        } as Tool
      ]
    }));

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      console.error(`Tool called: ${name}`, args);

      try {
        switch (name) {
          case 'login':
            return await this.handleLogin();
          case 'tweet':
            return await this.handleTweet(args);
          case 'thread':
            return await this.handleThread(args);
          case 'follow_from_following':
            return await this.handleFollowFromFollowing(args);
          case 'like_from_explore':
            return await this.handleLikeFromExplore(args);
          case 'follow_from_explore':
            return await this.handleFollowFromExplore(args);
          case 'scrape_posts':
            return await this.handleScrapePosts(args);
          case 'scrape_profile':
            return await this.handleScrapeProfile(args);
          case 'scrape_comments':
            return await this.handleScrapeComments(args);
          case 'search_twitter':
            return await this.handleSearchTwitter(args);
          case 'search_viral':
            return await this.handleSearchViral(args);
          case 'scrape_timeline':
            return await this.handleScrapeTimeline(args);
          case 'scrape_trending':
            return await this.handleScrapeTrending();
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        return this.handleError(error);
      }
    });
  }

  // Tool handlers
  private async handleLogin() {
    await login();
    return {
      content: [{
        type: 'text',
        text: 'Successfully logged in to Twitter/X'
      }] as TextContent[]
    };
  }

  private async handleTweet(args: unknown) {
    const result = TweetSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${result.error.message}`
      );
    }

    await tweet(result.data.text);
    return {
      content: [{
        type: 'text',
        text: `Tweet posted successfully: "${result.data.text}"`
      }] as TextContent[]
    };
  }

  private async handleThread(args: unknown) {
    const result = ThreadSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${result.error.message}`
      );
    }

    // Note: The current thread function doesn't accept parameters
    // You might need to modify the thread function to accept an array of tweets
    await thread();
    return {
      content: [{
        type: 'text',
        text: 'Thread posted successfully'
      }] as TextContent[]
    };
  }

  private async handleFollowFromFollowing(args: unknown) {
    const result = FollowFromFollowingSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${result.error.message}`
      );
    }

    await followFromFollowing();
    return {
      content: [{
        type: 'text',
        text: `Started following users from your following list`
      }] as TextContent[]
    };
  }

  private async handleLikeFromExplore(args: unknown) {
    const result = LikeFromExploreSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${result.error.message}`
      );
    }

    await likeFromExplore(result.data.query || '');
    return {
      content: [{
        type: 'text',
        text: `Liked posts from explore section${result.data.query ? ` with query: ${result.data.query}` : ''}`
      }] as TextContent[]
    };
  }

  private async handleFollowFromExplore(args: unknown) {
    const result = FollowFromExploreSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${result.error.message}`
      );
    }

    await followFromExplore(result.data.query || '');
    return {
      content: [{
        type: 'text',
        text: `Followed users from explore section${result.data.query ? ` with query: ${result.data.query}` : ''}`
      }] as TextContent[]
    };
  }

  private async handleScrapePosts(args: unknown) {
    const result = ScrapePostsSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${result.error.message}`
      );
    }

    const page = await this.ensureAuthenticated();
    const posts = await scrapePosts(page, {
      maxPosts: result.data.maxPosts
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          count: posts.length,
          posts: posts.map(post => ({
            author: post.author.username,
            content: post.content.substring(0, 100) + '...',
            likes: post.metrics.likesCount,
            retweets: post.metrics.retweetsCount,
            engagement: post.engagementRate.toFixed(2) + '%',
            url: post.url
          }))
        }, null, 2)
      }] as TextContent[]
    };
  }

  private async handleScrapeProfile(args: unknown) {
    const result = ScrapeProfileSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${result.error.message}`
      );
    }

    const page = await this.ensureAuthenticated();
    const profile = await scrapeProfile(page, result.data.username, {
      maxPosts: result.data.maxPosts
    });

    if (!profile) {
      throw new McpError(
        ErrorCode.InternalError,
        `Could not find profile for @${result.data.username}`
      );
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          username: profile.username,
          displayName: profile.displayName,
          bio: profile.bio,
          followers: profile.followersCount,
          following: profile.followingCount,
          posts: profile.postsCount,
          verified: profile.isVerified,
          latestPosts: profile.latestPosts?.map(post => ({
            content: post.content.substring(0, 100) + '...',
            likes: post.metrics.likesCount,
            retweets: post.metrics.retweetsCount
          }))
        }, null, 2)
      }] as TextContent[]
    };
  }

  private async handleScrapeComments(args: unknown) {
    const result = ScrapeCommentsSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${result.error.message}`
      );
    }

    const page = await this.ensureAuthenticated();
    const comments = await scrapeComments(page, result.data.postUrl, {
      maxPosts: result.data.maxComments // maxPosts is used as maxComments in the function
    });

    const topComments = getTopComments(comments, 5);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          totalComments: comments.length,
          topComments: topComments.map(comment => ({
            author: comment.author.username,
            content: comment.content,
            likes: comment.likesCount,
            replies: comment.repliesCount
          }))
        }, null, 2)
      }] as TextContent[]
    };
  }

  private async handleSearchTwitter(args: unknown) {
    const result = SearchTwitterSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${result.error.message}`
      );
    }

    const page = await this.ensureAuthenticated();
    const posts = await searchTwitter(page, { query: result.data.query }, {
      maxPosts: result.data.maxPosts
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          query: result.data.query,
          count: posts.length,
          posts: posts.map(post => ({
            author: post.author.username,
            content: post.content.substring(0, 100) + '...',
            likes: post.metrics.likesCount,
            retweets: post.metrics.retweetsCount,
            engagement: post.engagementRate.toFixed(2) + '%',
            url: post.url
          }))
        }, null, 2)
      }] as TextContent[]
    };
  }

  private async handleSearchViral(args: unknown) {
    const result = SearchViralSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${result.error.message}`
      );
    }

    const page = await this.ensureAuthenticated();
    const posts = await searchTwitter(
      page,
      SearchPresets.viral(result.data.query, result.data.minLikes),
      { maxPosts: result.data.maxPosts }
    );

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          query: result.data.query,
          minLikes: result.data.minLikes,
          count: posts.length,
          posts: posts.map(post => ({
            author: post.author.username,
            content: post.content.substring(0, 100) + '...',
            likes: post.metrics.likesCount,
            retweets: post.metrics.retweetsCount,
            engagement: post.engagementRate.toFixed(2) + '%',
            url: post.url
          }))
        }, null, 2)
      }] as TextContent[]
    };
  }

  private async handleScrapeTimeline(args: unknown) {
    const result = ScrapeTimelineSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${result.error.message}`
      );
    }

    const page = await this.ensureAuthenticated();
    const posts = await scrapeTimeline(page, result.data.type as any, {
      maxPosts: result.data.maxPosts
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          timeline: result.data.type,
          count: posts.length,
          avgEngagement: (posts.reduce((sum, post) => sum + post.engagementRate, 0) / posts.length).toFixed(2) + '%',
          posts: posts.map(post => ({
            author: post.author.username,
            content: post.content.substring(0, 100) + '...',
            likes: post.metrics.likesCount,
            retweets: post.metrics.retweetsCount,
            engagement: post.engagementRate.toFixed(2) + '%'
          }))
        }, null, 2)
      }] as TextContent[]
    };
  }

  private async handleScrapeTrending() {
    const page = await this.ensureAuthenticated();
    const trends = await scrapeTrendingTopics(page);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          trendingTopics: trends
        }, null, 2)
      }] as TextContent[]
    };
  }

  private handleError(error: unknown) {
    if (error instanceof McpError) {
      throw error;
    }

    console.error('Unexpected error:', error);
    return {
      content: [{
        type: 'text',
        text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }] as TextContent[],
      isError: true
    };
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Twitter Playwright MCP server running on stdio');
  }
}

// Start the server if run directly
if (require.main === module) {
  const server = new TwitterMCPServer();
  server.start().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
} 