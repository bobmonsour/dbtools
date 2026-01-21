import fs from "fs";
import path from "path";
import chalk from "chalk";

//***************
// Generate Latest Issue Data
// This script creates filtered datasets for the latest issue:
// 1. bundledb-latest-issue.json - Entries from the latest issue
// 2. showcase-data-latest-issue.json - Showcase entries matching the date range
//***************

// Hardcoded paths to production 11tybundledb directory
const PROD_DB_DIR = "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb";
const BUNDLEDB_PATH = path.join(PROD_DB_DIR, "bundledb.json");
const SHOWCASE_DATA_PATH = path.join(PROD_DB_DIR, "showcase-data.json");
const BUNDLEDB_OUTPUT_PATH = path.join(
  PROD_DB_DIR,
  "bundledb-latest-issue.json",
);
const SHOWCASE_OUTPUT_PATH = path.join(
  PROD_DB_DIR,
  "showcase-data-latest-issue.json",
);

// Error log file path
const ERROR_LOG_PATH = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "./log/latest-issues-error.log",
);

// Function to log errors to file
function logError(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  try {
    fs.appendFileSync(ERROR_LOG_PATH, logMessage, "utf8");
  } catch (err) {
    console.error(chalk.red("Failed to write to error log:"), err);
  }
}

// Function to clear the error log at start
function clearErrorLog() {
  try {
    fs.writeFileSync(ERROR_LOG_PATH, "", "utf8");
  } catch (err) {
    console.error(chalk.red("Failed to clear error log:"), err);
  }
}

// Function to find the latest issue number
function getLatestIssueNumber(entries) {
  let maxIssue = 0;
  for (const entry of entries) {
    if (entry.Issue) {
      const issueNum = parseInt(entry.Issue, 10);
      if (!isNaN(issueNum)) {
        maxIssue = Math.max(maxIssue, issueNum);
      }
    }
  }
  return maxIssue;
}

// Function to count entries by type
function countByType(entries) {
  const counts = {
    "blog post": 0,
    site: 0,
    release: 0,
    starter: 0,
    other: 0,
  };

  for (const entry of entries) {
    const type = entry.Type ? entry.Type.toLowerCase() : "other";
    if (counts.hasOwnProperty(type)) {
      counts[type]++;
    } else {
      counts.other++;
    }
  }

  return counts;
}

// Function to find the earliest date from entries
function getEarliestDate(entries) {
  let earliestDate = null;

  for (const entry of entries) {
    if (entry.Date) {
      const entryDate = new Date(entry.Date);
      if (!isNaN(entryDate.getTime())) {
        if (!earliestDate || entryDate < earliestDate) {
          earliestDate = entryDate;
        }
      }
    }
  }

  return earliestDate;
}

