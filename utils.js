import chalk from "chalk";
import fs from "fs";
import path from "node:path";
import { config } from "./config.js";

// Utility functions for scripts to manage the 11ty Bundle database
//
// checkForDuplicateUrl - Check for duplicate URL in the bundle database file
// makeBackupFile - Create a backup of the bundle database file
// getLatestIssueNumber - Get the latest Issue number from the bundle database
// editJsonObject - Edit a JSON object interactively

// Function to check for duplicate URL in the JSON file
export const checkForDuplicateUrl = (url) => {
  const dbFilePath = config.dbFilePath; // get the location of bundle db
  try {
    const data = fs.readFileSync(dbFilePath, "utf8");
    const jsonData = JSON.parse(data);
    return jsonData.some((entry) => entry.Link === url);
  } catch (err) {
    console.error(chalk.red("Error reading the JSON file:", err));
    return false;
  }
};

// Function to get the current date and time in the specified format
function getFormattedDateTime() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}--${hours}${minutes}${seconds}`;
}

// Function to create a directory if it doesn't exist
function createDirIfNotExists(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    // console.log(`Directory '${dir}' created or already exists.`);
  } catch (err) {
    console.error(`Error creating directory '${dir}':`, err);
  }
}

// Function to create a backup of the file
export async function makeBackupFile(inputFilePath) {
  // Get the backup directory location
  const backupDir = config.dbBackupDir;
  try {
    // Ensure the backup directory exists
    await createDirIfNotExists(backupDir);

    // Get the base name of the input file
    const baseName = path.basename(inputFilePath, path.extname(inputFilePath));

    // Generate the backup file name
    const dateTime = getFormattedDateTime();
    const backupFileName = `${baseName}-${dateTime}.json`;
    const backupFilePath = path.join(backupDir, backupFileName);

    // Read the content of the input file
    const data = fs.readFileSync(inputFilePath, "utf8");

    // Write the content to the backup file
    fs.writeFileSync(backupFilePath, data);

    // console.log(`Backup created: ${backupFilePath}`);
  } catch (err) {
    console.error("Error creating backup:", err);
  }
}

// Function to generate the latest Issue number of all the posts
// Using this as the default value for the Issue number prompt
export const getLatestIssueNumber = () => {
  const dbFilePath = config.dbFilePath; // get the location of bundle db
  try {
    const data = fs.readFileSync(dbFilePath, "utf8");
    const jsonData = JSON.parse(data);
    const issueNumbers = jsonData.map((entry) => entry.Issue);
    return Math.max(...issueNumbers).toString();
  } catch (err) {
    console.error(chalk.red("Error reading the JSON file:", err));
    return 0;
  }
};

// Function to read the JSON file and count the number of each type of entry for a given Issue number
export const countEntriesByIssue = (issueNumber) => {
  // Get the location of the bundle database file
  const dbFilePath = config.dbFilePath;

  try {
    // Read the JSON file
    const data = fs.readFileSync(dbFilePath, "utf8");
    const jsonData = JSON.parse(data);

    // Initialize counters for each type of entry
    let blogPostCount = 0;
    let siteCount = 0;
    let releaseCount = 0;
    let starterCount = 0;

    // Filter and count the entries based on the given Issue number
    jsonData.forEach((item) => {
      if (item.Issue == issueNumber) {
        // Use loose equality to handle different types
        switch (item.Type) {
          case "blog post":
            blogPostCount++;
            break;
          case "site":
            siteCount++;
            break;
          case "release":
            releaseCount++;
            break;
          case "starter":
            starterCount++;
            break;
          default:
            break;
        }
      }
    });
    return {
      issueNumber,
      blogPostCount,
      siteCount,
      releaseCount,
      starterCount,
    };
  } catch (error) {
    console.error(
      chalk.red("Error reading or processing the JSON file:", error)
    );
  }
};

// Function to read the JSON file and generate an array of the
// unique categories used in the checkbox portion of the post entries.
// The array takes the form of:
//
// [ { value: "Category Name 1" }, { value: "Category Name 2" }... ]
//
export const getUniqueCategories = () => {
  // Get the location of the bundle database file
  const dbFilePath = config.dbFilePath;

  try {
    // Read the JSON file
    const data = fs.readFileSync(dbFilePath, "utf8");
    const jsonData = JSON.parse(data);
    const categories = new Set();
    for (const item of jsonData) {
      if (item.hasOwnProperty("Categories")) {
        for (const category of item.Categories) {
          categories.add(category);
        }
      }
    }
    const uniqueCategoryChoices = Array.from(categories)
      .sort()
      .map((category) => {
        return { value: category };
      });
    console.log(uniqueCategoryChoices);
    const uniqueCategories = Array.from(categories).sort();
    console.log(uniqueCategories);
    return { uniqueCategoryChoices, uniqueCategories };
  } catch (error) {
    console.error(
      chalk.red("Error reading or processing the JSON file:", error)
    );
  }
};
