/**
 * Types for Twitter/X scraping
 */

export interface TwitterUser {
  userId: string;
  username: string; // handle without @
  displayName: string;
  avatarUrl?: string;
  isVerified?: boolean;
  isBlueVerified?: boolean;
}

export interface TwitterPost {
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

export interface TwitterMedia {
  type: 'image' | 'video' | 'gif';
  url: string;
  thumbnailUrl?: string;
  duration?: number; // for videos in seconds
}

export interface PostMetrics {
  likesCount: number;
  retweetsCount: number;
  quotesCount: number;
  repliesCount: number;
  impressionsCount: number;
  bookmarksCount: number;
}

export interface TwitterProfile extends TwitterUser {
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

export interface TwitterComment {
  commentId: string;
  author: TwitterUser;
  content: string;
  timestamp: Date;
  likesCount: number;
  repliesCount: number;
  parentCommentId?: string;
  media?: TwitterMedia[];
}

export interface SearchOptions {
  query: string;
  fromUser?: string;
  toUser?: string;
  minLikes?: number;
  minRetweets?: number;
  minReplies?: number;
  includeReplies?: boolean;
  onlyVerified?: boolean;
  hasMedia?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  language?: string;
}

export interface ScrapeOptions {
  maxPosts?: number;
  scrollTimeout?: number;
  waitBetweenScrolls?: number;
} 