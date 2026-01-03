import { select, confirm } from "@inquirer/prompts";
import fs from "fs";
import path from "path";
import chalk from "chalk";
import { AssetCache } from "@11ty/eleventy-fetch";
import puppeteer from "puppeteer";
import "dotenv/config";
import { cacheDuration, fetchTimeout } from "./cacheconfig.js";
import { getOrigin } from "./getorigin.js";
import { getTitle } from "./gettitle.js";
import { getDescription } from "./getdescription.js";
import { getFavicon } from "./getfavicon.js";
import { formatItemDate } from "./utils.js";
import { genScreenshotFilename } from "./genscreenshotfilename.js";

//***************
// Generate Showcase Data
// This script creates and manages the showcase-data.json file
// used by the 11tybundle.dev website Showcase section
//***************

// Configuration paths
let config = {
  dbFilePath: "",
  communityDataPath: "",
  showcaseDataPath: "",
  syncMetadataPath: "",
  useTestData: true,
};

// Error log file path
const errorLogPath = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "./log/showcase-data-errors.log"
);

// GitHub API configuration
const GITHUB_API_BASE = "https://api.github.com";
const REPO_OWNER = "11ty";
const REPO_NAME = "11ty-community";
const DIRECTORY_PATH = "built-with-eleventy";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// GitHub API headers
const getGitHubHeaders = () => {
  const headers = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "11ty-showcase",
  };
  if (GITHUB_TOKEN) {
    headers.Authorization = `token ${GITHUB_TOKEN}`;
  }
  return headers;
};

// Statistics for reporting
let stats = {
  bundledbSites: 0,
  bundledbWithLeaderboard: 0,
  communityEntriesProcessed: 0,
  communityEntriesAdded: 0,
  communityEntriesDuplicate: 0,
  communityEntriesSkipped: 0,
  totalFinalEntries: 0,
  errors: 0,
};

//***************
// Utility Functions
//***************

// Log error to file with timestamp
const logError = (message, error = null) => {
  const timestamp = new Date().toISOString();
  const errorMessage = error
    ? `[${timestamp}] ${message}: ${error.message || error}\n`
    : `[${timestamp}] ${message}\n`;

  try {
    fs.mkdirSync(path.dirname(errorLogPath), { recursive: true });
    fs.appendFileSync(errorLogPath, errorMessage);
  } catch (err) {
    console.error("Failed to write to error log:", err.message);
  }

  stats.errors++;
};
// Load or create sync metadata file
const loadSyncMetadata = () => {
  if (fs.existsSync(config.syncMetadataPath)) {
    return JSON.parse(fs.readFileSync(config.syncMetadataPath, "utf-8"));
  }
  return null;
};

// Initialize metadata by scanning showcase-data.json for most recent dates
const initializeSyncMetadata = (showcaseData) => {
  console.log(
    chalk.gray("Initializing sync metadata from showcase-data.json...")
  );

  let mostRecentBundledbDate = null;
  let mostRecentCommunityDate = null;

  for (const entry of showcaseData) {
    const entryDate = entry.date;
    if (entryDate) {
      const date = new Date(entryDate);

      // Track most recent bundledb entry (has Link property in original)
      if (!mostRecentBundledbDate || date > mostRecentBundledbDate) {
        mostRecentBundledbDate = date;
      }
    }
  }

  // Default to very old date if no entries found
  if (!mostRecentBundledbDate) {
    mostRecentBundledbDate = new Date("2020-01-01T00:00:00.000Z");
  }
  if (!mostRecentCommunityDate) {
    mostRecentCommunityDate = new Date("2020-01-01T00:00:00.000Z");
  }

  const metadata = {
    lastBundledbSync: mostRecentBundledbDate.toISOString(),
    lastCommunitySync: mostRecentCommunityDate.toISOString(),
    knownCommunityFiles: [],
    lastSyncDate: new Date().toISOString(),
    totalShowcaseEntries: showcaseData.length,
  };

  fs.writeFileSync(config.syncMetadataPath, JSON.stringify(metadata, null, 2));

  console.log(
    chalk.green(
      `✓ Metadata initialized with bundledb sync: ${metadata.lastBundledbSync}`
    )
  );
  return metadata;
};

// Update sync metadata after successful sync
const updateSyncMetadata = (
  metadata,
  newBundledbDate = null,
  newCommunityDate = null,
  totalEntries = null,
  newCommunityFiles = null
) => {
  if (newBundledbDate) {
    metadata.lastBundledbSync = newBundledbDate;
  }
  if (newCommunityDate) {
    metadata.lastCommunitySync = newCommunityDate;
  }
  if (totalEntries !== null) {
    metadata.totalShowcaseEntries = totalEntries;
  }
  if (newCommunityFiles !== null) {
    metadata.knownCommunityFiles = newCommunityFiles;
  }
  metadata.lastSyncDate = new Date().toISOString();

  fs.writeFileSync(config.syncMetadataPath, JSON.stringify(metadata, null, 2));
};
// Normalize URL for comparison (strip www, normalize protocol)
const normalizeUrl = (url) => {
  try {
    const urlObj = new URL(url);
    let hostname = urlObj.hostname.toLowerCase();

    // Strip www. prefix
    if (hostname.startsWith("www.")) {
      hostname = hostname.substring(4);
    }

    let pathname = urlObj.pathname;
    // Remove trailing slash unless it's the root path
    if (pathname.length > 1 && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }
    // Normalize root path to empty string for consistency
    if (pathname === "/") {
      pathname = "";
    }

    // Include search params (sorted for consistency) but ignore hash
    let search = "";
    if (urlObj.search) {
      const params = new URLSearchParams(urlObj.search);
      params.sort();
      search = "?" + params.toString();
    }

    // Always use https for comparison
    return `https://${hostname}${pathname}${search}`;
  } catch (e) {
    logError(`Failed to normalize URL: ${url}`, e);
    return url;
  }
};

// Create a backup file with timestamp
const createBackup = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return;
  }

  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    const timestamp = `${year}-${month}-${day}--${hours}${minutes}${seconds}`;

    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const base = path.basename(filePath, ext);
    const backupPath = path.join(dir, `${base}-${timestamp}${ext}`);

    fs.copyFileSync(filePath, backupPath);
    console.log(chalk.green(`✓ Backup created: ${path.basename(backupPath)}`));
  } catch (err) {
    logError("Failed to create backup", err);
    console.error(chalk.red("✗ Failed to create backup"));
  }
};

// Standalone hasLeaderboardLink function
// Check if a site has a corresponding entry in the Eleventy Leaderboard
let leaderboardCounter = 0;
const hasLeaderboardLink = async (link) => {
  try {
    const url = new URL(link);
    const domain = url.hostname.replace(/[./]/g, "-");
    const leaderboardBase = "https://www.11ty.dev/speedlify/";
    const leaderboardLink = `${leaderboardBase}${domain}`;
    const cacheKey = `leaderboardlink-${domain}`;
    const cache = new AssetCache(cacheKey);

    // Check if we have a cached leaderboard link for this domain
    if (cache.isCacheValid(cacheDuration.descHtml)) {
      const cachedLink = await cache.getCachedValue();
      if (cachedLink) {
        // Convert Buffer to string if needed
        return typeof cachedLink === "string"
          ? cachedLink
          : cachedLink.toString();
      }
    }

    const response = await fetch(leaderboardLink, { method: "HEAD" });
    if (response.ok) {
      leaderboardCounter++;
      console.log(
        `  [${leaderboardCounter}] Leaderboard exists at ${leaderboardLink}`
      );
      await cache.save(leaderboardLink, cacheDuration.descHtml);
      return leaderboardLink;
    }

    return false;
  } catch (err) {
    logError(`Error checking leaderboard link for ${link}`, err);
    return false;
  }
};

