#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";
import { rawlist } from "@inquirer/prompts";
import { config } from "./config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

// Indentation constant
const INDENT = "    "; // 4 spaces

// Styled output helpers
const separator = () => console.log(chalk.dim("---"));
const blankLine = () => console.log();
const sectionHeader = (text) => {
  blankLine();
  console.log(chalk.yellow(text));
};
const promptLabel = (text) => console.log(chalk.cyan(text));
const dataField = (label, value) =>
  console.log(chalk.white(`${INDENT}${label}: ${value}`));
const successMessage = (text) => {
  blankLine();
  console.log(chalk.green(`${INDENT}${text}`));
  blankLine();
};
const errorMessage = (text) => {
  blankLine();
  console.log(chalk.red(`${INDENT}${text}`));
  blankLine();
};
const infoMessage = (text) => {
  blankLine();
  console.log(chalk.white(`${INDENT}${text}`));
  blankLine();
};
const statusMessage = (text) => console.log(chalk.cyan(`${INDENT}${text}`));

// ============================================================================

// Make dbFilePath mutable for dataset selection
let dbFilePath = config.dbFilePath;

// Function to prompt for dataset selection and update runtime configuration
const selectDataset = async () => {
  const datasetChoice = await rawlist({
    message: "Select which dataset to use:",
    choices: [
      { name: "Production dataset (11tybundledb)", value: "production" },
      {
        name: "Development dataset (devdata in this project)",
        value: "development",
      },
      { name: chalk.dim("Exit"), value: "exit" },
    ],
    default: "production",
  });

  // Handle exit
  if (datasetChoice === "exit") {
    console.log(chalk.yellow("\n👋 Exiting...\n"));
    process.exit(0);
  }

  // Update runtime configuration based on selection
  if (datasetChoice === "production") {
    dbFilePath =
      "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb/bundledb.json";
    successMessage("✓ Using Production dataset (11tybundledb)");
  } else {
    dbFilePath =
      "/Users/Bob/Dropbox/Docs/Sites/11tybundle/dbtools/devdata/bundledb.json";
    successMessage("✓ Using Development dataset (devdata)");
  }
};

// ============================================================================

// Check for help flag
if (process.argv.includes("-h") || process.argv.includes("--help")) {
  console.log(`
${chalk.yellow("Check Link Errors")}
${chalk.dim("=================")}}

Scans all links in the bundledb database to detect broken or problematic URLs.

USAGE:
  node check-link-errors.js [OPTIONS]

OPTIONS:
  -h, --help     Show this help message

DESCRIPTION:
  This script checks all links in the database (excluding those with a Skip
  property) for HTTP errors and connection issues. It categorizes errors into:

  PERMANENT ERRORS:
  - 404 Not Found, 410 Gone
  - DNS resolution failures
  These indicate content is likely permanently unavailable.

  ACCESS RESTRICTED:
  - 403 Forbidden, 429 Too Many Requests
  Sites exist but block automated access or rate limit requests.

  TEMPORARY ERRORS:
  - 5xx Server Errors
  - Timeouts, Connection Refused, SSL/Certificate issues
  These may resolve on their own and should be rechecked later.

  The script attempts HEAD requests first, then retries failures with
  GET requests using browser headers for better compatibility.

  Results are saved to:
  - log/permanent-errors.txt
  - log/access-restricted.txt
  - log/temporary-errors.txt

DATABASE:
  ${config.dbFilePath}

EXAMPLES:
  node check-link-errors.js    # Check all links in database
`);
  process.exit(0);
}

