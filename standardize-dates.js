import { rawlist, confirm } from "@inquirer/prompts";
import fs from "fs";
import chalk from "chalk";
import { makeBackupFile } from "./utils.js";

// File paths
let dbFilePath = "";
let dbBackupDir = "";

// Indentation constant
const INDENT = "    ";

// Styled output helpers
const separator = () => console.log(chalk.dim("---"));
const blankLine = () => console.log();
const sectionHeader = (text) => {
  blankLine();
  console.log(chalk.yellow(text));
};
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
const statusMessage = (text) => console.log(chalk.cyan(`${INDENT}${text}`));

// Function to prompt for dataset selection
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

  // Set file paths based on selection
  if (datasetChoice === "production") {
    dbFilePath =
      "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb/bundledb.json";
    dbBackupDir =
      "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb/bundledb-backups";
    successMessage("✓ Using Production dataset (11tybundledb)");
  } else {
    dbFilePath =
      "/Users/Bob/Dropbox/Docs/Sites/11tybundle/dbtools/devdata/bundledb.json";
    dbBackupDir =
      "/Users/Bob/Dropbox/Docs/Sites/11tybundle/dbtools/devdata/bundledb-backups";
    successMessage("✓ Using Development dataset (devdata)");
  }

  return datasetChoice;
};

// Function to analyze date formats in the database
const analyzeDateFormats = (jsonData) => {
  const dateFormats = {
    withTime: [], // e.g., "2026-01-28T21:31:16.000"
    dateOnly: [], // e.g., "2026-01-29"
    withTimezone: [], // e.g., "2026-01-29T00:00:00.000Z"
    other: [], // any other format
  };

  jsonData.forEach((entry, index) => {
    if (!entry.Date) return;

    const dateStr = entry.Date;

    // Check format
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(dateStr)) {
      dateFormats.withTimezone.push({ index, entry, dateStr });
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}$/.test(dateStr)) {
      dateFormats.withTime.push({ index, entry, dateStr });
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      dateFormats.dateOnly.push({ index, entry, dateStr });
    } else {
      dateFormats.other.push({ index, entry, dateStr });
    }
  });

  return dateFormats;
};

// Function to standardize a date string to ISO format with time
const standardizeDate = (dateStr) => {
  // If it's already in the correct format with time, return as-is
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}$/.test(dateStr)) {
    return dateStr;
  }

  // If it's already in UTC format, convert to local time format
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(dateStr)) {
    const date = new Date(dateStr);
    // Convert to local time and format as YYYY-MM-DDTHH:mm:ss.SSS
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    const milliseconds = String(date.getMilliseconds()).padStart(3, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}`;
  }

  // If it's date-only format, add midnight time
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return `${dateStr}T00:00:00.000`;
  }

  // For any other format, try to parse and format
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new Error("Invalid date");
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    const milliseconds = String(date.getMilliseconds()).padStart(3, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}`;
  } catch (error) {
    console.error(chalk.red(`${INDENT}Failed to parse date: ${dateStr}`));
    return dateStr; // Return original if parsing fails
  }
};