// Screenshot directory (relative to dbtools)
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const screenshotDir = path.join(__dirname, "screenshots");

// Error log file path for screenshots
const screenshotErrorLogPath = path.join(
  __dirname,
  "log/screenshot-errors.log"
);

// Screenshot dimensions
const imageWidth = 1920;
const imageHeight = 1080;

// Extract failed URLs from screenshot error log
const extractFailedUrlsFromLog = (logPath) => {
  try {
    const logContent = fs.readFileSync(logPath, "utf-8");
    const lines = logContent.split("\n").filter((line) => line.trim());
    const urlRegex = /Screenshot failed for (https?:\/\/[^\s:]+)/;
    const urls = [];

    for (const line of lines) {
      const match = line.match(urlRegex);
      if (match && match[1]) {
        urls.push(match[1]);
      }
    }

    return urls;
  } catch (err) {
    logError("Failed to extract URLs from error log", err);
    return [];
  }
};

// Find entries matching the failed URLs (using normalized comparison)
const findMatchingEntries = (dataArray, failedUrls, urlProperty) => {
  const normalizedFailedUrls = failedUrls.map((url) => normalizeUrl(url));
  const matchingIndices = [];

  dataArray.forEach((entry, index) => {
    const entryUrl = entry[urlProperty];
    if (entryUrl) {
      const normalizedEntryUrl = normalizeUrl(entryUrl);
      if (normalizedFailedUrls.includes(normalizedEntryUrl)) {
        matchingIndices.push(index);
      }
    }
  });

  return matchingIndices;
};

// Remove entries at specified indices
const removeMatchingEntries = (dataArray, indicesToRemove) => {
  return dataArray.filter((_, index) => !indicesToRemove.includes(index));
};

// Log removal summary to showcase-data-errors.log
const logRemovalSummary = (
  totalFailedUrls,
  showcaseRemoved,
  communityRemoved
) => {
  const timestamp = new Date().toISOString();
  const summaryMessage = `[${timestamp}] REMOVAL SUMMARY: Processed ${totalFailedUrls} failed URLs. Removed ${showcaseRemoved} entries from showcase-data.json and ${communityRemoved} entries from community-data.json.\n`;

  try {
    fs.mkdirSync(path.dirname(errorLogPath), { recursive: true });
    fs.appendFileSync(errorLogPath, summaryMessage);
  } catch (err) {
    console.error("Failed to write removal summary to error log:", err.message);
  }
};

// Transform bundledb entry to showcase format (lowercase properties, remove Issue/Type)
const transformToShowcaseFormat = (entry) => {
  const showcase = {
    title: entry.Title || "",
    description: entry.description || "",
    link: entry.Link || "",
    date: entry.Date || "",
    formattedDate: entry.formattedDate || "",
    favicon: entry.favicon || "",
  };

  // Add leaderboardLink only if it exists
  if (entry.leaderboardLink) {
    showcase.leaderboardLink = entry.leaderboardLink;
  }

  return showcase;
};

//***************
// Screenshot Generation
//***************

// Generate screenshots for showcase entries
const generateScreenshots = async () => {
  console.log(chalk.blue("\n📸 Generate Screenshots for Showcase Entries\n"));

  // Prompt for number of entries to process
  const scope = await select({
    message: "How many entries to process:",
    choices: [
      {
        name: "First 25 entries only (test run)",
        value: "test",
        description: "Process only the first 25 entries for testing",
      },
      {
        name: "All entries",
        value: "all",
        description: "Process all entries in showcase-data.json",
      },
    ],
  });

  const limitTo25 = scope === "test";

  // Prompt for generation mode
  const mode = await select({
    message: "Screenshot generation mode:",
    choices: [
      {
        name: "Generate only missing screenshots",
        value: "missing",
        description: "Skip entries that already have screenshots (recommended)",
      },
      {
        name: "Regenerate all screenshots",
        value: "all",
        description:
          "Capture screenshots for all entries, including existing ones",
      },
    ],
  });

  const regenerateAll = mode === "all";

  // Load showcase data
  console.log(chalk.cyan("Loading showcase data...\n"));
  let showcaseData = [];
  try {
    const data = fs.readFileSync(config.showcaseDataPath, "utf8");
    showcaseData = JSON.parse(data);
  } catch (err) {
    logError("Failed to read showcase-data.json", err);
    console.error(chalk.red("✗ Failed to read showcase-data.json"));
    return;
  }

  // Limit to first 25 entries if test mode
  const entriesToProcess = limitTo25 ? showcaseData.slice(0, 25) : showcaseData;
  const totalEntries = showcaseData.length;

  if (limitTo25) {
    console.log(
      chalk.yellow(`✓ Loaded ${totalEntries} entries (processing first 25)\n`)
    );
  } else {
    console.log(chalk.green(`✓ Loaded ${totalEntries} entries\n`));
  }

  // Create screenshot directory if it doesn't exist
  try {
    fs.mkdirSync(screenshotDir, { recursive: true });
  } catch (err) {
    logError("Failed to create screenshot directory", err);
    console.error(chalk.red("✗ Failed to create screenshot directory"));
    return;
  }

  // Create backup of showcase-data.json
  console.log(chalk.cyan("Creating backup..."));
  createBackup(config.showcaseDataPath);

  // Statistics
  let captured = 0;
  let skipped = 0;
  let failed = 0;

  // Initialize Puppeteer browser once
  console.log(chalk.cyan("Launching browser...\n"));
  const browser = await puppeteer.launch();

  try {
    for (let i = 0; i < entriesToProcess.length; i++) {
      const entry = entriesToProcess[i];
      const link = entry.link;

      console.log(chalk.gray(`[${i + 1}/${entriesToProcess.length}] ${link}`));

      try {
        // Generate filename
        const { domain, filename } = await genScreenshotFilename(link);
        const screenshotPath = `/screenshots/${filename}`;
        const fullPath = path.join(screenshotDir, filename);

        // Check if screenshot already exists
        if (fs.existsSync(fullPath) && !regenerateAll) {
          console.log(chalk.gray(`  → Skipped (already exists)`));
          // Ensure entry has screenshotpath property
          if (!entry.screenshotpath) {
            entry.screenshotpath = screenshotPath;
          }
          skipped++;
          continue;
        }

        // Capture screenshot
        const page = await browser.newPage();
        await page.setViewport({ width: imageWidth, height: imageHeight });

        try {
          await page.goto(link, {
            waitUntil: "networkidle2",
            timeout: fetchTimeout.screenshot,
          });

          await page.screenshot({
            path: fullPath,
            type: "jpeg",
            quality: 100,
          });

          // Update entry with screenshot path
          entry.screenshotpath = screenshotPath;
          captured++;
          console.log(chalk.green(`  ✓ Captured`));
        } catch (err) {
          const timestamp = new Date().toISOString();
          const errorMessage = `[${timestamp}] Screenshot failed for ${link}: ${err.message}\n`;
          fs.appendFileSync(screenshotErrorLogPath, errorMessage);
          failed++;
          console.log(chalk.red(`  ✗ Failed: ${err.message}`));
        } finally {
          await page.close();
        }
      } catch (err) {
        const timestamp = new Date().toISOString();
        const errorMessage = `[${timestamp}] Error processing ${link}: ${err.message}\n`;
        fs.appendFileSync(screenshotErrorLogPath, errorMessage);
        failed++;
        console.log(chalk.red(`  ✗ Error: ${err.message}`));
      }
    }
  } finally {
    // Close browser
    await browser.close();
    console.log(chalk.cyan("\n✓ Browser closed\n"));
  }

  // Write updated showcase data back to file
  console.log(
    chalk.cyan("Updating showcase-data.json with screenshot paths...")
  );
  try {
    fs.writeFileSync(
      config.showcaseDataPath,
      JSON.stringify(showcaseData, null, 2)
    );
    console.log(chalk.green("✓ Successfully updated showcase-data.json\n"));
  } catch (err) {
    logError("Failed to update showcase-data.json", err);
    console.error(chalk.red("✗ Failed to update showcase-data.json"));
    return;
  }

  // Print summary
  console.log(chalk.blue("=".repeat(60)));
  console.log(chalk.blue.bold("📊 SCREENSHOT GENERATION SUMMARY"));
  console.log(chalk.blue("=".repeat(60)));
  if (limitTo25) {
    console.log(
      chalk.white(`Total entries in file: ${totalEntries} (processed first 25)`)
    );
  } else {
    console.log(
      chalk.white(`Total entries processed: ${entriesToProcess.length}`)
    );
  }
  console.log(chalk.green(`Screenshots captured: ${captured}`));
  console.log(chalk.gray(`Skipped (existing): ${skipped}`));
  console.log(chalk[failed > 0 ? "red" : "green"](`Failed: ${failed}`));
  if (failed > 0) {
    console.log(
      chalk.yellow(`  See ${screenshotErrorLogPath} for error details`)
    );
  }
  console.log(chalk.blue("=".repeat(60) + "\n"));
};

