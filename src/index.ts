import { followFromExplore } from "./follow-from-explore";
import { followFromFollowing } from "./follow-from-following";
import { likeFromExplore } from "./like-from-explore";
import { login, getAuthenticatedPage } from "./login";
import { thread } from "./thread";
import { tweet } from "./tweet";
import { TweetWithMedia } from "./types";
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
  monitorTimeline,
  getPostsFromUsers,
  TwitterPost,
  TwitterProfile,
  TwitterComment
} from "./scrapers";

// Helper functions to print data
function printPosts(posts: TwitterPost[]) {
  posts.forEach((post, i) => {
    console.log(`\n--- Post ${i + 1} ---`);
    console.log(`Author: @${post.author.username} (${post.author.displayName})`);
    console.log(`Content: ${post.content.substring(0, 100)}...`);
    console.log(`Likes: ${post.metrics.likesCount}, Retweets: ${post.metrics.retweetsCount}`);
    console.log(`Engagement Rate: ${post.engagementRate.toFixed(2)}%`);
    console.log(`URL: ${post.url}`);
  });
}

function printProfile(profile: TwitterProfile) {
  console.log(`Username: @${profile.username}`);
  console.log(`Display Name: ${profile.displayName}`);
  console.log(`Bio: ${profile.bio}`);
  console.log(`Followers: ${profile.followersCount}, Following: ${profile.followingCount}`);
  console.log(`Posts: ${profile.postsCount}`);
  console.log(`Verified: ${profile.isVerified ? 'Yes' : 'No'}`);
  if (profile.latestPosts) {
    console.log(`\nLatest Posts (${profile.latestPosts.length}):`);
    printPosts(profile.latestPosts);
  }
}

function printComments(comments: TwitterComment[]) {
  comments.forEach((comment, i) => {
    console.log(`\n--- Comment ${i + 1} ---`);
    console.log(`Author: @${comment.author.username}`);
    console.log(`Content: ${comment.content}`);
    console.log(`Likes: ${comment.likesCount}, Replies: ${comment.repliesCount}`);
  });
}