// Main async function
const checkLinks = async () => {
  sectionHeader("🔗 Check for Link Errors");

  // Prompt for dataset selection
  await selectDataset();

  // Read the bundledb file
  statusMessage(`Reading database from: ${dbFilePath}`);
  blankLine();
  const data = fs.readFileSync(dbFilePath, "utf8");
  const bundledb = JSON.parse(data);

  infoMessage(`Total entries in database: ${bundledb.length}`);

  // Filter out entries with Skip property
  const entriesToCheck = bundledb.filter(
    (entry) => !entry.hasOwnProperty("Skip") && entry.Link,
  );

  infoMessage(`Entries to check (excluding Skip): ${entriesToCheck.length}`);

  const permanentErrors = []; // 404, 410, DNS failures
  const accessRestrictedErrors = []; // 403, 429
  const temporaryErrors = []; // 5xx, timeouts, network errors
  let checkedCount = 0;

  // Browser headers for GET fallback requests
  const browserHeaders = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
  };

  statusMessage("Checking links for errors...");
  blankLine();

  // Check each link
  for (let i = 0; i < entriesToCheck.length; i++) {
    const entry = entriesToCheck[i];
    const link = entry.Link;

    // Show progress every 50 entries
    if ((i + 1) % 50 === 0) {
      console.log(
        chalk.dim(
          `${INDENT}Progress: ${i + 1}/${entriesToCheck.length} checked...`,
        ),
      );
    }

    let response = null;
    let fetchError = null;
    let retried = false;

    // First attempt: HEAD request
    try {
      response = await fetch(link, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(10000),
      });
    } catch (error) {
      fetchError = error;
    }

    // If HEAD failed, retry with GET + browser headers after delay
    if (fetchError || (response && !response.ok)) {
      await new Promise((resolve) => setTimeout(resolve, 1500)); // 1.5 second delay
      retried = true;

      try {
        response = await fetch(link, {
          method: "GET",
          headers: browserHeaders,
          redirect: "follow",
          signal: AbortSignal.timeout(10000),
        });
        fetchError = null; // Clear error if GET succeeds
      } catch (error) {
        fetchError = error;
      }
    }

    const entryInfo = {
      link: link,
      title: entry.Title || "N/A",
      author: entry.Author || "N/A",
      type: entry.Type || "N/A",
    };

    // Process results from final attempt
    if (!fetchError && response) {
      entryInfo.status = response.status;

      // Check for permanent errors
      if (response.status === 404) {
        console.log(chalk.red(`${INDENT}✗ 404 Not Found: ${link}`));
        entryInfo.errorType = "404 Not Found";
        permanentErrors.push(entryInfo);
      } else if (response.status === 410) {
        console.log(chalk.red(`${INDENT}✗ 410 Gone: ${link}`));
        entryInfo.errorType = "410 Gone";
        permanentErrors.push(entryInfo);
      }
      // Check for access restricted
      else if (response.status === 403) {
        console.log(
          chalk.magenta(
            `${INDENT}✗ 403 Forbidden (Access Restricted): ${link}`,
          ),
        );
        entryInfo.errorType = "403 Forbidden";
        accessRestrictedErrors.push(entryInfo);
      } else if (response.status === 429) {
        console.log(
          chalk.magenta(
            `${INDENT}✗ 429 Too Many Requests (Access Restricted): ${link}`,
          ),
        );
        entryInfo.errorType = "429 Too Many Requests";
        accessRestrictedErrors.push(entryInfo);
      }
      // Check for temporary/server errors
      else if (response.status >= 500) {
        console.log(
          chalk.yellow(`${INDENT}✗ ${response.status} Server Error: ${link}`),
        );
        entryInfo.errorType = `${response.status} Server Error`;
        temporaryErrors.push(entryInfo);
      }
    } else if (fetchError) {
      // Handle network errors after retry
      entryInfo.errorType = fetchError.name || "Network Error";
      entryInfo.errorMessage = fetchError.message || "Unknown error";

      if (
        fetchError.name === "TimeoutError" ||
        fetchError.message?.includes("timeout")
      ) {
        console.log(chalk.yellow(`${INDENT}✗ Timeout: ${link}`));
        entryInfo.errorType = "Timeout";
        temporaryErrors.push(entryInfo);
      } else if (
        fetchError.message?.includes("DNS") ||
        fetchError.message?.includes("ENOTFOUND")
      ) {
        console.log(chalk.red(`${INDENT}✗ DNS Error: ${link}`));
        entryInfo.errorType = "DNS Resolution Failed";
        permanentErrors.push(entryInfo);
      } else if (
        fetchError.message?.includes("certificate") ||
        fetchError.message?.includes("SSL")
      ) {
        console.log(chalk.yellow(`${INDENT}✗ SSL/Certificate Error: ${link}`));
        entryInfo.errorType = "SSL/Certificate Error";
        temporaryErrors.push(entryInfo);
      } else if (fetchError.message?.includes("ECONNREFUSED")) {
        console.log(chalk.yellow(`${INDENT}✗ Connection Refused: ${link}`));
        entryInfo.errorType = "Connection Refused";
        temporaryErrors.push(entryInfo);
      } else {
        console.log(chalk.yellow(`${INDENT}✗ Network Error: ${link}`));
        temporaryErrors.push(entryInfo);
      }
    }

    checkedCount++;

    // Small delay to be respectful to servers
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  blankLine();
  successMessage(`✓ Checked ${checkedCount} links`);
  console.log(
    chalk.red(`${INDENT}✗ Permanent errors: ${permanentErrors.length}`),
  );
  console.log(
    chalk.magenta(
      `${INDENT}✗ Access restricted: ${accessRestrictedErrors.length}`,
    ),
  );
  console.log(
    chalk.yellow(`${INDENT}✗ Temporary errors: ${temporaryErrors.length}`),
  );
  blankLine();

  const logDir = path.join(__dirname, "log");

  // Ensure log directory exists
  fs.mkdirSync(logDir, { recursive: true });

  // Write permanent errors to file
  if (permanentErrors.length > 0) {
    const outputFile = path.join(logDir, "permanent-errors.txt");

    let output = `Permanent Link Errors Report\n`;
    output += `Generated: ${new Date().toISOString()}\n`;
    output += `Total permanent errors found: ${permanentErrors.length}\n`;
    output += `${"=".repeat(80)}\n\n`;
    output += `These errors indicate the content is likely permanently unavailable:\n`;
    output += `- 404 Not Found, 410 Gone, DNS failures\n\n`;

    permanentErrors.forEach((item, index) => {
      output += `${index + 1}. ${item.title}\n`;
      output += `   Error: ${item.errorType}\n`;
      output += `   Link: ${item.link}\n`;
      output += `   Author: ${item.author}\n`;
      output += `   Type: ${item.type}\n`;
      if (item.errorMessage) {
        output += `   Details: ${item.errorMessage}\n`;
      }
      output += `\n`;
    });

    fs.writeFileSync(outputFile, output);
    successMessage(`Permanent errors written to: ${outputFile}`);
  }

  // Write access restricted errors to file
  if (accessRestrictedErrors.length > 0) {
    const outputFile = path.join(logDir, "access-restricted.txt");

    let output = `Access Restricted Errors Report\n`;
    output += `Generated: ${new Date().toISOString()}\n`;
    output += `Total access restricted errors found: ${accessRestrictedErrors.length}\n`;
    output += `${"=".repeat(80)}\n\n`;
    output += `These sites exist but block automated access or rate limit requests:\n`;
    output += `- 403 Forbidden, 429 Too Many Requests\n\n`;

    accessRestrictedErrors.forEach((item, index) => {
      output += `${index + 1}. ${item.title}\n`;
      output += `   Error: ${item.errorType}\n`;
      output += `   Link: ${item.link}\n`;
      output += `   Author: ${item.author}\n`;
      output += `   Type: ${item.type}\n`;
      if (item.errorMessage) {
        output += `   Details: ${item.errorMessage}\n`;
      }
      output += `\n`;
    });

    fs.writeFileSync(outputFile, output);
    successMessage(`Access restricted errors written to: ${outputFile}`);
  }

  // Write temporary errors to file
  if (temporaryErrors.length > 0) {
    const outputFile = path.join(logDir, "temporary-errors.txt");

    let output = `Temporary Link Errors Report\n`;
    output += `Generated: ${new Date().toISOString()}\n`;
    output += `Total temporary errors found: ${temporaryErrors.length}\n`;
    output += `${"=".repeat(80)}\n\n`;
    output += `These errors may be temporary - consider re-checking later:\n`;
    output += `- 5xx Server Errors, Timeouts, Connection Refused, SSL/Certificate issues\n\n`;

    temporaryErrors.forEach((item, index) => {
      output += `${index + 1}. ${item.title}\n`;
      output += `   Error: ${item.errorType}\n`;
      output += `   Link: ${item.link}\n`;
      output += `   Author: ${item.author}\n`;
      output += `   Type: ${item.type}\n`;
      if (item.errorMessage) {
        output += `   Details: ${item.errorMessage}\n`;
      }
      output += `\n`;
    });

    fs.writeFileSync(outputFile, output);
    successMessage(`Temporary errors written to: ${outputFile}`);
  }
  if (
    permanentErrors.length === 0 &&
    accessRestrictedErrors.length === 0 &&
    temporaryErrors.length === 0
  ) {
    successMessage("No errors found. No files created.");
  }

  successMessage("✓ Done!");
};

// Run the script
checkLinks();
