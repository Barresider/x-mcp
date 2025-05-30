# X/Twitter MCP Server

A Model Context Protocol (MCP) server that provides unofficial X/Twitter API access through browser automation using Playwright. This server enables AI agents and applications to interact with X/Twitter programmatically for content creation, scraping, and social media automation.

## 🚀 Features

### Content Creation & Interaction
- **Tweet & Thread Posting**: Post single tweets or multi-tweet threads with media support
- **Post Interactions**: Like, unlike, retweet, unretweet, bookmark, quote tweet, and reply to posts
- **Comment Management**: Like, unlike, reply to, and edit comments
- **Media Support**: Upload and attach images, videos, and GIFs to tweets

### Content Scraping & Analysis
- **Timeline Scraping**: Extract posts from "For You" and "Following" timelines
- **Profile Scraping**: Get comprehensive user profile data and recent posts
- **Search Functionality**: Advanced search with filters for viral content, specific users, and date ranges
- **Comment Scraping**: Extract comments and replies from specific posts
- **Trending Topics**: Retrieve current trending topics and hashtags

### MCP Integration
- **Dual Transport Support**: Works with both stdio and HTTP/SSE transports
- **Tool-based Interface**: 20+ tools available for AI agents to interact with X/Twitter
- **Structured Responses**: JSON-formatted responses with comprehensive metadata
- **Error Handling**: Robust error handling with descriptive error messages

## 📋 Prerequisites

- Node.js 18+ 
- Valid X/Twitter account credentials
- Docker (optional, for containerized deployment)

## Quick Start

1. Add this configuration to your Claude Desktop config file:

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`  
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "x-mcp": {
      "command": "npx",
      "args": ["-y", "@barresider/x-mcp"],
      "env": {
        "TWITTER_USERNAME": "your_twitter_username",
        "TWITTER_PASSWORD": "your_twitter_password"
      }
    }
  }
}
```

With proxy (optional):
```json
{
  "mcpServers": {
    "x-mcp": {
      "command": "npx",
      "args": ["-y", "@barresider/x-mcp"],
      "env": {
        "TWITTER_USERNAME": "your_twitter_username",
        "TWITTER_PASSWORD": "your_twitter_password",
        "PROXY_URL": "http://proxy-server:port"
      }
    }
  }
}
```

2. Restart Claude Desktop

That's it! Claude can now interact with X/Twitter through 25+ powerful tools including:

- `tweet`: Post a new tweet with optional media
- `thread`: Post a multi-tweet thread
- `search_twitter`: Search for tweets with advanced filters
- `scrape_profile`: Get comprehensive user profile data
- `scrape_timeline`: Extract posts from timelines
- `like_post`, `retweet_post`, `bookmark_post`: Interact with posts
- And many more for comprehensive X/Twitter automation

## Example Usage

Try asking Claude:
- "Can you post a tweet saying 'Hello from Claude!'"
- "Can you search for tweets about Claude AI?"
- "Can you scrape Elon Musk's profile and show me his latest 5 tweets?"
- "Can you post a thread about the benefits of AI?"

## 🛠️ Installation

### Local Development Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd x-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

### Docker Installation

1. Build the Docker image:
```bash
docker build -t x-mcp .
```

2. Or use Docker Compose:
```bash
docker-compose --profile mcp up --build
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Required: X/Twitter credentials
TWITTER_USERNAME=your_username
TWITTER_PASSWORD=your_password

# Optional: Proxy configuration
PROXY_URL=http://proxy-server:port          # Full proxy URL (supports http/https)
# or with authentication
PROXY_URL=http://username:password@proxy-server:port
# or separately
PROXY_URL=http://proxy-server:port
PROXY_USERNAME=proxy_username               # Optional: separate username
PROXY_PASSWORD=proxy_password               # Optional: separate password

# Optional: MCP server configuration
MCP_TRANSPORT=stdio           # Options: stdio, sse, http
MCP_PORT=3000                # Port for HTTP/SSE transport

# Optional: Directory for authentication state (default: playwright/.auth)
AUTH_DIR=playwright/.auth
```

### Authentication Setup

1. (Optional) Create authentication directory or set `AUTH_DIR` environment variable:
```bash
export AUTH_DIR=/path/to/auth/dir
mkdir -p "${AUTH_DIR:-playwright/.auth}"
```

2. Login to X/Twitter (stores session for reuse):
```bash
npm run cli login
# or
node dist/cli.js login
```

## 🔧 Available MCP Tools

The server provides 25+ tools for comprehensive X/Twitter interaction:

### Authentication & Setup
- `login` - Authenticate with X/Twitter

### Content Creation
- `tweet` - Post a single tweet with optional media
- `thread` - Post a multi-tweet thread
- `reply_to_post` - Reply to a specific post
- `quote_tweet` - Quote tweet with additional text