//***************
// Core Functions
//***************

// Create showcase-data.json from scratch
const createShowcaseFromScratch = async () => {
  console.log(chalk.blue("\n🚀 Creating showcase-data.json from scratch...\n"));

  // Display severe warning
  console.log(chalk.red.bold("⚠️  WARNING ⚠️"));
  console.log(
    chalk.yellow(
      "\nThis operation will rebuild the entire showcase-data.json file from scratch."
    )
  );
  console.log(
    chalk.yellow(
      "It is a LONG PROCESS that will fetch metadata for all entries."
    )
  );
  console.log(
    chalk.yellow("This may take 30+ minutes depending on network conditions.\n")
  );

  const confirmProceed = await confirm({
    message: "Are you SURE you want to proceed with this operation?",
    default: false,
  });

  if (!confirmProceed) {
    console.log(chalk.yellow("Operation cancelled.\n"));
    await showMainMenu();
    return;
  }

  // Check if showcase-data.json already exists
  if (fs.existsSync(config.showcaseDataPath)) {
    const overwrite = await confirm({
      message: `${path.basename(
        config.showcaseDataPath
      )} already exists. Overwrite?`,
      default: false,
    });

    if (!overwrite) {
      console.log(chalk.yellow("Operation cancelled."));
      return;
    }

    // Create backup before overwriting
    createBackup(config.showcaseDataPath);
  }

  // Step 1: Read and extract bundledb sites
  console.log(
    chalk.cyan("Step 1: Extracting site entries from bundledb.json...")
  );
  let bundledbData = [];
  try {
    const data = fs.readFileSync(config.dbFilePath, "utf8");
    bundledbData = JSON.parse(data);
  } catch (err) {
    logError("Failed to read bundledb.json", err);
    console.error(chalk.red("✗ Failed to read bundledb.json"));
    return;
  }

  const siteEntries = bundledbData.filter((entry) => entry.Type === "site");
  stats.bundledbSites = siteEntries.length;
  console.log(chalk.green(`✓ Found ${stats.bundledbSites} site entries\n`));

  // Step 2: Add leaderboard links
  console.log(chalk.cyan("Step 2: Checking for leaderboard links..."));
  for (let i = 0; i < siteEntries.length; i++) {
    const entry = siteEntries[i];
    const leaderboardLink = await hasLeaderboardLink(entry.Link);
    if (leaderboardLink) {
      entry.leaderboardLink = leaderboardLink;
      stats.bundledbWithLeaderboard++;
    }
  }
  console.log(
    chalk.green(
      `✓ Found ${stats.bundledbWithLeaderboard} sites with leaderboard entries\n`
    )
  );

  // Step 3: Read community-data.json
  console.log(chalk.cyan("Step 3: Processing community-data.json entries..."));
  let communityData = [];
  try {
    const data = fs.readFileSync(config.communityDataPath, "utf8");
    communityData = JSON.parse(data);
  } catch (err) {
    logError("Failed to read community-data.json", err);
    console.error(chalk.red("✗ Failed to read community-data.json"));
    return;
  }

  console.log(chalk.gray(`Found ${communityData.length} community entries\n`));

  // Build normalized URL map for duplicate detection
  const existingUrls = new Map();
  siteEntries.forEach((entry) => {
    const normalized = normalizeUrl(entry.Link);
    existingUrls.set(normalized, entry.Link);
  });

  // Process community entries
  for (let i = 0; i < communityData.length; i++) {
    const communityEntry = communityData[i];
    stats.communityEntriesProcessed++;

    // Progress indicator
    if (
      stats.communityEntriesProcessed % 50 === 0 ||
      i === communityData.length - 1
    ) {
      console.log(
        chalk.gray(
          `  Processing: ${stats.communityEntriesProcessed} of ${communityData.length}`
        )
      );
    }

    const url = communityEntry.url;
    if (!url) {
      logError(
        `Community entry missing URL: ${JSON.stringify(communityEntry)}`
      );
      stats.communityEntriesSkipped++;
      continue;
    }

    // Check for missing _github_last_modified
    if (!communityEntry._github_last_modified) {
      logError(`Community entry missing _github_last_modified: ${url}`);
      stats.communityEntriesSkipped++;
      continue;
    }

    // Check for duplicates
    const normalizedUrl = normalizeUrl(url);
    if (existingUrls.has(normalizedUrl)) {
      stats.communityEntriesDuplicate++;
      continue;
    }

    // Check if URL is accessible before attempting to fetch metadata
    try {
      const response = await fetch(url, {
        method: "HEAD",
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      if (!response.ok) {
        logError(`URL not accessible (${response.status}): ${url}`);
        stats.communityEntriesSkipped++;
        continue;
      }
    } catch (err) {
      logError(`URL not accessible (${err.message}): ${url}`);
      stats.communityEntriesSkipped++;
      continue;
    }

    // Fetch metadata for new entry
    let title = await getTitle(url);
    if (!title) {
      logError(`Title extraction failed for ${url}, using URL as title`);
      title = url;
    }

    const description = await getDescription(url);
    if (!description) {
      logError(`Description fetch failed for ${url}`);
    }

    const favicon = await getFavicon(url, "site");
    if (!favicon) {
      logError(`Favicon fetch failed for ${url}`);
    }

    // Format date from _github_last_modified
    const date = communityEntry._github_last_modified.split("T")[0]; // Extract YYYY-MM-DD
    const formattedDate = formatItemDate(date);

    // Check for leaderboard link
    const leaderboardLink = await hasLeaderboardLink(url);

    // Create new entry
    const newEntry = {
      Title: title,
      description: description,
      Link: url,
      Date: date,
      formattedDate: formattedDate,
      favicon: favicon,
    };

    if (leaderboardLink) {
      newEntry.leaderboardLink = leaderboardLink;
    }

    siteEntries.push(newEntry);
    existingUrls.set(normalizedUrl, url);
    stats.communityEntriesAdded++;
  }

  console.log(
    chalk.green(
      `\n✓ Added ${stats.communityEntriesAdded} new entries from community data`
    )
  );
  console.log(
    chalk.gray(
      `  Skipped ${stats.communityEntriesDuplicate} duplicates, ${stats.communityEntriesSkipped} invalid entries\n`
    )
  );

  // Step 4: Sort by date (most recent first)
  console.log(chalk.cyan("Step 4: Sorting entries by date..."));
  siteEntries.sort((a, b) => {
    const dateA = new Date(a.Date);
    const dateB = new Date(b.Date);
    return dateB - dateA; // Descending order
  });
  console.log(chalk.green("✓ Entries sorted\n"));

  // Step 5: Transform to showcase format and write output
  console.log(chalk.cyan("Step 5: Writing showcase-data.json..."));
  const showcaseData = siteEntries.map(transformToShowcaseFormat);
  stats.totalFinalEntries = showcaseData.length;

  try {
    fs.writeFileSync(
      config.showcaseDataPath,
      JSON.stringify(showcaseData, null, 2)
    );
    console.log(
      chalk.green(`✓ Successfully wrote ${stats.totalFinalEntries} entries\n`)
    );
  } catch (err) {
    logError("Failed to write showcase-data.json", err);
    console.error(chalk.red("✗ Failed to write showcase-data.json"));
    return;
  }

  // Print summary report
  printSummaryReport();
};

// Print summary report
const printSummaryReport = () => {
  console.log(chalk.blue("\n" + "=".repeat(60)));
  console.log(chalk.blue.bold("📊 SUMMARY REPORT"));
  console.log(chalk.blue("=".repeat(60)));
  console.log(chalk.white(`Bundledb site entries: ${stats.bundledbSites}`));
  console.log(
    chalk.white(
      `Sites with leaderboard links: ${stats.bundledbWithLeaderboard}`
    )
  );
  console.log(
    chalk.white(
      `Community entries processed: ${stats.communityEntriesProcessed}`
    )
  );
  console.log(chalk.white(`  → Added: ${stats.communityEntriesAdded}`));
  console.log(
    chalk.white(
      `  → Duplicates (kept bundledb version): ${stats.communityEntriesDuplicate}`
    )
  );
  console.log(
    chalk.white(`  → Skipped (missing data): ${stats.communityEntriesSkipped}`)
  );
  console.log(
    chalk.white.bold(
      `\nTotal entries in showcase-data.json: ${stats.totalFinalEntries}`
    )
  );
  console.log(
    chalk[stats.errors > 0 ? "yellow" : "green"](
      `Errors logged: ${stats.errors}`
    )
  );
  if (stats.errors > 0) {
    console.log(chalk.yellow(`  See ${errorLogPath} for details`));
  }
  console.log(chalk.blue("=".repeat(60) + "\n"));
};

// Update showcase-data.json with new entries from bundledb.json
const updateWithBundledbEntries = async () => {
  console.log(
    chalk.blue(
      "\n🔄 Updating showcase-data.json with new bundledb entries...\n"
    )
  );

  // Check if showcase-data.json exists
  if (!fs.existsSync(config.showcaseDataPath)) {
    console.log(
      chalk.red(
        `✗ showcase-data.json not found at ${config.showcaseDataPath}\n` +
          `  Please create it first using "Create from scratch" option.\n`
      )
    );
    await showMainMenu();
    return;
  }

  // Load existing showcase-data.json
  console.log(chalk.gray("Loading showcase-data.json..."));
  const showcaseData = JSON.parse(
    fs.readFileSync(config.showcaseDataPath, "utf-8")
  );
  console.log(
    chalk.gray(`Found ${showcaseData.length} entries in showcase-data\n`)
  );

  // Load or initialize sync metadata
  let metadata = loadSyncMetadata();
  if (!metadata) {
    metadata = initializeSyncMetadata(showcaseData);
    console.log();
  } else {
    console.log(
      chalk.gray(`Last bundledb sync: ${metadata.lastBundledbSync}\n`)
    );
  }

  const lastSyncDate = new Date(metadata.lastBundledbSync);

  // Load bundledb.json
  console.log(chalk.gray("Loading bundledb.json..."));
  const bundledb = JSON.parse(fs.readFileSync(config.dbFilePath, "utf-8"));

  // Extract site entries from bundledb
  const bundledbSites = bundledb.filter((entry) => entry.Type === "site");
  console.log(
    chalk.gray(`Found ${bundledbSites.length} total site entries in bundledb\n`)
  );

  // Filter for entries newer than last sync
  const newEntries = bundledbSites
    .filter((entry) => new Date(entry.Date) > lastSyncDate)
    .sort((a, b) => new Date(b.Date) - new Date(a.Date));

  console.log(
    chalk.gray(`Entries newer than last sync: ${newEntries.length}\n`)
  );

  if (newEntries.length === 0) {
    console.log(
      chalk.green("✓ No new entries found. showcase-data.json is up to date!\n")
    );
    await showMainMenu();
    return;
  }

  // Build set of normalized URLs from showcase for duplicate safety check
  const showcaseUrls = new Set(
    showcaseData.map((entry) => normalizeUrl(entry.link || entry.url))
  );

  // Process new entries - transform to showcase format
  console.log(chalk.gray("Processing new entries...\n"));
  const processedEntries = [];
  let processedCount = 0;
  let errorCount = 0;
  let duplicateCount = 0;
  let mostRecentDate = lastSyncDate;

  for (const entry of newEntries) {
    try {
      processedCount++;

      // Duplicate safety check
      const normalizedUrl = normalizeUrl(entry.Link);
      if (showcaseUrls.has(normalizedUrl)) {
        duplicateCount++;
        logError(
          `Duplicate URL detected during bundledb update: ${entry.Link}`,
          new Error("Duplicate skipped")
        );
        console.log(
          chalk.yellow(
            `[${processedCount}/${newEntries.length}] Skipping duplicate: ${entry.Link}\n`
          )
        );
        continue;
      }

      console.log(
        chalk.gray(
          `[${processedCount}/${newEntries.length}] Processing: ${entry.Link}`
        )
      );

      // Transform to showcase format (lowercase properties, remove Issue/Type)
      const showcaseEntry = transformToShowcaseFormat(entry);

      // Check for leaderboard link
      const leaderboardLink = await hasLeaderboardLink(entry.Link);
      if (leaderboardLink) {
        showcaseEntry.leaderboardLink = leaderboardLink;
      }

      processedEntries.push(showcaseEntry);
      showcaseUrls.add(normalizedUrl); // Add to set to catch duplicates in this batch

      // Track most recent date
      const entryDate = new Date(entry.Date);
      if (entryDate > mostRecentDate) {
        mostRecentDate = entryDate;
      }

      console.log(chalk.green(`  ✓ Processed successfully\n`));
    } catch (err) {
      errorCount++;
      logError(`Error processing bundledb entry: ${entry.Link}`, err);
      console.log(chalk.red(`  ✗ Error processing (logged)\n`));
    }
  }

  if (processedEntries.length === 0) {
    console.log(
      chalk.red("✗ No entries were successfully processed. No changes made.\n")
    );
    await showMainMenu();
    return;
  }

  // Prepend new entries to showcase data
  const updatedShowcaseData = [...processedEntries, ...showcaseData];

  // Create backup before writing
  createBackup(config.showcaseDataPath);

  // Write updated showcase-data.json
  console.log(chalk.gray("\nWriting updated showcase-data.json..."));
  fs.writeFileSync(
    config.showcaseDataPath,
    JSON.stringify(updatedShowcaseData, null, 2)
  );
  console.log(chalk.green(`✓ showcase-data.json updated successfully\n`));

  // Update sync metadata
  updateSyncMetadata(
    metadata,
    mostRecentDate.toISOString(),
    null,
    updatedShowcaseData.length
  );
  console.log(chalk.green(`✓ Sync metadata updated\n`));

  // Print summary report
  console.log(chalk.blue("=".repeat(60)));
  console.log(chalk.blue.bold("  Update Summary"));
  console.log(chalk.blue("=".repeat(60)));
  console.log(
    chalk.cyan(`Total bundledb site entries: ${bundledbSites.length}`)
  );
  console.log(chalk.cyan(`Entries newer than last sync: ${newEntries.length}`));
  console.log(
    chalk[processedEntries.length > 0 ? "green" : "red"](
      `Successfully processed: ${processedEntries.length}`
    )
  );
  if (duplicateCount > 0) {
    console.log(chalk.yellow(`Duplicates skipped: ${duplicateCount}`));
  }
  console.log(chalk[errorCount > 0 ? "red" : "green"](`Errors: ${errorCount}`));
  if (errorCount > 0) {
    console.log(chalk.yellow(`  See ${errorLogPath} for error details`));
  }
  console.log(
    chalk.blue(
      `\nTotal entries in showcase-data.json: ${updatedShowcaseData.length}`
    )
  );
  console.log(
    chalk.cyan(`New last sync timestamp: ${mostRecentDate.toISOString()}`)
  );
  console.log(chalk.blue("=".repeat(60) + "\n"));

  await showMainMenu();
};

// GitHub API helper functions for fetching community data
const getDefaultBranch = async () => {
  const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}`;
  const response = await fetch(url, {
    headers: getGitHubHeaders(),
    signal: AbortSignal.timeout(fetchTimeout.screenshot || 10000),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch repo info: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  return data.default_branch;
};

const fetchGitHubDirectoryContents = async () => {
  const branch = await getDefaultBranch();
  console.log(chalk.gray(`  Using branch: ${branch}`));

  const treeUrl = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/${branch}?recursive=1`;

  const response = await fetch(treeUrl, {
    headers: getGitHubHeaders(),
    signal: AbortSignal.timeout(fetchTimeout.screenshot || 10000),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch tree: ${response.status} ${response.statusText}`
    );
  }

  const treeData = await response.json();

  const directoryFiles = treeData.tree
    .filter(
      (item) =>
        item.type === "blob" &&
        item.path.startsWith(DIRECTORY_PATH + "/") &&
        item.path.endsWith(".json")
    )
    .map((item) => ({
      name: item.path.split("/").pop(),
      path: item.path,
      sha: item.sha,
      download_url: `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${branch}/${item.path}`,
    }));

  return directoryFiles;
};

const fetchFileCommitDate = async (filePath) => {
  const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/commits?path=${filePath}&per_page=1`;

  const response = await fetch(url, {
    headers: getGitHubHeaders(),
    signal: AbortSignal.timeout(fetchTimeout.screenshot || 10000),
  });

  if (!response.ok) {
    console.warn(chalk.yellow(`  Could not fetch commit date for ${filePath}`));
    return null;
  }

  const commits = await response.json();
  if (commits.length === 0) {
    return null;
  }

  return commits[0].commit.author.date;
};

const fetchGitHubFileContent = async (downloadUrl, filePath) => {
  const response = await fetch(downloadUrl, {
    signal: AbortSignal.timeout(fetchTimeout.screenshot || 10000),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch file: ${response.status} ${response.statusText}`
    );
  }

  const content = await response.json();

  // Add commit date information
  const lastModified = await fetchFileCommitDate(filePath);
  if (lastModified) {
    content._github_last_modified = lastModified;
  }

  return content;
};

// Update showcase-data.json with new entries from GitHub community data
const updateWithCommunityEntries = async () => {
  console.log(
    chalk.blue("\n🌐 Updating with new entries from GitHub community data...\n")
  );

  // Check if files exist
  if (!fs.existsSync(config.showcaseDataPath)) {
    console.log(
      chalk.red(
        `✗ showcase-data.json not found at ${config.showcaseDataPath}\n` +
          `  Please create it first using "Create from scratch" option.\n`
      )
    );
    await showMainMenu();
    return;
  }

  if (!fs.existsSync(config.communityDataPath)) {
    console.log(
      chalk.red(
        `✗ community-data.json not found at ${config.communityDataPath}\n` +
          `  Please run fetch-community-data.js first.\n`
      )
    );
    await showMainMenu();
    return;
  }

  // Check for GitHub token
  if (!GITHUB_TOKEN) {
    console.log(
      chalk.red(
        "✗ GITHUB_TOKEN not found in .env file\n" +
          "  GitHub API access requires authentication.\n"
      )
    );
    await showMainMenu();
    return;
  }

  // Load existing files
  console.log(chalk.gray("Loading local files..."));
  const showcaseData = JSON.parse(
    fs.readFileSync(config.showcaseDataPath, "utf-8")
  );
  const communityData = JSON.parse(
    fs.readFileSync(config.communityDataPath, "utf-8")
  );
  console.log(
    chalk.gray(
      `  Showcase: ${showcaseData.length} entries, Community: ${communityData.length} entries\n`
    )
  );

  // Load or initialize sync metadata
  let metadata = loadSyncMetadata();
  if (!metadata) {
    metadata = initializeSyncMetadata(showcaseData);
    console.log();
  } else {
    console.log(
      chalk.gray(`Last community sync: ${metadata.lastCommunitySync}\n`)
    );
  }

  const lastSyncDate = new Date(metadata.lastCommunitySync);

  // Fetch from GitHub
  console.log(chalk.cyan("Fetching GitHub directory tree..."));
  let githubFiles;
  try {
    githubFiles = await fetchGitHubDirectoryContents();
    console.log(
      chalk.gray(`  Found ${githubFiles.length} files in GitHub repo\n`)
    );
  } catch (err) {
    logError("Failed to fetch GitHub directory contents", err);
    console.log(chalk.red(`✗ Failed to fetch from GitHub: ${err.message}\n`));
    await showMainMenu();
    return;
  }

  // Get cached known filenames (initialize if doesn't exist)
  if (!metadata.knownCommunityFiles) {
    metadata.knownCommunityFiles = [];
  }
  const knownFilenames = new Set(metadata.knownCommunityFiles);

  // Identify NEW files only
  const newFiles = githubFiles.filter((file) => !knownFilenames.has(file.name));

  console.log(
    chalk.gray(
      `Known files in cache: ${knownFilenames.size}, New files: ${newFiles.length}\n`
    )
  );

  if (newFiles.length === 0) {
    console.log(
      chalk.green(
        "✓ No new files found in GitHub repo. Files are up to date!\n"
      )
    );
    await showMainMenu();
    return;
  }

  console.log(chalk.yellow(`Processing ${newFiles.length} new files...\n`));

  // Process ONLY new files
  const newCommunityEntries = [];
  const existingCommunityUrls = new Set(
    communityData.map((e) => normalizeUrl(e.url)).filter((u) => u)
  );

  let filesProcessed = 0;
  for (const file of newFiles) {
    try {
      filesProcessed++;
      console.log(
        chalk.gray(
          `[${filesProcessed}/${newFiles.length}] Fetching: ${file.name}`
        )
      );

      const content = await fetchGitHubFileContent(
        file.download_url,
        file.path
      );

      // Check if URL already exists in our community data
      const normalizedUrl = normalizeUrl(content.url);
      if (existingCommunityUrls.has(normalizedUrl)) {
        console.log(chalk.yellow(`  → Duplicate URL, skipping\n`));
        continue;
      }

      newCommunityEntries.push(content);
      existingCommunityUrls.add(normalizedUrl);
      console.log(chalk.green(`  ✓ New entry found\n`));
    } catch (err) {
      logError(`Error processing GitHub file ${file.name}`, err);
      console.log(chalk.red(`  ✗ Error (logged)\n`));
    }
  }

  console.log(
    chalk.gray(
      `\nProcessed ${filesProcessed} new files, found ${newCommunityEntries.length} valid entries\n`
    )
  );

  if (newCommunityEntries.length === 0) {
    console.log(
      chalk.yellow(
        "⚠ New files found but no valid entries to add (all were duplicates or errors).\n"
      )
    );
    // Still update cache with new filenames even if entries were duplicates
    const updatedFilenames = [
      ...metadata.knownCommunityFiles,
      ...newFiles.map((f) => f.name),
    ];
    updateSyncMetadata(metadata, null, null, null, updatedFilenames);
    await showMainMenu();
    return;
  }

  // Build showcase URL set for duplicate checking
  const showcaseUrls = new Set(
    showcaseData.map((entry) => normalizeUrl(entry.link || entry.url))
  );

  // Process new entries for showcase
  console.log(chalk.gray("Processing new entries for showcase...\n"));
  const showcaseNewEntries = [];
  let processedCount = 0;
  let errorCount = 0;
  let duplicateCount = 0;
  let mostRecentDate = lastSyncDate;

  for (const communityEntry of newCommunityEntries) {
    try {
      processedCount++;
      const url = communityEntry.url;

      // Duplicate safety check against showcase
      const normalizedUrl = normalizeUrl(url);
      if (showcaseUrls.has(normalizedUrl)) {
        duplicateCount++;
        logError(
          `Duplicate URL detected during community update: ${url}`,
          new Error("Duplicate skipped")
        );
        console.log(
          chalk.yellow(
            `[${processedCount}/${newCommunityEntries.length}] Skipping duplicate: ${url}\n`
          )
        );
        continue;
      }

      console.log(
        chalk.gray(
          `[${processedCount}/${newCommunityEntries.length}] Processing: ${url}`
        )
      );

      // Check URL accessibility
      try {
        const response = await fetch(url, {
          method: "HEAD",
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) {
          logError(`URL not accessible (${response.status}): ${url}`);
          console.log(chalk.yellow(`  ⚠ URL not accessible, skipping\n`));
          errorCount++;
          continue;
        }
      } catch (err) {
        logError(`URL not accessible (${err.message}): ${url}`);
        console.log(chalk.yellow(`  ⚠ URL not accessible, skipping\n`));
        errorCount++;
        continue;
      }

      // Fetch metadata
      let title = await getTitle(url);
      if (!title) {
        title = url;
      }

      const description = await getDescription(url);
      const favicon = await getFavicon(url, "site");

      // Format date from _github_last_modified
      const date = communityEntry._github_last_modified.split("T")[0];
      const formattedDate = formatItemDate(date);

      // Check for leaderboard link
      const leaderboardLink = await hasLeaderboardLink(url);

      // Create showcase entry
      const showcaseEntry = {
        title: title,
        description: description || "",
        link: url,
        date: date,
        formattedDate: formattedDate,
        favicon: favicon || "",
      };

      if (leaderboardLink) {
        showcaseEntry.leaderboardLink = leaderboardLink;
      }

      showcaseNewEntries.push(showcaseEntry);
      showcaseUrls.add(normalizedUrl);

      // Track most recent date
      const entryDate = new Date(communityEntry._github_last_modified);
      if (entryDate > mostRecentDate) {
        mostRecentDate = entryDate;
      }

      console.log(chalk.green(`  ✓ Processed successfully\n`));
    } catch (err) {
      errorCount++;
      logError(`Error processing community entry: ${communityEntry.url}`, err);
      console.log(chalk.red(`  ✗ Error processing (logged)\n`));
    }
  }

  if (showcaseNewEntries.length === 0) {
    console.log(
      chalk.red("✗ No entries were successfully processed. No changes made.\n")
    );
    await showMainMenu();
    return;
  }

  // Update both files
  // 1. Prepend to community-data.json
  const updatedCommunityData = [...newCommunityEntries, ...communityData];
  createBackup(config.communityDataPath);
  fs.writeFileSync(
    config.communityDataPath,
    JSON.stringify(updatedCommunityData, null, 2)
  );
  console.log(
    chalk.green(
      `✓ community-data.json updated: ${updatedCommunityData.length} entries\n`
    )
  );

  // 2. Prepend to showcase-data.json
  const updatedShowcaseData = [...showcaseNewEntries, ...showcaseData];
  createBackup(config.showcaseDataPath);
  fs.writeFileSync(
    config.showcaseDataPath,
    JSON.stringify(updatedShowcaseData, null, 2)
  );
  console.log(
    chalk.green(
      `✓ showcase-data.json updated: ${updatedShowcaseData.length} entries\n`
    )
  );

  // Update sync metadata with new filenames
  const updatedFilenames = [
    ...metadata.knownCommunityFiles,
    ...newFiles.map((f) => f.name),
  ];
  updateSyncMetadata(
    metadata,
    null,
    mostRecentDate.toISOString(),
    updatedShowcaseData.length,
    updatedFilenames
  );
  console.log(chalk.green(`✓ Sync metadata updated\n`));

  // Print summary report
  console.log(chalk.blue("=".repeat(60)));
  console.log(chalk.blue.bold("  Update Summary"));
  console.log(chalk.blue("=".repeat(60)));
  console.log(chalk.cyan(`Total files in GitHub repo: ${githubFiles.length}`));
  console.log(chalk.cyan(`Files in cache: ${knownFilenames.size}`));
  console.log(chalk.cyan(`New files found: ${newFiles.length}`));
  console.log(
    chalk.cyan(`New community entries processed: ${newCommunityEntries.length}`)
  );
  console.log(
    chalk[showcaseNewEntries.length > 0 ? "green" : "red"](
      `Successfully added to showcase: ${showcaseNewEntries.length}`
    )
  );
  if (duplicateCount > 0) {
    console.log(chalk.yellow(`Duplicates skipped: ${duplicateCount}`));
  }
  console.log(chalk[errorCount > 0 ? "red" : "green"](`Errors: ${errorCount}`));
  if (errorCount > 0) {
    console.log(chalk.yellow(`  See ${errorLogPath} for error details`));
  }
  console.log(
    chalk.blue(
      `\nTotal entries in community-data.json: ${updatedCommunityData.length}`
    )
  );
  console.log(
    chalk.blue(
      `Total entries in showcase-data.json: ${updatedShowcaseData.length}`
    )
  );
  console.log(
    chalk.cyan(`New last sync timestamp: ${mostRecentDate.toISOString()}`)
  );
  console.log(chalk.blue("=".repeat(60) + "\n"));

  await showMainMenu();
};

// Remove entries that failed screenshot generation
const removeFailedEntries = async () => {
  console.log(chalk.blue("\n=== Remove Failed Screenshot Entries ===\n"));

  // 1. Check if screenshot-errors.log exists
  const screenshotLogPath = path.join(__dirname, "log/screenshot-errors.log");
  if (!fs.existsSync(screenshotLogPath)) {
    console.log(chalk.yellow("No screenshot-errors.log file found."));
    console.log(
      chalk.gray(
        "This file is created when screenshot generation encounters errors.\n"
      )
    );
    await showMainMenu();
    return;
  }

  // 2. Parse error log and extract URLs
  const failedUrls = extractFailedUrlsFromLog(screenshotLogPath);
  if (failedUrls.length === 0) {
    console.log(chalk.yellow("No failed URLs found in error log.\n"));
    await showMainMenu();
    return;
  }

  console.log(
    chalk.gray(`Found ${failedUrls.length} failed URLs in error log:`)
  );
  failedUrls.forEach((url, i) => {
    console.log(chalk.gray(`  ${i + 1}. ${url}`));
  });
  console.log("");

  // 3. Check if showcase-data.json and community-data.json exist
  if (!fs.existsSync(config.showcaseDataPath)) {
    console.log(
      chalk.red(`Showcase data file not found at: ${config.showcaseDataPath}\n`)
    );
    await showMainMenu();
    return;
  }

  if (!fs.existsSync(config.communityDataPath)) {
    console.log(
      chalk.red(
        `Community data file not found at: ${config.communityDataPath}\n`
      )
    );
    await showMainMenu();
    return;
  }

  // 4. Load data files
  const showcaseData = JSON.parse(
    fs.readFileSync(config.showcaseDataPath, "utf-8")
  );
  const communityData = JSON.parse(
    fs.readFileSync(config.communityDataPath, "utf-8")
  );

  // 5. Find matching entries using normalized URLs
  const showcaseMatches = findMatchingEntries(showcaseData, failedUrls, "link");
  const communityMatches = findMatchingEntries(
    communityData,
    failedUrls,
    "url"
  );

  // 6. Show preview and confirm
  console.log(chalk.cyan("\nWill remove:"));
  console.log(
    chalk.cyan(`  ${showcaseMatches.length} entries from showcase-data.json`)
  );
  console.log(
    chalk.cyan(`  ${communityMatches.length} entries from community-data.json`)
  );

  if (showcaseMatches.length === 0 && communityMatches.length === 0) {
    console.log(
      chalk.yellow(
        "\nNo matching entries found in data files. URLs may have already been removed.\n"
      )
    );
    await showMainMenu();
    return;
  }

  console.log("");
  const confirmed = await confirm({
    message: "Proceed with removal?",
    default: false,
  });

  if (!confirmed) {
    console.log(chalk.yellow("\nOperation cancelled\n"));
    await showMainMenu();
    return;
  }

  // 7. Create backups
  console.log("");
  createBackup(config.showcaseDataPath);
  createBackup(config.communityDataPath);

  // 8. Remove entries
  const updatedShowcaseData = removeMatchingEntries(
    showcaseData,
    showcaseMatches
  );
  const updatedCommunityData = removeMatchingEntries(
    communityData,
    communityMatches
  );

  // 9. Save files
  try {
    fs.writeFileSync(
      config.showcaseDataPath,
      JSON.stringify(updatedShowcaseData, null, 2)
    );
    fs.writeFileSync(
      config.communityDataPath,
      JSON.stringify(updatedCommunityData, null, 2)
    );

    // 10. Log summary
    logRemovalSummary(
      failedUrls.length,
      showcaseMatches.length,
      communityMatches.length
    );

    console.log(chalk.green("\n✓ Failed entries removed successfully"));
    console.log(
      chalk.gray(
        `  Showcase entries: ${showcaseData.length} → ${updatedShowcaseData.length}`
      )
    );
    console.log(
      chalk.gray(
        `  Community entries: ${communityData.length} → ${updatedCommunityData.length}\n`
      )
    );
  } catch (err) {
    logError("Failed to save updated data files", err);
    console.error(chalk.red("\n✗ Failed to save updated data files"));
    console.error(chalk.red(`  Error: ${err.message}\n`));
  }

  await showMainMenu();
};

// Copy showcase-data.json and screenshots to production locations
const copyToProduction = async () => {
  console.log(chalk.blue("\n=== Copy to Production ===\n"));

  // 1. Verify test mode
  if (!config.useTestData) {
    console.log(
      chalk.yellow("This operation is only available in TEST mode.\n")
    );
    await showMainMenu();
    return;
  }

  // 2. Verify source files exist
  const sourceShowcase = config.showcaseDataPath;
  const sourceScreenshots = screenshotDir;

  if (!fs.existsSync(sourceShowcase)) {
    console.error(
      chalk.red(`Source showcase-data.json not found at: ${sourceShowcase}\n`)
    );
    await showMainMenu();
    return;
  }

  if (!fs.existsSync(sourceScreenshots)) {
    console.error(
      chalk.red(
        `Source screenshots directory not found at: ${sourceScreenshots}\n`
      )
    );
    await showMainMenu();
    return;
  }

  // 3. Validate showcase-data.json
  let showcaseData;
  try {
    showcaseData = JSON.parse(fs.readFileSync(sourceShowcase, "utf-8"));
    if (!Array.isArray(showcaseData) || showcaseData.length === 0) {
      console.error(
        chalk.red(
          "Invalid showcase-data.json format: must be non-empty array\n"
        )
      );
      await showMainMenu();
      return;
    }
    console.log(
      chalk.green(`✓ Source file validated: ${showcaseData.length} entries`)
    );
  } catch (err) {
    console.error(
      chalk.red(`Invalid JSON in showcase-data.json: ${err.message}\n`)
    );
    await showMainMenu();
    return;
  }

  // 4. Define target paths
  const targetShowcase =
    "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb/showcase-data.json";
  const targetScreenshots =
    "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundle.dev/content/screenshots";

  console.log(chalk.gray("\nTarget paths:"));
  console.log(chalk.gray(`  Data: ${targetShowcase}`));
  console.log(chalk.gray(`  Screenshots: ${targetScreenshots}/\n`));

  // 5. Get screenshot copy mode
  const screenshotMode = await select({
    message: "Screenshot copy mode:",
    choices: [
      {
        name: "Copy only missing screenshots",
        value: "missing",
        description: "Skip files that already exist in target",
      },
      {
        name: "Copy all screenshots (overwrite)",
        value: "all",
        description: "Overwrite existing files in target",
      },
    ],
  });

  // 6. Count screenshots to copy
  let sourceFiles;
  try {
    sourceFiles = fs
      .readdirSync(sourceScreenshots)
      .filter((f) => f.endsWith(".jpg"));
  } catch (err) {
    console.error(
      chalk.red(`Failed to read screenshots directory: ${err.message}\n`)
    );
    await showMainMenu();
    return;
  }

  let filesToCopy = sourceFiles;

  if (screenshotMode === "missing") {
    // Check which files don't exist in target
    if (fs.existsSync(targetScreenshots)) {
      const existingFiles = new Set(fs.readdirSync(targetScreenshots));
      filesToCopy = sourceFiles.filter((f) => !existingFiles.has(f));
    }
  }

  // 7. Show summary and confirm
  console.log(chalk.cyan("\nCopy Summary:"));
  console.log(
    chalk.cyan(`  showcase-data.json (${showcaseData.length} entries)`)
  );
  console.log(
    chalk.cyan(
      `  ${filesToCopy.length} of ${sourceFiles.length} screenshots ${
        screenshotMode === "missing" ? "(missing only)" : "(all)"
      }`
    )
  );

  if (filesToCopy.length === 0 && screenshotMode === "missing") {
    console.log(
      chalk.yellow(
        "\nNo missing screenshots to copy. All screenshots already exist in target.\n"
      )
    );
    const copyDataOnly = await confirm({
      message: "Copy showcase-data.json only?",
      default: true,
    });
    if (!copyDataOnly) {
      console.log(chalk.yellow("Operation cancelled\n"));
      await showMainMenu();
      return;
    }
  } else {
    console.log("");
    const confirmed = await confirm({
      message: "Proceed with copy?",
      default: false,
    });

    if (!confirmed) {
      console.log(chalk.yellow("\nOperation cancelled\n"));
      await showMainMenu();
      return;
    }
  }

  // 8. Create target directories
  console.log("");
  try {
    fs.mkdirSync(path.dirname(targetShowcase), { recursive: true });
    console.log(chalk.gray("✓ Target data directory ready"));
  } catch (err) {
    console.error(
      chalk.red(`Failed to create target data directory: ${err.message}\n`)
    );
    await showMainMenu();
    return;
  }

  if (filesToCopy.length > 0) {
    try {
      fs.mkdirSync(targetScreenshots, { recursive: true });
      console.log(chalk.gray("✓ Target screenshots directory ready"));
    } catch (err) {
      console.error(
        chalk.red(
          `Failed to create target screenshots directory: ${err.message}\n`
        )
      );
      await showMainMenu();
      return;
    }
  }

  // 9. Copy showcase-data.json
  console.log("");
  try {
    fs.copyFileSync(sourceShowcase, targetShowcase);
    console.log(chalk.green("✓ showcase-data.json copied"));
  } catch (err) {
    console.error(
      chalk.red(`Failed to copy showcase-data.json: ${err.message}\n`)
    );
    await showMainMenu();
    return;
  }

  // 10. Copy screenshots with progress
  if (filesToCopy.length > 0) {
    console.log(chalk.gray("\nCopying screenshots..."));
    try {
      for (let i = 0; i < filesToCopy.length; i++) {
        const file = filesToCopy[i];
        fs.copyFileSync(
          path.join(sourceScreenshots, file),
          path.join(targetScreenshots, file)
        );

        // Show progress every 50 files
        if ((i + 1) % 50 === 0 || i === filesToCopy.length - 1) {
          console.log(chalk.gray(`  Progress: ${i + 1}/${filesToCopy.length}`));
        }
      }
    } catch (err) {
      console.error(chalk.red(`\nFailed to copy screenshot: ${err.message}`));
      console.error(
        chalk.red(`Aborted at file ${filesToCopy[i] || "unknown"}\n`)
      );
      await showMainMenu();
      return;
    }
  }

  console.log(chalk.green("\n✓ Copy to production complete!"));
  if (filesToCopy.length > 0) {
    console.log(
      chalk.gray(`  ${filesToCopy.length} screenshots copied successfully\n`)
    );
  } else {
    console.log(chalk.gray("  No screenshots needed copying\n"));
  }

  await showMainMenu();
};

// Main menu
const showMainMenu = async () => {
  console.log(chalk.blue.bold("\n📦 Showcase Data Generator\n"));

  const operation = await select({
    message: "Choose an operation:",
    choices: [
      {
        name: "1. Update with new bundledb entries",
        value: "update-bundledb",
        description: "Add new site entries from bundledb to showcase-data.json",
      },
      {
        name: "2. Update with new community entries",
        value: "update-community",
        description: "Add new entries from GitHub community repo",
      },
      {
        name: "3. Generate screenshots for showcase entries",
        value: "screenshots",
        description: "Capture website screenshots for all showcase entries",
      },
      {
        name: "4. Copy to production",
        value: "copy-production",
        description:
          "Copy showcase-data.json and screenshots to production website (test mode only)",
      },
      {
        name: "5. Remove failed screenshot entries",
        value: "remove-failed",
        description:
          "Remove entries that failed screenshot generation from both data files",
      },
      {
        name: "6. Create showcase-data.json from scratch",
        value: "create",
        description:
          "Generate complete showcase data from bundledb + community data",
      },
      {
        name: "7. Exit",
        value: "exit",
      },
    ],
  });

  switch (operation) {
    case "create":
      await createShowcaseFromScratch();
      break;
    case "screenshots":
      await generateScreenshots();
      break;
    case "update-bundledb":
      await updateWithBundledbEntries();
      break;
    case "update-community":
      await updateWithCommunityEntries();
      break;
    case "remove-failed":
      await removeFailedEntries();
      break;
    case "copy-production":
      await copyToProduction();
      break;
    case "exit":
      console.log(chalk.gray("Goodbye!"));
      process.exit(0);
  }
};

// Initialize and start
const init = async () => {
  console.log(chalk.blue.bold("\n🎯 11ty Bundle - Showcase Data Generator\n"));

  // Prompt for test/production mode
  const mode = await select({
    message: "Select data mode:",
    choices: [
      {
        name: "Test data (dbtools/devdata/)",
        value: "test",
        description: "Use test database and write to devdata directory",
      },
      {
        name: "Production data (11tybundledb/)",
        value: "production",
        description:
          "Use production database and write to 11tybundledb directory",
      },
    ],
  });

  // Set configuration based on mode
  if (mode === "test") {
    config = {
      dbFilePath:
        "/Users/Bob/Dropbox/Docs/Sites/11tybundle/dbtools/devdata/bundledb.json",
      communityDataPath:
        "/Users/Bob/Dropbox/Docs/Sites/11tybundle/dbtools/devdata/community-data.json",
      showcaseDataPath:
        "/Users/Bob/Dropbox/Docs/Sites/11tybundle/dbtools/devdata/showcase-data.json",
      syncMetadataPath:
        "/Users/Bob/Dropbox/Docs/Sites/11tybundle/dbtools/devdata/showcase-sync-metadata.json",
      useTestData: true,
    };
  } else {
    config = {
      dbFilePath:
        "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb/bundledb.json",
      communityDataPath:
        "/Users/Bob/Dropbox/Docs/Sites/11tybundle/dbtools/devdata/community-data.json",
      showcaseDataPath:
        "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb/showcase-data.json",
      syncMetadataPath:
        "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb/showcase-sync-metadata.json",
      useTestData: false,
    };
  }

  console.log(chalk.gray(`\nMode: ${mode === "test" ? "TEST" : "PRODUCTION"}`));
  console.log(chalk.gray(`Database: ${config.dbFilePath}`));
  console.log(chalk.gray(`Output: ${config.showcaseDataPath}\n`));

  await showMainMenu();
};

// Run the script
init().catch((err) => {
  console.error(chalk.red("\n✗ Fatal error:"), err);
  logError("Fatal error in main script", err);
  process.exit(1);
});
