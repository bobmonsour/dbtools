import { AssetCache } from "@11ty/eleventy-fetch";
import { cacheDuration } from "./cacheconfig.js";
import { appendFileSync } from "fs";

let leaderboardCounter = 0;

// Helper function to normalize URL for leaderboard lookup
function normalizeUrlForLeaderboard(link) {
  const url = new URL(link);
  let hostname = url.hostname;

  // Remove www. prefix if present
  if (hostname.startsWith("www.")) {
    hostname = hostname.substring(4);
  }

  return hostname.replace(/[./]/g, "-");
}

// Helper function to check a single leaderboard URL
async function checkLeaderboardUrl(leaderboardUrl) {
  try {
    const response = await fetch(leaderboardUrl, { method: "HEAD" });
    return response.ok;
  } catch (err) {
    return false;
  }
}

export const hasLeaderboardLink = async (link) => {
  // Extract domain from URL and create filename
  const url = new URL(link);
  const originalDomain = url.hostname.replace(/[./]/g, "-");
  const leaderboardBase = "https://www.11ty.dev/speedlify/";

  // Use normalized domain for cache key (without www) to avoid duplicate cache entries
  const normalizedDomain = normalizeUrlForLeaderboard(link);
  const cacheKey = `leaderboardlink-v2-${normalizedDomain}`;
  const cache = new AssetCache(cacheKey);

  // Check if we have a cached leaderboard link for this domain
  if (cache.isCacheValid(cacheDuration.leaderboardLink)) {
    const cachedLink = await cache.getCachedValue();
    if (cachedLink) {
      // console.log(`Using cached leaderboardlink for ${normalizedDomain}`);
      return cachedLink;
    }
  }

  // Try multiple URL variations
  const variations = [];

  // Add original domain
  variations.push(originalDomain);

  // Add normalized version (without www)
  if (normalizedDomain !== originalDomain) {
    variations.push(normalizedDomain);
  }

  // Try variations with and without trailing slash
  const urlVariations = [];
  for (const domain of variations) {
    urlVariations.push(`${leaderboardBase}${domain}`);
    urlVariations.push(`${leaderboardBase}${domain}/`);
  }

  // Remove duplicates
  const uniqueUrls = [...new Set(urlVariations)];

  try {
    // Check each variation until we find one that works
    for (const leaderboardUrl of uniqueUrls) {
      const exists = await checkLeaderboardUrl(leaderboardUrl);
      if (exists) {
        leaderboardCounter++;
        console.log(
          `[${leaderboardCounter}] Leaderboard exists at ${leaderboardUrl}`
        );
        // Cache the valid leaderboard link
        await cache.save(leaderboardUrl, cacheDuration.leaderboardLink);
        return leaderboardUrl;
      }
    }

    // No valid URL found, cache false to avoid repeated checks
    await cache.save(false, cacheDuration.leaderboardLink);
    return false;
  } catch (err) {
    const timestamp = new Date().toISOString();
    const errorMessage = `[${timestamp}] ${originalDomain}: ${err.message}\n`;
    console.log(
      `Error checking leaderboard link for ${originalDomain}: ${err.message}`
    );
    appendFileSync("./log/leaderboard-fetch-errors.txt", errorMessage);
    return false;
  }
};
