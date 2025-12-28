#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { config } from "./config.js";

console.log("\n=== Check for Link Errors ===\n");

// Read the bundledb file
console.log(`Reading bundledb from: ${config.dbFilePath}\n`);
const data = fs.readFileSync(config.dbFilePath, "utf8");
const bundledb = JSON.parse(data);

console.log(`Total entries in database: ${bundledb.length}\n`);

// Filter out entries with Skip property
const entriesToCheck = bundledb.filter(
  (entry) => !entry.hasOwnProperty("Skip") && entry.Link
);

console.log(`Entries to check (excluding Skip): ${entriesToCheck.length}\n`);

const permanentErrors = []; // 404, 410, 403
const temporaryErrors = []; // 5xx, timeouts, network errors
let checkedCount = 0;

console.log("Checking links for errors...\n");

// Check each link
for (let i = 0; i < entriesToCheck.length; i++) {
  const entry = entriesToCheck[i];
  const link = entry.Link;

  // Show progress every 50 entries
  if ((i + 1) % 50 === 0) {
    console.log(`Progress: ${i + 1}/${entriesToCheck.length} checked...`);
  }

  try {
    const response = await fetch(link, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    const entryInfo = {
      link: link,
      title: entry.Title || "N/A",
      author: entry.Author || "N/A",
      type: entry.Type || "N/A",
      status: response.status,
    };

    // Check for permanent errors
    if (response.status === 404) {
      console.log(`✗ 404 Not Found: ${link}`);
      entryInfo.errorType = "404 Not Found";
      permanentErrors.push(entryInfo);
    } else if (response.status === 410) {
      console.log(`✗ 410 Gone: ${link}`);
      entryInfo.errorType = "410 Gone";
      permanentErrors.push(entryInfo);
    } else if (response.status === 403) {
      console.log(`✗ 403 Forbidden: ${link}`);
      entryInfo.errorType = "403 Forbidden";
      permanentErrors.push(entryInfo);
    }
    // Check for temporary/server errors
    else if (response.status >= 500) {
      console.log(`✗ ${response.status} Server Error: ${link}`);
      entryInfo.errorType = `${response.status} Server Error`;
      temporaryErrors.push(entryInfo);
    } else if (response.status === 429) {
      console.log(`✗ 429 Too Many Requests: ${link}`);
      entryInfo.errorType = "429 Too Many Requests";
      temporaryErrors.push(entryInfo);
    }

    checkedCount++;
  } catch (error) {
    // Handle network errors, timeouts, DNS failures, etc.
    const entryInfo = {
      link: link,
      title: entry.Title || "N/A",
      author: entry.Author || "N/A",
      type: entry.Type || "N/A",
      errorType: error.name || "Network Error",
      errorMessage: error.message || "Unknown error",
    };

    if (error.name === "TimeoutError" || error.message?.includes("timeout")) {
      console.log(`✗ Timeout: ${link}`);
      entryInfo.errorType = "Timeout";
      temporaryErrors.push(entryInfo);
    } else if (
      error.message?.includes("DNS") ||
      error.message?.includes("ENOTFOUND")
    ) {
      console.log(`✗ DNS Error: ${link}`);
      entryInfo.errorType = "DNS Resolution Failed";
      permanentErrors.push(entryInfo); // DNS failures are usually permanent
    } else if (
      error.message?.includes("certificate") ||
      error.message?.includes("SSL")
    ) {
      console.log(`✗ SSL/Certificate Error: ${link}`);
      entryInfo.errorType = "SSL/Certificate Error";
      temporaryErrors.push(entryInfo);
    } else if (error.message?.includes("ECONNREFUSED")) {
      console.log(`✗ Connection Refused: ${link}`);
      entryInfo.errorType = "Connection Refused";
      temporaryErrors.push(entryInfo);
    } else {
      console.log(`✗ Network Error: ${link}`);
      temporaryErrors.push(entryInfo);
    }

    checkedCount++;
  }

  // Small delay to be respectful to servers
  await new Promise((resolve) => setTimeout(resolve, 100));
}

console.log(`\n✓ Checked ${checkedCount} links`);
console.log(`✗ Permanent errors: ${permanentErrors.length}`);
console.log(`✗ Temporary errors: ${temporaryErrors.length}\n`);

const logDir = path.join(
  path.dirname(config.dbFilePath),
  "..",
  "dbtools",
  "log"
);

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
  output += `- 404 Not Found, 410 Gone, 403 Forbidden, DNS failures\n\n`;

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
  console.log(`Permanent errors written to: ${outputFile}`);
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
  console.log(`Temporary errors written to: ${outputFile}`);
}

if (permanentErrors.length === 0 && temporaryErrors.length === 0) {
  console.log("No errors found. No files created.");
}

console.log("\nDone!\n");
