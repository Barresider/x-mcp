import { SearchOptions, ScrapeOptions, TwitterMedia, TwitterPost, TwitterUser } from "../types";

const DEFAULT_XQUIK_BASE_URL = "https://xquik.com/api/v1";
const XQUIK_REQUEST_TIMEOUT_MS = 15_000;

type JsonRecord = Record<string, unknown>;

function getXquikApiKey(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const key = env.XQUIK_API_KEY?.trim();
  return key ? key : undefined;
}

function getXquikBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return (env.XQUIK_BASE_URL?.trim() || DEFAULT_XQUIK_BASE_URL).replace(/\/+$/, "");
}

export function isXquikConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(getXquikApiKey(env));
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function numberValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function booleanValue(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value === 1;
  }
  if (typeof value === "string") {
    return ["1", "true", "yes"].includes(value.trim().toLowerCase());
  }
  return false;
}

function firstValue(record: JsonRecord, keys: string[]): unknown {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}

function joinXquikUrl(path: string, params?: URLSearchParams): string {
  const baseUrl = `${getXquikBaseUrl()}/`;
  const url = new URL(path.replace(/^\/+/, ""), baseUrl);
  if (params) {
    for (const [key, value] of params.entries()) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

function buildSearchQuery(options: SearchOptions): string {
  const parts: string[] = [];

  if (options.query) {
    parts.push(options.query);
  }
  if (options.fromUser) {
    parts.push(`from:${options.fromUser.replace("@", "")}`);
  }
  if (options.toUser) {
    parts.push(`to:${options.toUser.replace("@", "")}`);
  }
  if (options.minLikes) {
    parts.push(`min_faves:${options.minLikes}`);
  }
  if (options.minRetweets) {
    parts.push(`min_retweets:${options.minRetweets}`);
  }
  if (options.minReplies) {
    parts.push(`min_replies:${options.minReplies}`);
  }
  if (options.includeReplies === false) {
    parts.push("-filter:replies");
  }
  if (options.onlyVerified) {
    parts.push("filter:verified");
  }
  if (options.hasMedia) {
    parts.push("filter:media");
  }
  if (options.language) {
    parts.push(`lang:${options.language}`);
  }
  if (options.dateFrom) {
    const date = options.dateFrom.toISOString().split("T")[0];
    if (date) {
      parts.push(`since:${date}`);
    }
  }
  if (options.dateTo) {
    const date = options.dateTo.toISOString().split("T")[0];
    if (date) {
      parts.push(`until:${date}`);
    }
  }

  return parts.join(" ").trim();
}

async function xquikFetch(path: string, params?: URLSearchParams): Promise<unknown> {
  const apiKey = getXquikApiKey();
  if (!apiKey) {
    throw new Error("XQUIK_API_KEY is required for the Xquik backend.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), XQUIK_REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(joinXquikUrl(path, params), {
      headers: {
        Accept: "application/json",
        "x-api-key": apiKey,
      },
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Xquik request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  const text = await response.text();
  let body: unknown = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const message = isRecord(body)
      ? stringValue(body.error) || stringValue(body.message) || text.slice(0, 300)
      : text.slice(0, 300);
    throw new Error(`Xquik request failed with HTTP ${response.status}: ${message}`);
  }

  return body;
}

function findArray(payload: unknown, keys: string[]): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (!isRecord(payload)) {
    return [];
  }

  for (const key of keys.concat(["items", "results", "data"])) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value;
    }
    const nested = findArray(value, keys);
    if (nested.length > 0) {
      return nested;
    }
  }

  return [];
}

function normalizeMedia(raw: unknown): TwitterMedia[] {
  const mediaItems = Array.isArray(raw) ? raw : [];
  return mediaItems.flatMap((item): TwitterMedia[] => {
    if (!isRecord(item)) {
      return [];
    }
    const url = stringValue(firstValue(item, ["url", "mediaUrl", "media_url", "videoUrl", "imageUrl"]));
    if (!url) {
      return [];
    }
    const kind = stringValue(firstValue(item, ["type", "mediaType", "media_type"]))?.toLowerCase();
    const type: TwitterMedia["type"] = kind === "video" ? "video" : kind === "gif" ? "gif" : "image";
    return [{
      type,
      url,
      thumbnailUrl: stringValue(firstValue(item, ["thumbnailUrl", "thumbnail_url", "previewImageUrl"])),
      duration: numberValue(firstValue(item, ["duration", "durationSeconds"])),
    }];
  });
}

