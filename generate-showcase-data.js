import { select, confirm } from "@inquirer/prompts";
import fs from "fs";
import path from "path";
import chalk from "chalk";
import { AssetCache } from "@11ty/eleventy-fetch";
import puppeteer from "puppeteer";
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
  useTestData: true,
};

// Error log file path
const errorLogPath = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "./log/showcase-data-errors.log"
);

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

// Normalize URL for comparison (strip www, normalize protocol)
const normalizeUrl = (url) => {
  try {
    const urlObj = new URL(url);
    let hostname = urlObj.hostname.toLowerCase();

    // Strip www. prefix
    if (hostname.startsWith("www.")) {
      hostname = hostname.substring(4);
    }

    // Always use https for comparison
    return `https://${hostname}${urlObj.pathname}${urlObj.search}`;
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

// Main menu
const showMainMenu = async () => {
  console.log(chalk.blue.bold("\n📦 Showcase Data Generator\n"));

  const operation = await select({
    message: "Choose an operation:",
    choices: [
      {
        name: "Create showcase-data.json from scratch",
        value: "create",
        description:
          "Generate complete showcase data from bundledb + community data",
      },
      {
        name: "Generate screenshots for showcase entries",
        value: "screenshots",
        description: "Capture website screenshots for all showcase entries",
      },
      {
        name: "Exit",
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