// Main function
async function generateLatestData() {
  console.log(chalk.blue("\n=== Generating Latest Issue Data ===\n"));

  // Clear error log at start
  clearErrorLog();

  try {
    // Step 1: Read bundledb.json
    console.log(chalk.yellow("Reading bundledb.json..."));
    let bundleData;
    try {
      const bundleContent = fs.readFileSync(BUNDLEDB_PATH, "utf8");
      bundleData = JSON.parse(bundleContent);
    } catch (err) {
      const errorMsg = `Failed to read bundledb.json: ${err.message}`;
      console.error(chalk.red(errorMsg));
      logError(errorMsg);
      return;
    }

    if (!Array.isArray(bundleData) || bundleData.length === 0) {
      const errorMsg = "bundledb.json is empty or not an array";
      console.error(chalk.red(errorMsg));
      logError(errorMsg);
      return;
    }

    // Step 2: Find latest issue number
    const latestIssue = getLatestIssueNumber(bundleData);
    if (latestIssue === 0) {
      const errorMsg = "No valid issue numbers found in bundledb.json";
      console.error(chalk.red(errorMsg));
      logError(errorMsg);
      return;
    }
    console.log(chalk.green(`Found latest issue: #${latestIssue}`));

    // Step 3: Filter entries for latest issue
    const latestIssueEntries = bundleData.filter((entry) => {
      const issueNum = parseInt(entry.Issue, 10);
      return !isNaN(issueNum) && issueNum === latestIssue;
    });

    if (latestIssueEntries.length === 0) {
      const errorMsg = `No entries found for issue #${latestIssue}`;
      console.error(chalk.red(errorMsg));
      logError(errorMsg);
      return;
    }

    // Step 4: Write bundledb-latest-issue.json
    console.log(
      chalk.yellow(
        `Writing ${latestIssueEntries.length} entries to bundledb-latest-issue.json...`,
      ),
    );
    try {
      fs.writeFileSync(
        BUNDLEDB_OUTPUT_PATH,
        JSON.stringify(latestIssueEntries, null, 2),
        "utf8",
      );
      console.log(
        chalk.green(`✓ Created: ${path.basename(BUNDLEDB_OUTPUT_PATH)}`),
      );
    } catch (err) {
      const errorMsg = `Failed to write bundledb-latest-issue.json: ${err.message}`;
      console.error(chalk.red(errorMsg));
      logError(errorMsg);
      return;
    }

    // Step 5: Get counts by type
    const typeCounts = countByType(latestIssueEntries);

    // Step 6: Find earliest date from latest issue entries
    const earliestDate = getEarliestDate(latestIssueEntries);
    if (!earliestDate) {
      const errorMsg = "No valid dates found in latest issue entries";
      console.error(chalk.red(errorMsg));
      logError(errorMsg);
      return;
    }
    console.log(
      chalk.green(
        `Earliest date in latest issue: ${earliestDate.toISOString().split("T")[0]}`,
      ),
    );

    // Step 7: Read showcase-data.json
    console.log(chalk.yellow("\nReading showcase-data.json..."));
    let showcaseData;
    try {
      const showcaseContent = fs.readFileSync(SHOWCASE_DATA_PATH, "utf8");
      showcaseData = JSON.parse(showcaseContent);
    } catch (err) {
      const errorMsg = `Failed to read showcase-data.json: ${err.message}`;
      console.error(chalk.red(errorMsg));
      logError(errorMsg);
      return;
    }

    if (!Array.isArray(showcaseData)) {
      const errorMsg = "showcase-data.json is not an array";
      console.error(chalk.red(errorMsg));
      logError(errorMsg);
      return;
    }

    // Step 8: Filter showcase entries by date
    const filteredShowcaseEntries = [];
    let skippedCount = 0;

    for (const entry of showcaseData) {
      if (!entry.date) {
        skippedCount++;
        const errorMsg = `Showcase entry missing date field: ${entry.url || entry.name || "unknown"}`;
        logError(errorMsg);
        continue;
      }

      const entryDate = new Date(entry.date);
      if (isNaN(entryDate.getTime())) {
        skippedCount++;
        const errorMsg = `Invalid date in showcase entry: ${entry.date} for ${entry.url || entry.name || "unknown"}`;
        logError(errorMsg);
        continue;
      }

      if (entryDate >= earliestDate) {
        filteredShowcaseEntries.push(entry);
      }
    }

    if (skippedCount > 0) {
      console.log(
        chalk.yellow(
          `⚠ Skipped ${skippedCount} showcase entries with missing/invalid dates (see error log)`,
        ),
      );
    }

    // Step 9: Write showcase-data-latest-issue.json
    console.log(
      chalk.yellow(
        `Writing ${filteredShowcaseEntries.length} entries to showcase-data-latest-issue.json...`,
      ),
    );
    try {
      fs.writeFileSync(
        SHOWCASE_OUTPUT_PATH,
        JSON.stringify(filteredShowcaseEntries, null, 2),
        "utf8",
      );
      console.log(
        chalk.green(`✓ Created: ${path.basename(SHOWCASE_OUTPUT_PATH)}`),
      );
    } catch (err) {
      const errorMsg = `Failed to write showcase-data-latest-issue.json: ${err.message}`;
      console.error(chalk.red(errorMsg));
      logError(errorMsg);
      return;
    }

    // Step 10: Display success summary
    console.log(chalk.blue("\n=== Summary ==="));
    console.log(chalk.green(`Latest Issue: #${latestIssue}`));
    console.log(chalk.cyan("\nBundle Database Entries:"));
    if (typeCounts["blog post"] > 0) {
      console.log(chalk.cyan(`  Blog posts: ${typeCounts["blog post"]}`));
    }
    if (typeCounts.site > 0) {
      console.log(chalk.cyan(`  Sites: ${typeCounts.site}`));
    }
    if (typeCounts.release > 0) {
      console.log(chalk.cyan(`  Releases: ${typeCounts.release}`));
    }
    if (typeCounts.starter > 0) {
      console.log(chalk.cyan(`  Starters: ${typeCounts.starter}`));
    }
    if (typeCounts.other > 0) {
      console.log(chalk.cyan(`  Other: ${typeCounts.other}`));
    }
    console.log(
      chalk.cyan(`  Total: ${latestIssueEntries.length} entries written`),
    );
    console.log(
      chalk.cyan(
        `\nShowcase Entries: ${filteredShowcaseEntries.length} entries written`,
      ),
    );
    console.log(chalk.green("\n✓ Latest issue data generation complete!\n"));
  } catch (err) {
    const errorMsg = `Unexpected error: ${err.message}`;
    console.error(chalk.red(errorMsg));
    logError(errorMsg);
    console.error(err);
  }
}

// Run the script
generateLatestData();