(async () => {
  const [, , command, ...params] = process.argv;

  switch (command) {
    case "login":
      await login();
      break;
    case "tweet":
      // Support: npm run twitter tweet "text" [media1] [media2] ...
      const tweetText = params[0];
      const tweetMedia = params.slice(1);
      if (!tweetText) {
        console.error("Please provide tweet text");
        console.error("Usage: npm run twitter tweet \"Your tweet text\" [media1.jpg] [media2.png] ...");
        break;
      }
      const tweetData: TweetWithMedia = {
        text: tweetText,
        media: tweetMedia.length > 0 ? tweetMedia : undefined
      };
      await tweet(tweetData);
      break;
    case "follow-from-following":
      await followFromFollowing();
      break;
    case "thread":
      await thread();
      break;
    case "like-from-explore":
      await likeFromExplore(params[0]);
      break;
    case "follow-from-explore":
      await followFromExplore(params[0]);
      break;
    case "scrape":
      // Handle scraping commands
      const scrapeCommand = params[0];
      const scrapeArgs = params.slice(1);
      
      const { page, close } = await getAuthenticatedPage();
      
      try {
        switch (scrapeCommand) {
          case "posts":
            await scrapePosts(page, {
              maxPosts: parseInt(scrapeArgs[0]) || 10
            }).then(posts => {
              console.log("\nScraped Posts:");
              printPosts(posts);
            });
            break;
            
          case "profile":
            const username = scrapeArgs[0];
            if (!username) {
              console.error("Please provide a username");
              break;
            }
            await scrapeProfile(page, username, {
              maxPosts: parseInt(scrapeArgs[1]) || 5
            }).then(profile => {
              if (profile) {
                console.dir(profile, { depth: null });
                console.log("\nProfile Data:");
                printProfile(profile);
              }
            });
            break;
            
          case "comments":
            const postUrl = scrapeArgs[0];
            if (!postUrl) {
              console.error("Please provide a post URL");
              break;
            }
            await scrapeComments(page, postUrl, {
              maxPosts: parseInt(scrapeArgs[1]) || 20
            }).then(comments => {
              console.log("\nComments:");
              printComments(comments);
            });
            break;
            
          case "search":
            const query = scrapeArgs[0];
            if (!query) {
              console.error("Please provide a search query");
              break;
            }
            await searchTwitter(page, { query }, {
              maxPosts: parseInt(scrapeArgs[1]) || 10
            }).then(posts => {
              console.log("\nSearch Results:");
              printPosts(posts);
            });
            break;
            
          case "search-viral":
            const viralQuery = scrapeArgs[0];
            if (!viralQuery) {
              console.error("Please provide a search query");
              break;
            }
            await searchTwitter(
              page, 
              SearchPresets.viral(viralQuery, parseInt(scrapeArgs[1]) || 1000),
              { maxPosts: parseInt(scrapeArgs[2]) || 10 }
            ).then(posts => {
              console.log("\nViral Posts:");
              printPosts(posts);
            });
            break;
            
          case "timeline":
            const timelineType = scrapeArgs[0] as any || 'for-you';
            await scrapeTimeline(page, timelineType, {
              maxPosts: parseInt(scrapeArgs[1]) || 10
            }).then(posts => {
              console.log(`\n${timelineType} Timeline:`);
              printPosts(posts);
            });
            break;
            
          case "trending":
            await scrapeTrendingTopics(page).then(trends => {
              console.log("\nTrending Topics:");
              trends.forEach((trend, i) => {
                console.log(`${i + 1}. ${trend}`);
              });
            });
            break;
            
          default:
            console.log(`
Twitter/X Scraper Commands:
  
  posts [count]                    - Scrape posts from current page
  profile <username> [postCount]   - Scrape user profile
  comments <postUrl> [count]       - Scrape comments from a post
  search <query> [count]           - Search for posts
  search-viral <query> [minLikes] [count] - Search for viral posts
  timeline [for-you|following] [count] - Scrape timeline
  trending                         - Get trending topics
  
Examples:
  npm run twitter scrape posts 20
  npm run twitter scrape profile elonmusk 10
  npm run twitter scrape search "machine learning" 15
  npm run twitter scrape timeline following 25
            `);
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        await close();
      }
      break;
      
    case "examples":
      // Handle example commands
      const exampleNumber = params[0];
      
      switch (exampleNumber) {
        case '1':
          // Example 1: Scrape posts from a specific user's profile
          console.log("\n=== Example 1: Scrape User Posts ===");
          const { page: page1, close: close1 } = await getAuthenticatedPage();
          
          try {
            const profile = await scrapeProfile(page1, "elonmusk", {
              maxPosts: 10
            });
            
            if (profile && profile.latestPosts) {
              console.log(`Found ${profile.latestPosts.length} posts from @${profile.username}`);
              
              // Find most engaging post
              const mostEngaging = profile.latestPosts.reduce((prev, current) => 
                current.engagementRate > prev.engagementRate ? current : prev
              );
              
              console.log(`Most engaging post: ${mostEngaging.content.substring(0, 50)}...`);
              console.log(`Engagement rate: ${mostEngaging.engagementRate.toFixed(2)}%`);
            }
          } finally {
            await close1();
          }
          break;
          
        case '2':
          // Example 2: Search for viral posts about a topic
          console.log("\n=== Example 2: Search Viral Posts ===");
          const { page: page2, close: close2 } = await getAuthenticatedPage();
          
          try {
            const posts = await searchTwitter(
              page2,
              SearchPresets.viral("artificial intelligence", 5000),
              { maxPosts: 5 }
            );
            
            console.log(`Found ${posts.length} viral AI posts`);
            posts.forEach(post => {
              console.log(`\n- @${post.author.username}: ${post.content.substring(0, 100)}...`);
              console.log(`  Likes: ${post.metrics.likesCount}, Retweets: ${post.metrics.retweetsCount}`);
            });
          } finally {
            await close2();
          }
          break;
          
        case '3':
          // Example 3: Analyze comments on a post
          console.log("\n=== Example 3: Analyze Post Comments ===");
          const { page: page3, close: close3 } = await getAuthenticatedPage();
          
          try {
            // Replace with an actual tweet URL
            const postUrl = "https://x.com/username/status/1234567890";
            
            const comments = await scrapeComments(page3, postUrl, {
              maxPosts: 50 // maxPosts is used as maxComments
            });
            
            console.log(`Found ${comments.length} comments`);
            
            // Get top 5 comments by engagement
            const topComments = getTopComments(comments, 5);
            console.log("\nTop 5 comments by engagement:");
            topComments.forEach((comment, i) => {
              console.log(`${i + 1}. @${comment.author.username}: ${comment.content.substring(0, 100)}...`);
              console.log(`   Likes: ${comment.likesCount}`);
            });
          } finally {
            await close3();
          }
          break;
          
        case '4':
          // Example 4: Compare timelines
          console.log("\n=== Example 4: Compare Timelines ===");
          const { page: page4, close: close4 } = await getAuthenticatedPage();
          
          try {
            const { forYou, following } = await scrapeBothTimelines(page4, {
              maxPosts: 20
            });
            
            console.log(`For You timeline: ${forYou.length} posts`);
            console.log(`Following timeline: ${following.length} posts`);
            
            // Calculate average engagement
            const avgEngagementForYou = forYou.reduce((sum, post) => 
              sum + post.engagementRate, 0) / forYou.length;
            const avgEngagementFollowing = following.reduce((sum, post) => 
              sum + post.engagementRate, 0) / following.length;
            
            console.log(`\nAverage engagement:`);
            console.log(`For You: ${avgEngagementForYou.toFixed(2)}%`);
            console.log(`Following: ${avgEngagementFollowing.toFixed(2)}%`);
          } finally {
            await close4();
          }
          break;
          
        case '5':
          // Example 5: Monitor timeline for new posts
          console.log("\n=== Example 5: Monitor Timeline ===");
          const { page: page5, close: close5 } = await getAuthenticatedPage();
          
          try {
            console.log("Monitoring 'For You' timeline for new posts...");
            console.log("Press Ctrl+C to stop monitoring");
            
            const stopMonitoring = await monitorTimeline(
              page5,
              'for-you',
              (newPosts) => {
                console.log(`\n[${new Date().toLocaleTimeString()}] Found ${newPosts.length} new posts:`);
                newPosts.forEach(post => {
                  console.log(`- @${post.author.username}: ${post.content.substring(0, 50)}...`);
                });
              },
              30000 // Check every 30 seconds
            );
            
            // Keep the script running
            await new Promise(() => {});
          } catch (error) {
            console.error("Monitoring stopped:", error);
          } finally {
            await close5();
          }
          break;
          
        case '6':
          // Example 6: Track specific users in timeline
          console.log("\n=== Example 6: Track Specific Users ===");
          const { page: page6, close: close6 } = await getAuthenticatedPage();
          
          try {
            const usersToTrack = ['naval', 'paulg', 'sama'];
            
            const posts = await getPostsFromUsers(
              page6,
              usersToTrack,
              'following',
              { maxPosts: 50 }
            );
            
            console.log(`Found ${posts.length} posts from tracked users`);
            
            // Group by user
            const postsByUser = posts.reduce((acc, post) => {
              const username = post.author.username;
              if (!acc[username]) acc[username] = [];
              acc[username].push(post);
              return acc;
            }, {} as Record<string, typeof posts>);
            
            Object.entries(postsByUser).forEach(([username, userPosts]) => {
              console.log(`\n@${username}: ${userPosts.length} posts`);
              console.log(`Latest: ${userPosts[0].content.substring(0, 100)}...`);
            });
          } finally {
            await close6();
          }
          break;
          
        case '7':
          // Example 7: Export data to JSON
          console.log("\n=== Example 7: Export Data to JSON ===");
          const { page: page7, close: close7 } = await getAuthenticatedPage();
          
          try {
            // Scrape multiple profiles
            const usernames = ['elonmusk', 'BillGates', 'sundarpichai'];
            const profiles = [];
            
            for (const username of usernames) {
              console.log(`Scraping @${username}...`);
              const profile = await scrapeProfile(page7, username, { maxPosts: 5 });
              if (profile) profiles.push(profile);
              await page7.waitForTimeout(2000); // Rate limiting
            }
            
            // Save to JSON file
            const fs = await import('fs').then(m => m.promises);
            await fs.writeFile(
              'twitter-profiles.json',
              JSON.stringify(profiles, null, 2)
            );
            
            console.log(`Exported ${profiles.length} profiles to twitter-profiles.json`);
          } finally {
            await close7();
          }
          break;
          
        default:
          console.log(`
Twitter/X Scraping Examples:

Run with: npm run twitter examples [number]

1. Scrape User Posts - Get posts from a specific user profile
2. Search Viral Posts - Find viral posts about a topic
3. Analyze Comments - Get and analyze comments on a post
4. Compare Timelines - Compare For You vs Following timelines
5. Monitor Timeline - Real-time monitoring for new posts
6. Track Specific Users - Track posts from specific users in timeline
7. Export Data - Export scraped data to JSON

Example: npm run twitter examples 1
          `);
      }
      break;
      
    default:
      console.log("Unknown command");
      console.log("Available commands:");
      console.log("  login                                    - Login to Twitter/X");
      console.log("  tweet <text> [media1] [media2] ...      - Post a tweet with optional media");
      console.log("  thread                                   - Post a thread (reads from messages.jsonl)");
      console.log("  follow-from-following                    - Follow users from your following list");
      console.log("  like-from-explore [query]               - Like posts from explore");
      console.log("  follow-from-explore [query]             - Follow users from explore");
      console.log("  scrape <subcommand>                     - Scrape various data");
      console.log("  examples <number>                       - Run example scripts");
      console.log("\nExamples:");
      console.log('  npm run twitter tweet "Hello Twitter!"');
      console.log('  npm run twitter tweet "Check this out!" image.jpg video.mp4');
      console.log('  npm run twitter thread');
      console.log('  npm run twitter scrape profile elonmusk');
      break;
  }
})();
