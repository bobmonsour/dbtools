import { fetchHtml } from "./fetchhtml.js";
import { AssetCache } from "@11ty/eleventy-fetch";
import * as cheerio from "cheerio";
import path from "path";
import { fileURLToPath } from "url";
import { promises as fs } from "fs";
import { cacheDuration } from "./cacheconfig.js";

// Persistent failure cache across builds
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const failureCachePath = path.join(
  __dirname,
  "./log/title-fetch-failures.json"
);
let failureCache = {};

// Load failure cache from disk
try {
  const data = await fs.readFile(failureCachePath, "utf-8");
  failureCache = JSON.parse(data);
} catch {
  // File doesn't exist yet or is invalid, start with empty cache
  failureCache = {};
}

// Helper to save failure cache to disk
const saveFailureCache = async () => {
  try {
    await fs.mkdir(path.dirname(failureCachePath), { recursive: true });
    await fs.writeFile(failureCachePath, JSON.stringify(failureCache, null, 2));
  } catch (error) {
    console.error("Failed to save title failure cache:", error.message);
  }
};

// Helper to get current date as YYYY-MM-DD
const getCurrentDate = () => {
  const now = new Date();
  return now.toISOString().split("T")[0];
};

// Helper to check if a failure is older than 30 days
const isFailureExpired = (failureDate) => {
  const stored = new Date(failureDate);
  const now = new Date();
  const daysDiff = (now - stored) / (1000 * 60 * 60 * 24);
  return daysDiff >= 30;
};

//***************
// given a url, this function extracts the title
// from the <title> element within the <head> of a web page
// using the cheerio library.
//***************

export const getTitle = async (link) => {
  // Check persistent failure cache first
  if (failureCache[link]) {
    const failureDate = failureCache[link];
    // If failure is less than 30 days old, skip fetch
    if (!isFailureExpired(failureDate)) {
      return "";
    }
    // If 30+ days old, we'll retry (continue to fetch below)
  }

  // Check AssetCache for previously extracted title
  const cacheKey = `title-${link}`;
  const cache = new AssetCache(cacheKey, ".cache");

  if (cache.isCacheValid(cacheDuration.descHtml)) {
    const cachedTitle = await cache.getCachedValue();
    if (cachedTitle !== undefined) {
      // Convert Buffer to string if needed
      return typeof cachedTitle === "string"
        ? cachedTitle
        : cachedTitle.toString();
    }
  }

  try {
    let htmlcontent = await fetchHtml(link, "descHtml");
    const $ = cheerio.load(htmlcontent);
    let title = $("title").text();

    if (!title || title.trim() === "") {
      // Don't cache empty results - AssetCache doesn't accept empty strings
      return "";
    } else {
      let text = title
        .replace(/[<>]/g, "") // Remove angle brackets
        .replace(/&(?!(?:[a-z\d]+|#\d+|#x[a-f\d]+);)/gi, "&amp;") // Escape unencoded ampersands
        .replace(/"/g, "&quot;") // Escape quotes
        .replace(/'/g, "&#39;") // Escape apostrophes
        .replace(/\s+/g, " ") // Normalize whitespace
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Remove control characters
        .replace(/[\u200B-\u200D\uFEFF]/g, "") // Remove zero-width characters
        .replace(/[\u202A-\u202E]/g, "") // Remove directional text markers
        .replace(/\u00AD/g, "") // Remove soft hyphens
        .replace(/[\u00A0]/g, " ") // Convert non-breaking spaces to regular spaces
        .replace(/[\u2000-\u200A]/g, " ") // Convert various unicode spaces to regular spaces
        .replace(/[\u2028\u2029]/g, " ") // Remove line/paragraph separators
        .replace(/[\u2060]/g, "") // Remove word joiners
        .replace(/[\uFFF9-\uFFFB]/g, "") // Remove interlinear annotation characters
        .trim()
        .substring(0, 200); // Reasonable length limit for titles

      title = text;
    }

    // Success! Remove from failure cache if it was there
    if (failureCache[link]) {
      delete failureCache[link];
      await saveFailureCache();
    }

    // Cache the extracted title
    await cache.save(title, "text");
    return title;
  } catch (e) {
    console.log("Error fetching title for " + link + " " + e.message);

    // Add to persistent failure cache with current date
    failureCache[link] = getCurrentDate();
    await saveFailureCache();

    // Don't cache empty results - AssetCache doesn't accept empty strings
    return "";
  }
};
