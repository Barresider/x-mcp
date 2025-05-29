# Twitter Playwright MCP Server

This MCP (Model Context Protocol) server provides tools for automating Twitter/X interactions using Playwright.

## Running the Server

```bash
npm run mcp
```

## Available Tools

### Authentication
- **login** - Login to Twitter/X
  - No parameters required
  - Must be called before using other tools

### Posting
- **tweet** - Post a tweet
  - `text` (string, required): The content of the tweet (max 280 characters)

- **thread** - Post a thread of tweets
  - `tweets` (string[], required): Array of tweet texts for the thread (min 2 tweets)

### Engagement
- **follow_from_following** - Follow users from your following list
  - `count` (number, optional): Number of users to follow (1-50, default: 10)

- **like_from_explore** - Like posts from the explore section
  - `query` (string, optional): Search query for explore section

- **follow_from_explore** - Follow users from the explore section
  - `query` (string, optional): Search query for explore section

### Scraping
- **scrape_posts** - Scrape posts from current page
  - `maxPosts` (number, optional): Maximum posts to scrape (1-100, default: 10)

- **scrape_profile** - Scrape a user profile
  - `username` (string, required): Username to scrape (without @)
  - `maxPosts` (number, optional): Maximum posts to include (1-50, default: 5)

- **scrape_comments** - Scrape comments from a post
  - `postUrl` (string, required): URL of the post
  - `maxComments` (number, optional): Maximum comments to scrape (1-100, default: 20)

- **search_twitter** - Search for tweets
  - `query` (string, required): Search query
  - `maxPosts` (number, optional): Maximum posts to return (1-100, default: 10)

- **search_viral** - Search for viral posts
  - `query` (string, required): Search query
  - `minLikes` (number, optional): Minimum likes for viral posts (min: 100, default: 1000)
  - `maxPosts` (number, optional): Maximum posts to return (1-100, default: 10)

- **scrape_timeline** - Scrape posts from timeline
  - `type` (string, optional): Timeline type - 'for-you' or 'following' (default: 'for-you')
  - `maxPosts` (number, optional): Maximum posts to scrape (1-100, default: 10)

- **scrape_trending** - Get trending topics
  - No parameters required

## Usage Example

When connected to an AI assistant that supports MCP:

1. First login:
   ```
   Use the login tool
   ```

2. Post a tweet:
   ```
   Use the tweet tool with text "Hello Twitter from MCP!"
   ```

3. Search for viral AI posts:
   ```
   Use the search_viral tool with query "artificial intelligence" and minLikes 5000
   ```

4. Scrape a user profile:
   ```
   Use the scrape_profile tool with username "elonmusk" and maxPosts 10
   ```

## Notes

- The server maintains a single authenticated browser session
- All scraping tools require authentication (login) first
- The server will gracefully shut down on SIGINT (Ctrl+C)
- Results are returned as formatted JSON for easy parsing 