function normalizeUser(tweet: JsonRecord): TwitterUser {
  const user = isRecord(tweet.user) ? tweet.user : {};
  const author = isRecord(tweet.author) ? tweet.author : {};
  const username = stringValue(firstValue(user, ["username", "screen_name", "screenName"]))
    || stringValue(firstValue(author, ["username", "screen_name", "screenName"]))
    || stringValue(tweet.username)
    || "unknown";

  return {
    userId: stringValue(firstValue(user, ["id", "userId", "user_id"]))
      || stringValue(firstValue(author, ["id", "userId", "user_id"]))
      || stringValue(firstValue(tweet, ["authorId", "author_id", "userId", "user_id"]))
      || username,
    username: username.replace(/^@/, ""),
    displayName: stringValue(firstValue(user, ["name", "displayName"]))
      || stringValue(firstValue(author, ["name", "displayName"]))
      || stringValue(firstValue(tweet, ["name", "displayName"]))
      || username,
    avatarUrl: stringValue(firstValue(user, ["avatarUrl", "profileImageUrl", "profile_image_url"]))
      || stringValue(firstValue(author, ["avatarUrl", "profileImageUrl", "profile_image_url"])),
    isVerified:
      booleanValue(firstValue(user, ["verified", "isVerified"])) ||
      booleanValue(firstValue(author, ["verified", "isVerified"])),
  };
}

function normalizePost(raw: unknown): TwitterPost | null {
  if (!isRecord(raw)) {
    return null;
  }

  const postId = stringValue(firstValue(raw, ["id", "tweetId", "tweet_id", "rest_id"]));
  const content = stringValue(firstValue(raw, ["text", "full_text", "content", "body"]));
  if (!postId || !content) {
    return null;
  }

  const author = normalizeUser(raw);
  const media = normalizeMedia(firstValue(raw, ["media", "extendedMedia", "attachments"]));
  const timestamp = new Date(stringValue(firstValue(raw, ["createdAt", "created_at", "time"])) || Date.now());
  const likesCount = numberValue(firstValue(raw, ["favoriteCount", "favorite_count", "likeCount", "likes"]));
  const retweetsCount = numberValue(firstValue(raw, ["retweetCount", "retweet_count", "retweets"]));
  const quotesCount = numberValue(firstValue(raw, ["quoteCount", "quote_count", "quotes"]));
  const repliesCount = numberValue(firstValue(raw, ["replyCount", "reply_count", "replies"]));
  const impressionsCount = numberValue(firstValue(raw, ["viewCount", "view_count", "views", "impressionCount"]));

  return {
    postId,
    author,
    content,
    timestamp,
    media,
    metrics: {
      likesCount,
      retweetsCount,
      quotesCount,
      repliesCount,
      impressionsCount,
      bookmarksCount: numberValue(firstValue(raw, ["bookmarkCount", "bookmark_count", "bookmarks"])),
    },
    engagementRate: impressionsCount > 0
      ? (likesCount + retweetsCount + repliesCount + quotesCount) / impressionsCount
      : 0,
    isRetweet: booleanValue(firstValue(raw, ["isRetweet", "retweeted"])),
    url: stringValue(raw.url) || `https://x.com/${author.username}/status/${postId}`,
  };
}

function applyLocalFilters(posts: TwitterPost[], options: SearchOptions): TwitterPost[] {
  return posts.filter((post) => {
    if (options.minLikes && post.metrics.likesCount < options.minLikes) {
      return false;
    }
    if (options.minRetweets && post.metrics.retweetsCount < options.minRetweets) {
      return false;
    }
    if (options.minReplies && post.metrics.repliesCount < options.minReplies) {
      return false;
    }
    if (options.hasMedia && post.media.length === 0) {
      return false;
    }
    if (options.onlyVerified && !post.author.isVerified && !post.author.isBlueVerified) {
      return false;
    }
    return true;
  });
}

export async function searchWithXquik(
  searchOptions: SearchOptions,
  scrapeOptions: ScrapeOptions = {},
): Promise<TwitterPost[]> {
  const query = buildSearchQuery(searchOptions);
  if (!query) {
    throw new Error("A search query or filter is required for Xquik search.");
  }

  const params = new URLSearchParams({
    q: query,
    queryType: "Latest",
    limit: String(Math.min(Math.max(scrapeOptions.maxPosts || 10, 1), 100)),
  });
  const payload = await xquikFetch("/x/tweets/search", params);
  const posts = findArray(payload, ["tweets"])
    .map(normalizePost)
    .filter((post): post is TwitterPost => post !== null);

  return applyLocalFilters(posts, searchOptions);
}

export async function fetchXquikTrends(): Promise<string[]> {
  const payload = await xquikFetch("/x/trends", new URLSearchParams({ count: "20" }));
  return findArray(payload, ["trends", "topics"])
    .map((trend) => {
      if (isRecord(trend)) {
        return stringValue(firstValue(trend, ["name", "topic", "hashtag"]));
      }
      return stringValue(trend);
    })
    .filter((trend): trend is string => Boolean(trend));
}
