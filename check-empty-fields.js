#!/usr/bin/env node

import fs from "fs";
import { rawlist, input, confirm as confirmPrompt } from "@inquirer/prompts";
import chalk from "chalk";
import { config } from "./config.js";
import { getDescription } from "./getdescription.js";
import { getRSSLink } from "./getrsslink.js";
import { makeBackupFile } from "./utils.js";

// Check for help flag
if (process.argv.includes("-h") || process.argv.includes("--help")) {
  console.log(`
Check Empty Fields
==================

Interactive script to find and fill empty description and rssLink fields
in the bundledb database by fetching data from the web.

USAGE:
  node check-empty-fields.js [OPTIONS]

OPTIONS:
  -h, --help     Show this help message

DESCRIPTION:
  This script provides an interactive menu to:

  1. Process the entire database
     - Scans all entries for empty description or rssLink fields
     - Attempts to fetch missing data from the web

  2. Process a specific domain
     - Filter entries by domain (e.g., benmyers.dev)
     - Choose to auto-fetch all empty fields, or
     - Manually provide an RSS link for all entries from that domain

  The script creates a backup before making any changes and provides
  a summary of what will be updated before proceeding.

DATABASE:
  ${config.dbFilePath}

EXAMPLES:
  node check-empty-fields.js    # Start interactive mode
`);
  process.exit(0);
}

// Delay function to avoid overwhelming servers
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    ],
    default: "production",
  });

  // Update runtime configuration based on selection
  if (datasetChoice === "production") {
    config.dbFilePath =
      "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb/bundledb.json";
    config.dbBackupDir =
      "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb/bundledb-backups";
    config.dbFileDir = "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb";

    console.log(chalk.green("✓ Using Production dataset (11tybundledb)"));
  } else {
    config.dbFilePath =
      "/Users/Bob/Dropbox/Docs/Sites/11tybundle/dbtools/devdata/bundledb.json";
    config.dbBackupDir =
      "/Users/Bob/Dropbox/Docs/Sites/11tybundle/dbtools/devdata/bundledb-backups";
    config.dbFileDir =
      "/Users/Bob/Dropbox/Docs/Sites/11tybundle/dbtools/devdata";

    console.log(
      chalk.green("✓ Using Development dataset (devdata in this project)")
    );
  }

  console.log();
};

