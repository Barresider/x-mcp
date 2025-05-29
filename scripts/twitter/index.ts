import { followFromExplore } from "./follow-from-explore";
import { followFromFollowing } from "./follow-from-following";
import { likeFromExplore } from "./like-from-explore";
import { login } from "./login";
import { thread } from "./thread";
import { tweet } from "./tweet";

(async () => {
  const [, , command, ...params] = process.argv;

  switch (command) {
    case "login":
      await login();
      break;
    case "tweet":
      await tweet(params[0]);
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
    default:
      console.log("Unknown command");
      break;
  }
})();
