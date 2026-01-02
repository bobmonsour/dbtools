import { AssetCache } from "@11ty/eleventy-fetch";
import { cacheDuration } from "../../_data/config.js";
import { appendFileSync } from "fs";

let leaderboardCounter = 0;
export const hasLeaderboardLink = async (link) => {
  // Extract domain from URL and create filename
  // console.log("Generating screenshot for site: ", site);
  const url = new URL(link);
  const domain = url.hostname.replace(/[./]/g, "-");
  const leaderboardBase = "https://www.11ty.dev/speedlify/";
  const leaderboardLink = `${leaderboardBase}${domain}`;
  // Create cache for when the site has a link on the leaderboard
  // Cache in .cache directory with a key based on the origin
  const cacheKey = `leaderboardlink-${domain}`;
  const cache = new AssetCache(cacheKey);

  // Check if we have a cached leaderboard link for this domain
  if (cache.isCacheValid(cacheDuration.leaderboardLink)) {
    const cachedLink = await cache.getCachedValue();
    if (cachedLink) {
      // console.log(`Using cached leaderboardlink for ${domain}`);
      return cachedLink;
    }
  }

  try {
    const response = await fetch(leaderboardLink, { method: "HEAD" });
    if (response.ok) {
      leaderboardCounter++;
      console.log(
        `[${leaderboardCounter}] Leaderboard exists at ${leaderboardLink}`
      );
      // Cache the valid leaderboard link
      await cache.save(leaderboardLink, cacheDuration.leaderboardLink);
    }
    return response.ok ? leaderboardLink : false;
  } catch (err) {
    const timestamp = new Date().toISOString();
    const errorMessage = `[${timestamp}] ${domain}: ${err.message}\n`;
    console.log(
      `Error checking leaderboard link for ${domain}: ${err.message}`
    );
    appendFileSync("./log/leaderboard-fetch-errors.txt", errorMessage);
    return false;
  }
};