// Main function
async function main() {
  try {
    // Prompt for dataset selection
    await selectDataset();

    // Read the bundledb file
    console.log(`Reading bundledb from: ${config.dbFilePath}\n`);
    const data = fs.readFileSync(config.dbFilePath, "utf8");
    const bundledb = JSON.parse(data);

    console.log(`Total entries in database: ${bundledb.length}\n`);

    // Start the processing loop
    await processLoop(bundledb);
  } catch (error) {
    console.error("Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Processing loop function
async function processLoop(bundledb) {
  while (true) {
    // Prompt user for processing option
    const choice = await rawlist({
      message: "Do you want to process:",
      choices: [
        { name: "Entire file", value: "1" },
        { name: "Only a particular domain", value: "2" },
        { name: "Exit", value: "3" },
      ],
    });

    let entriesToProcess = [];
    let manualRssLink = null;
    let fullDataset = [];

    if (choice === "1") {
      // Process entire file
      fullDataset = bundledb;
      entriesToProcess = getEntriesWithEmptyFields(bundledb);
      console.log("\n=== Processing Entire File ===\n");
    } else if (choice === "2") {
      // Process specific domain
      const domain = await input({
        message: "Enter the domain to filter (e.g., benmyers.dev):",
      });
      const domainEntries = filterByDomain(bundledb, domain.trim());
      fullDataset = domainEntries;

      console.log(`\n=== Domain: ${domain.trim()} ===\n`);

      // Get entries with empty fields for display
      const domainEntriesWithEmpty = getEntriesWithEmptyFields(domainEntries);

      // Always show the summary for domain before asking what to do
      displayEmptyFieldsSummary(fullDataset, domainEntriesWithEmpty);
      console.log();

      // If there are no entries with empty fields, loop back to start
      if (domainEntriesWithEmpty.length === 0) {
        console.log("✓ No entries found with empty fields for this domain.\n");
        continue; // Go back to the start
      }

      // Ask user how they want to process the domain
      const domainChoice = await rawlist({
        message: "Do you want to:",
        choices: [
          { name: "Process all empty fields", value: "1" },
          { name: "Enter an RSS link", value: "2" },
        ],
      });

      if (domainChoice === "1") {
        // Process all empty fields as normal
        entriesToProcess = domainEntriesWithEmpty;
        console.log(`\n=== Processing All Empty Fields ===\n`);
      } else if (domainChoice === "2") {
        // Get RSS link from user and apply to all empty rssLink fields
        manualRssLink = await input({
          message: "Enter the RSS link to use:",
        });
        manualRssLink = manualRssLink.trim();

        // Filter for entries with empty rssLink only
        entriesToProcess = domainEntries.filter(
          (entry) => entry.rssLink === ""
        );
        console.log(
          `\n=== Processing Domain: ${domain.trim()} (Manual RSS Link) ===\n`
        );

        if (entriesToProcess.length === 0) {
          console.log(
            "✓ No entries found with empty rssLink field for this domain.\n"
          );
          continue; // Go back to the start
        }

        console.log(
          `Found ${entriesToProcess.length} entries with empty rssLink field.\n`
        );
        console.log(`RSS link to be applied: ${manualRssLink}\n`);
      } else {
        console.log("\nInvalid choice. Exiting.");
        return;
      }
    } else if (choice === "3") {
      // Exit option
      console.log("\nExiting...\n");
      return;
    } else {
      console.log("\nInvalid choice. Exiting.");
      return;
    }

    if (entriesToProcess.length === 0) {
      console.log("✓ No entries found with empty fields.\n");
      continue; // Go back to the start
    }

    // Display what will be processed for entire file
    if (choice === "1") {
      if (manualRssLink) {
        console.log(
          `Found ${entriesToProcess.length} entries with empty rssLink field.\n`
        );
        console.log(`RSS link to be applied: ${manualRssLink}\n`);
      } else {
        displayEmptyFieldsSummary(fullDataset, entriesToProcess);
      }
    }

    // Confirm processing
    const shouldProceed = await confirmPrompt({
      message: `Proceed with filling in ${entriesToProcess.length} entries?`,
      default: false,
    });

    if (!shouldProceed) {
      console.log("\nCancelled. No changes made.\n");
      continue; // Go back to the start
    }

    // Create backup before processing
    console.log("\nCreating backup...");
    await makeBackupFile(config.dbFilePath);
    console.log("✓ Backup created successfully\n");

    // Process entries
    await processEntries(bundledb, entriesToProcess, manualRssLink);

    // Save updated bundledb
    console.log("\nSaving updated bundledb...");
    fs.writeFileSync(config.dbFilePath, JSON.stringify(bundledb, null, 2));
    console.log("✓ Successfully saved updated bundledb\n");

    // After successful processing, exit the loop
    return;
  }
}

// Filter entries by domain
function filterByDomain(bundledb, domain) {
  return bundledb.filter(
    (entry) =>
      (entry.Link && entry.Link.includes(domain)) ||
      (entry.AuthorSite && entry.AuthorSite.includes(domain))
  );
}

// Get entries with empty fields
function getEntriesWithEmptyFields(entries) {
  return entries.filter((entry) => {
    const hasEmptyDescription = entry.description === "";
    const hasEmptyRssLink = entry.rssLink === "";
    const hasEmptyAuthorSiteDesc = entry.AuthorSiteDescription === "";

    return hasEmptyDescription || hasEmptyRssLink || hasEmptyAuthorSiteDesc;
  });
}

// Display summary of entries with empty fields
function displayEmptyFieldsSummary(fullDataset, entriesToProcess) {
  let emptyDescCount = 0;
  let emptyRssCount = 0;
  let emptyAuthorDescCount = 0;

  // Count from the full dataset for accurate totals - only count empty strings, not undefined
  fullDataset.forEach((entry) => {
    if (entry.description === "") emptyDescCount++;
    if (entry.rssLink === "") emptyRssCount++;
    if (entry.AuthorSiteDescription === "") emptyAuthorDescCount++;
  });

  console.log(
    `Empty field counts from dataset of ${fullDataset.length} entries:\n`
  );
  console.log(`  Entries with empty description: ${emptyDescCount}`);
  console.log(`  Entries with empty rssLink: ${emptyRssCount}`);
  console.log(
    `  Entries with empty AuthorSiteDescription: ${emptyAuthorDescCount}`
  );
  console.log(
    `\n  Total entries to process: ${entriesToProcess.length} (entries with at least one empty field)`
  );
}

// Process entries and fill in empty fields
async function processEntries(
  bundledb,
  entriesToProcess,
  manualRssLink = null
) {
  console.log("\nProcessing entries...\n");
  console.log("─".repeat(80));

  let successCount = 0;
  let failureCount = 0;

  // If manual RSS link is provided, just update all entries with it
  if (manualRssLink) {
    for (let i = 0; i < entriesToProcess.length; i++) {
      const entry = entriesToProcess[i];
      const index = bundledb.findIndex((e) => e.Link === entry.Link);

      if (index === -1) continue;

      console.log(
        `\n[${i + 1}/${entriesToProcess.length}] Processing: ${entry.Title}`
      );
      console.log(`Link: ${entry.Link}`);

      bundledb[index].rssLink = manualRssLink;
      console.log(`  ✓ RSS link added: ${manualRssLink}`);
      successCount++;
      console.log("─".repeat(80));
    }

    console.log(`\nProcessing complete!`);
    console.log(`  Successfully updated: ${successCount}`);
    return;
  }

  // Normal processing for all empty fields
  for (let i = 0; i < entriesToProcess.length; i++) {
    const entry = entriesToProcess[i];
    const index = bundledb.findIndex((e) => e.Link === entry.Link);

    if (index === -1) continue;

    console.log(
      `\n[${i + 1}/${entriesToProcess.length}] Processing: ${entry.Title}`
    );
    console.log(`Link: ${entry.Link}`);

    let updated = false;

    try {
      // Fill in description if empty
      if (!entry.description || entry.description === "") {
        console.log("  → Fetching description...");
        const description = await getDescription(entry.Link);
        if (description && description !== "") {
          bundledb[index].description = description;
          console.log(
            `  ✓ Description added: ${description.substring(0, 60)}...`
          );
          updated = true;
        } else {
          console.log("  ✗ Could not fetch description");
        }
        await delay(500); // Small delay between requests
      }

      // Fill in rssLink if empty
      if (!entry.rssLink || entry.rssLink === "") {
        // For blog posts, use AuthorSite; for sites, use Link
        const urlForRss =
          entry.Type === "blog post" ? entry.AuthorSite : entry.Link;
        if (urlForRss) {
          console.log("  → Fetching RSS link...");
          const rssLink = await getRSSLink(urlForRss);
          if (rssLink && rssLink !== "") {
            bundledb[index].rssLink = rssLink;
            console.log(`  ✓ RSS link added: ${rssLink}`);
            updated = true;
          } else {
            console.log("  ✗ Could not fetch RSS link");
          }
          await delay(500);
        }
      }

      // Fill in AuthorSiteDescription if empty
      if (!entry.AuthorSiteDescription || entry.AuthorSiteDescription === "") {
        // For blog posts, use AuthorSite; for sites, use Link
        const urlForAuthorDesc =
          entry.Type === "blog post" ? entry.AuthorSite : entry.Link;
        if (urlForAuthorDesc) {
          console.log("  → Fetching author site description...");
          const authorDesc = await getDescription(urlForAuthorDesc);
          if (authorDesc && authorDesc !== "") {
            bundledb[index].AuthorSiteDescription = authorDesc;
            console.log(
              `  ✓ Author site description added: ${authorDesc.substring(
                0,
                60
              )}...`
            );
            updated = true;
          } else {
            console.log("  ✗ Could not fetch author site description");
          }
          await delay(500);
        }
      }

      if (updated) {
        successCount++;
      } else {
        failureCount++;
      }
    } catch (error) {
      console.error(`  ✗ Error processing entry: ${error.message}`);
      failureCount++;
    }

    console.log("─".repeat(80));
  }

  console.log(`\nProcessing complete!`);
  console.log(`  Successfully updated: ${successCount}`);
  console.log(`  Failed or no changes: ${failureCount}`);
}

// Run the script
main();