// Main function
const main = async () => {
  blankLine();
  separator();
  sectionHeader("Standardize Date Formats in bundledb.json");
  separator();
  blankLine();

  // Prompt for dataset selection
  await selectDataset();

  // Load the database
  statusMessage("Loading database...");
  let jsonData;
  try {
    const fileData = fs.readFileSync(dbFilePath, "utf8");
    jsonData = JSON.parse(fileData);
    successMessage(`Loaded ${jsonData.length} entries`);
  } catch (error) {
    errorMessage(`Failed to load database: ${error.message}`);
    process.exit(1);
  }

  // Analyze date formats
  statusMessage("Analyzing date formats...");
  const dateFormats = analyzeDateFormats(jsonData);

  // Display analysis
  blankLine();
  separator();
  sectionHeader("Date Format Analysis");
  blankLine();
  dataField(
    "Dates with time (YYYY-MM-DDTHH:mm:ss.SSS)",
    dateFormats.withTime.length,
  );
  dataField("Date-only format (YYYY-MM-DD)", dateFormats.dateOnly.length);
  dataField(
    "Dates with timezone (YYYY-MM-DDTHH:mm:ss.SSSZ)",
    dateFormats.withTimezone.length,
  );
  dataField("Other formats", dateFormats.other.length);
  separator();

  // Show examples if there are inconsistencies
  if (dateFormats.dateOnly.length > 0) {
    blankLine();
    sectionHeader("Examples of date-only formats to be converted:");
    dateFormats.dateOnly.slice(0, 5).forEach(({ entry, dateStr }) => {
      console.log(
        chalk.dim(
          `${INDENT}${entry.Type}: "${entry.Title}" - ${dateStr} → ${standardizeDate(dateStr)}`,
        ),
      );
    });
    if (dateFormats.dateOnly.length > 5) {
      console.log(
        chalk.dim(`${INDENT}... and ${dateFormats.dateOnly.length - 5} more`),
      );
    }
  }

  if (dateFormats.withTimezone.length > 0) {
    blankLine();
    sectionHeader("Examples of UTC format dates to be converted:");
    dateFormats.withTimezone.slice(0, 5).forEach(({ entry, dateStr }) => {
      console.log(
        chalk.dim(
          `${INDENT}${entry.Type}: "${entry.Title}" - ${dateStr} → ${standardizeDate(dateStr)}`,
        ),
      );
    });
    if (dateFormats.withTimezone.length > 5) {
      console.log(
        chalk.dim(
          `${INDENT}... and ${dateFormats.withTimezone.length - 5} more`,
        ),
      );
    }
  }

  if (dateFormats.other.length > 0) {
    blankLine();
    sectionHeader("Examples of other date formats:");
    dateFormats.other.slice(0, 5).forEach(({ entry, dateStr }) => {
      console.log(
        chalk.dim(`${INDENT}${entry.Type}: "${entry.Title}" - ${dateStr}`),
      );
    });
    if (dateFormats.other.length > 5) {
      console.log(
        chalk.dim(`${INDENT}... and ${dateFormats.other.length - 5} more`),
      );
    }
  }

  blankLine();

  // Check if standardization is needed
  const needsStandardization =
    dateFormats.dateOnly.length > 0 ||
    dateFormats.withTimezone.length > 0 ||
    dateFormats.other.length > 0;

  if (!needsStandardization) {
    successMessage("All dates are already in the standard format!");
    return;
  }

  // Confirm standardization
  const proceed = await confirm({
    message: "Proceed with date standardization?",
    default: true,
  });

  if (!proceed) {
    console.log(chalk.yellow("\n👋 Exiting without changes...\n"));
    return;
  }

  // Create backup
  statusMessage("Creating backup...");
  makeBackupFile(dbFilePath, dbBackupDir);
  successMessage("Backup created");

  // Standardize dates
  statusMessage("Standardizing dates...");
  let changedCount = 0;

  jsonData.forEach((entry) => {
    if (entry.Date) {
      const originalDate = entry.Date;
      const standardizedDate = standardizeDate(originalDate);
      if (originalDate !== standardizedDate) {
        entry.Date = standardizedDate;
        changedCount++;
      }
    }
  });

  // Save the updated database
  statusMessage("Saving updated database...");
  try {
    fs.writeFileSync(dbFilePath, JSON.stringify(jsonData, null, 2), "utf8");
    successMessage(`Successfully standardized ${changedCount} dates`);
  } catch (error) {
    errorMessage(`Failed to save database: ${error.message}`);
    process.exit(1);
  }

  blankLine();
  separator();
  sectionHeader("Summary");
  blankLine();
  dataField("Total entries processed", jsonData.length);
  dataField("Dates standardized", changedCount);
  dataField("Target format", "YYYY-MM-DDTHH:mm:ss.SSS (local time)");
  separator();
  blankLine();

  console.log(chalk.cyan("All done...bye!"));
  blankLine();
};

// Run the main function
main().catch((error) => {
  errorMessage(`An error occurred: ${error.message}`);
  process.exit(1);
});