### Post Interactions
- `like_post` / `unlike_post` - Like/unlike posts
- `retweet_post` / `unretweet_post` - Retweet/unretweet posts
- `bookmark_post` / `unbookmark_post` - Bookmark management

### Comment Interactions
- `like_comment_by_id` / `unlike_comment_by_id` - Like/unlike comments
- `reply_to_comment_by_id` - Reply to comments
- `replace_comment_by_id` - Edit comments (if supported)

### Content Scraping
- `scrape_posts` - Scrape posts from current page
- `scrape_profile` - Get user profile and recent posts
- `scrape_comments` - Extract comments from posts
- `scrape_timeline` - Scrape For You/Following timelines
- `scrape_trending` - Get trending topics
- `search_twitter` - General search functionality
- `search_viral` - Search for viral content with minimum engagement

## 📊 Data Structures

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
  quotedPost?: TwitterPost;
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
  isFollowing?: boolean;
  isFollowedBy?: boolean;
  latestPosts?: TwitterPost[];
}
```

### PostMetrics
```typescript
interface PostMetrics {
  likesCount: number;
  retweetsCount: number;
  quotesCount: number;
  repliesCount: number;
  impressionsCount: number;
  bookmarksCount: number;
}
```

## 🔒 Security & Best Practices

### Rate Limiting
- Implement delays between requests to avoid rate limiting
- Use reasonable limits for scraping operations
- Monitor for rate limit responses

### Authentication
- Store credentials securely in environment variables
- Session data is stored in the directory specified by the `AUTH_DIR` environment variable (default `playwright/.auth/`)
- Regular re-authentication may be required

### Error Handling
- All operations include comprehensive error handling
- Descriptive error messages for troubleshooting
- Graceful degradation for missing elements

### Proxy Configuration
- Supports HTTP/HTTPS proxies for all browser connections
- Configure via `PROXY_URL` environment variable
- Supports authentication with username/password
- Useful for:
  - Rotating IP addresses to avoid rate limits
  - Accessing X/Twitter from restricted networks
  - Adding an extra layer of anonymity
- Example formats:
  - Basic: `http://proxy-server:port`
  - With auth: `http://username:password@proxy-server:port`
  - Separate auth: Use `PROXY_USERNAME` and `PROXY_PASSWORD`

## 🐳 Docker Deployment

### Using Docker Compose
```bash
# Start the MCP server
docker-compose --profile mcp up

# With environment variables
TWITTER_USERNAME=your_username TWITTER_PASSWORD=your_password docker-compose --profile mcp up
```

### Custom Docker Run
```bash
docker run -d \
  --name x-mcp \
  -e TWITTER_USERNAME=your_username \
  -e TWITTER_PASSWORD=your_password \
  -e PROXY_URL=http://proxy-server:port \
  -e MCP_TRANSPORT=sse \
  -e MCP_PORT=3000 \
  -p 3000:3000 \
  x-mcp
```

## 🛠️ Development

### Project Structure
```
src/
├── mcp.ts                    # Main MCP server implementation
├── cli.ts                    # Command line interface
├── types.ts                  # TypeScript type definitions
├── utils.ts                  # Utility functions
├── behaviors/                # User interaction behaviors
│   ├── login.ts             # Authentication logic
│   ├── interact-with-post.ts # Post interaction functions
│   ├── interact-with-comment.ts # Comment interaction functions
│   └── upload-media.ts      # Media upload functionality
└── scrapers/                # Data scraping modules
    ├── index.ts             # Scraper exports
    ├── post-scraper.ts      # Post scraping logic
    ├── profile-scraper.ts   # Profile scraping logic
    ├── comment-scraper.ts   # Comment scraping logic
    ├── search-scraper.ts    # Search functionality
    ├── timeline-scraper.ts  # Timeline scraping
    └── utils.ts             # Scraping utilities
```

### Building and Testing
```bash
# Build TypeScript
npm run build

# Run MCP server
npm run mcp

# Run CLI commands
npm run cli <command>
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Guidelines
- Follow TypeScript best practices
- Add comprehensive error handling
- Update type definitions for new features
- Test with real X/Twitter interactions
- Document new functionality

## ⚠️ Disclaimers

- This is an unofficial tool using browser automation
- X/Twitter's terms of service apply
- Use responsibly and respect rate limits
- UI changes may require updates to selectors
- Not affiliated with X/Twitter

## 📄 License

[License information here]

## 🐛 Troubleshooting

### Common Issues

**Authentication Failures**
- Verify credentials in `.env` file
- Try logging in again with `npm run cli login`
- Check for 2FA requirements

**Element Not Found Errors**
- X/Twitter may have updated their UI
- Clear browser cache and re-authenticate
- Check for element selector updates

**Rate Limiting**
- Reduce request frequency
- Add delays between operations
- Use smaller batch sizes

**Container Issues**
- Ensure proper environment variables
- Check port availability
- Verify Docker network configuration

For more help, please open an issue on the project repository.
