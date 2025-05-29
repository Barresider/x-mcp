# Twitter/X Scraping with Playwright

This module provides comprehensive scraping functionality for Twitter/X using Playwright. It supports scraping posts, profiles, comments, search results, and timelines with various filtering and monitoring options.

## Features

### 1. Post Scraping
- Scrape posts/tweets from any page
- Extract comprehensive post data including:
  - Author information (username, display name, verification status)
  - Content and media (images, videos, GIFs)
  - Metrics (likes, retweets, replies, impressions, bookmarks)
  - Calculated engagement rate
  - Retweet information
- Automatic scrolling to load more posts
- Configurable post count limits

### 2. Profile Scraping
- Scrape user profile data by username
- Extract:
  - Profile information (avatar, banner, bio, location, website)
  - Follower/following counts
  - Verification status
  - Latest posts (configurable count)
  - Join date
  - Following status

### 3. Comment Scraping
- Scrape all comments/replies from a specific post
- Extract comment metrics and nested replies
- Sort comments by engagement
- Support for comment threads

### 4. Search Scraping
- Use Twitter's advanced search with multiple filters:
  - Keywords and phrases
  - From/to specific users
  - Minimum engagement thresholds
  - Date ranges
  - Language filters
  - Media filters
- Pre-built search presets for common queries
- Trending topics scraping

### 5. Timeline Scraping
- Scrape "For You" and "Following" timelines
- Monitor timelines for new posts in real-time
- Filter posts by specific users
- Compare timeline engagement metrics

## Installation

Ensure you have the required dependencies:

```bash
npm install
```

## Setup

1. Create a `.env` file with your Twitter credentials:
```env
TWITTER_USERNAME=your_username
TWITTER_PASSWORD=your_password
```

2. Login to Twitter:
```bash
npm run twitter login
```

## Usage

### Command Line Interface

The scraper provides a CLI interface for quick operations:

```bash
# Scrape posts from current page
npm run twitter scrape posts [count]

# Scrape user profile
npm run twitter scrape profile <username> [postCount]

# Scrape comments from a post
npm run twitter scrape comments <postUrl> [count]

# Search for posts
npm run twitter scrape search <query> [count]

# Search for viral posts
npm run twitter scrape search-viral <query> [minLikes] [count]

# Scrape timeline
npm run twitter scrape timeline [for-you|following] [count]

# Get trending topics
npm run twitter scrape trending
```

### Examples

```bash
# Get 20 posts from Elon Musk's profile
npm run twitter scrape profile elonmusk 20

# Search for viral AI posts (min 5000 likes)
npm run twitter scrape search-viral "artificial intelligence" 5000 10

# Get comments from a specific post
npm run twitter scrape comments "https://x.com/username/status/1234567890" 50

# Scrape your Following timeline
npm run twitter scrape timeline following 30
```

### Programmatic Usage

```typescript
import { getAuthenticatedPage } from "./twitter/login";
import { 
  scrapeProfile, 
  searchTwitter, 
  SearchPresets,
  scrapeTimeline 
} from "./twitter/scrapers";

async function example() {
  const { page, close } = await getAuthenticatedPage();
  
  try {
    // Scrape a profile with latest posts
    const profile = await scrapeProfile(page, "elonmusk", {
      maxPosts: 10
    });
    
    // Search for viral posts
    const viralPosts = await searchTwitter(
      page,
      SearchPresets.viral("machine learning", 1000),
      { maxPosts: 20 }
    );
    
    // Scrape timeline
    const timelinePosts = await scrapeTimeline(page, 'for-you', {
      maxPosts: 50
    });
    
  } finally {
    await close();
  }
}
```

## Advanced Examples

See the `examples/scraping-examples.ts` file for advanced usage examples:

```bash
# Run specific example
npm run twitter examples [1-7]

# Available examples:
# 1. Scrape User Posts
# 2. Search Viral Posts
# 3. Analyze Comments
# 4. Compare Timelines
# 5. Monitor Timeline (real-time)
# 6. Track Specific Users
# 7. Export Data to JSON
```

## Data Types

### TwitterPost
```typescript
interface TwitterPost {
  postId: string;
  author: TwitterUser;
  content: string;
  timestamp: Date;
  media: TwitterMedia[];
  metrics: PostMetrics;
  engagementRate: number;
  isRetweet?: boolean;
  retweetedFrom?: TwitterUser;
  url: string;
}
```

### TwitterProfile
```typescript
interface TwitterProfile extends TwitterUser {
  bannerUrl?: string;
  bio?: string;
  location?: string;
  website?: string;
  joinedDate?: Date;
  followingCount: number;
  followersCount: number;
  postsCount: number;
  latestPosts?: TwitterPost[];
}
```

### SearchOptions
```typescript
interface SearchOptions {
  query: string;
  fromUser?: string;
  toUser?: string;
  minLikes?: number;
  minRetweets?: number;
  includeReplies?: boolean;
  onlyVerified?: boolean;
  hasMedia?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  language?: string;
}
```

## Rate Limiting

To avoid rate limiting:
- Add delays between requests when scraping multiple profiles
- Use reasonable scroll timeouts
- Don't request too many posts at once
- Monitor for rate limit responses

## Error Handling

The scrapers include error handling for:
- Profile not found
- Network timeouts
- Element not found
- Rate limiting
- Authentication issues

## Notes

- Twitter's UI may change, requiring updates to selectors
- Some metrics may not be available for all posts
- Engagement rates are calculated as: (likes + retweets + replies) / impressions * 100
- The scrapers work with the authenticated user's view of Twitter

## Contributing

When contributing, please:
1. Test your changes thoroughly
2. Update type definitions if needed
3. Add examples for new features
4. Handle errors gracefully
5. Follow the existing code style 