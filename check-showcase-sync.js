#!/usr/bin/env node

// Check for site entries in bundledb.json that are missing from showcase-data.json
// This is a read-only report script — no data is modified.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";
import { rawlist } from "@inquirer/prompts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Hardcoded paths for dev and production datasets
const devBundleDbPath = path.join(__dirname, "devdata", "bundledb.json");
const devShowcaseDataPath = path.join(__dirname, "devdata", "showcase-data.json");
const prodBundleDbPath = path.join(__dirname, "../11tybundledb", "bundledb.json");
const prodShowcaseDataPath = path.join(
  __dirname,
  "../11tybundledb",
  "showcase-data.json",
);

// Help flag
if (process.argv.includes("-h") || process.argv.includes("--help")) {
  console.log(`
Usage: node check-showcase-sync.js

Finds site entries in bundledb.json that are not present in showcase-data.json.
Entries with Skip/skip set to true are excluded from the comparison.

This is a read-only report — no files are modified.
`);
  process.exit(0);
}

const checkShowcaseSync = async () => {
  console.log(chalk.yellow("\n🔍 Check Showcase Sync\n"));

  const datasetChoice = await rawlist({
    message: "Select which dataset to check:",
    choices: [
      { name: "Production (../11tybundledb)", value: "production" },
      { name: "Development (./devdata)", value: "development" },
      { name: chalk.dim("Exit"), value: "exit" },
    ],
  });

  if (datasetChoice === "exit") {
    console.log(chalk.yellow("\n👋 Exiting...\n"));
    process.exit(0);
  }

  const bundleDbPath =
    datasetChoice === "production" ? prodBundleDbPath : devBundleDbPath;
  const showcaseDataPath =
    datasetChoice === "production" ? prodShowcaseDataPath : devShowcaseDataPath;

  console.log(
    chalk.dim(`\nUsing ${datasetChoice} dataset`),
  );
  console.log(chalk.dim(`  bundledb:      ${bundleDbPath}`));
  console.log(chalk.dim(`  showcase-data: ${showcaseDataPath}\n`));

  // Read data files
  let bundleDb, showcaseData;
  try {
    bundleDb = JSON.parse(fs.readFileSync(bundleDbPath, "utf8"));
  } catch (err) {
    console.error(chalk.red(`Error reading ${bundleDbPath}: ${err.message}`));
    process.exit(1);
  }
  try {
    showcaseData = JSON.parse(fs.readFileSync(showcaseDataPath, "utf8"));
  } catch (err) {
    console.error(
      chalk.red(`Error reading ${showcaseDataPath}: ${err.message}`),
    );
    process.exit(1);
  }

  // Filter bundledb to non-Skip site entries
  const siteEntries = bundleDb.filter(
    (entry) => entry.Type === "site" && !entry.Skip,
  );

  // Filter showcase to non-skip entries, build a Set of links
  const showcaseLinks = new Set(
    showcaseData.filter((entry) => !entry.skip).map((entry) => entry.link),
  );

  // Find site entries missing from showcase
  const missing = siteEntries.filter(
    (entry) => !showcaseLinks.has(entry.Link),
  );

  // Report
  console.log(chalk.white(`Total site entries (non-Skip): ${siteEntries.length}`));
  console.log(chalk.white(`Total showcase entries (non-skip): ${showcaseLinks.size}`));
  console.log("");

  if (missing.length === 0) {
    console.log(
      chalk.green("✓ All site entries are present in showcase-data.json\n"),
    );
  } else {
    console.log(
      chalk.red(
        `✗ ${missing.length} site ${missing.length === 1 ? "entry" : "entries"} missing from showcase-data.json:\n`,
      ),
    );
    for (const entry of missing) {
      console.log(chalk.white(`  Title: ${entry.Title}`));
      console.log(chalk.dim(`  Link:  ${entry.Link}`));
      console.log(chalk.dim(`  Issue: ${entry.Issue}  Date: ${entry.formattedDate}`));
      console.log("");
    }
    console.log(
      chalk.yellow(
        `Summary: ${missing.length} missing out of ${siteEntries.length} site entries\n`,
      ),
    );
  }
};

checkShowcaseSync();
