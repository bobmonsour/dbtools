import { input, rawlist, checkbox } from "@inquirer/prompts";
import axios from "axios";
import fs from "fs";
import chalk from "chalk";
import {
  makeBackupFile,
  getLatestIssueNumber,
  checkForDuplicateUrl,
  countEntriesByIssue,
  getUniqueCategories,
  formatItemDate,
} from "./utils.js";
import { config } from "./config.js";
import { genIssueRecords } from "./genissuerecords.js";
import { exec } from "child_process";
import util from "util";
import slugify from "@sindresorhus/slugify";

// Get the location of the bundle database file
const dbFilePath = config.dbFilePath;
// Set db file backup state
let backedUp = false;
// Set next action after initial entry
let nextAction = "ask what next";
// Create the entry data object
let entryData = {};
let { uniqueCategoryChoices, uniqueCategories } = getUniqueCategories();

// Generate a date string that includes date and time in local timezone
const getCurrentDateTimeString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000`;
};

// Function to generate a default date for the entry
// The date should default to today's date in the format of YYYY-MM-DD
const getDefaultDate = () => {
  return getCurrentDateTimeString();
  // const currentDate = new Date();
  // const year = currentDate.getFullYear();
  // const month = String(currentDate.getMonth() + 1).padStart(2, "0");
  // const day = String(currentDate.getDate()).padStart(2, "0");
  // return `${year}-${month}-${day}`;
};

// Function to validate date format
const validateDate = (input) => {
  // Accept YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.000
  const datePattern = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
  const dateTimePattern =
    /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T\d{2}:\d{2}:\d{2}\.\d{3}$/;

  if (!datePattern.test(input) && !dateTimePattern.test(input)) {
    return "Please enter a valid date in YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.000 format.";
  }

  // Parse the date part only for validation
  const datePart = input.split("T")[0];
  const [year, month, day] = datePart.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0); // Set time to 00:00:00 for accurate comparison

  if (
    date.getMonth() + 1 !== month ||
    date.getDate() !== day ||
    date.getFullYear() !== year
  ) {
    return "Invalid date. Enter date in YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.000 format.";
  }

  return true;
};

// Function to validate URL format
const validateUrlFormat = (url) => {
  try {
    new URL(url);
    return true;
  } catch (err) {
    return "Please enter a valid URL.";
  }
};

// Function to check if URL is accessible
const validateUrlAccessibility = async (url) => {
  try {
    await axios.head(url);
    return true;
  } catch (err) {
    return "URL is not accessible.";
  }
};

// Function to validate the Link
const validateLink = async (input) => {
  const formatValidation = validateUrlFormat(input);
  if (formatValidation !== true) {
    return formatValidation;
  }
  if (checkForDuplicateUrl(input)) {
    return "This Link already exists in the data!";
  }
  const accessibilityValidation = await validateUrlAccessibility(input);
  return accessibilityValidation;
};

// Function to validate the Author site (optional field)
const validateAuthorSite = async (input) => {
  // Allow blank input (optional field)
  if (!input || input.trim() === "") {
    return true;
  }
  // If provided, validate format and accessibility
  const formatValidation = validateUrlFormat(input);
  if (formatValidation !== true) {
    return formatValidation;
  }
  const accessibilityValidation = await validateUrlAccessibility(input);
  return accessibilityValidation;
};

// Function to prompt for common information
const promptCommonInfo = async (enterOrEdit, entryData) => {
  const latestIssueNumber = getLatestIssueNumber();
  const commonInfo = {};
  commonInfo.Issue = await input({
    message: `Issue (latest is ${latestIssueNumber}):`,
    default: enterOrEdit === "edit" ? entryData.Issue : latestIssueNumber,
    validate: function (input) {
      if (input.trim() === "" || !isNaN(input)) {
        return true;
      }
      return "Please enter a valid number or leave the input blank.";
    },
  });
  commonInfo.Title = await input({
    message: "Title:",
    default: enterOrEdit === "edit" ? entryData.Title : null,
    validate: (input) => (input ? true : "Title is required."),
  });
  commonInfo.Link = await input({
    message: "Link:",
    default: enterOrEdit === "edit" ? entryData.Link : null,
    validate: validateLink,
  });
  return commonInfo;
};

// Function to ENTER post info
const enterPost = async () => {
  const commonInfo = await promptCommonInfo("enter");
  const Date = await input({
    message: "Date (YYYY-MM-DD):",
    default: getDefaultDate(),
    validate: validateDate,
  });
  const Author = await input({
    message: "Author:",
    validate: (input) => (input ? true : "Author is required."),
  });
  const AuthorSite = await input({
    message: "Author site (optional):",
    validate: validateAuthorSite,
  });
  const Categories = await checkbox({
    message: "Categories (1 or more):",
    pageSize: 10,
    choices: uniqueCategoryChoices,
    validate: (input) =>
      input.length > 0 ? true : "At least one category must be selected.",
  });
  entryData = {
    Issue: commonInfo.Issue,
    Type: "blog post",
    Title: commonInfo.Title,
    Link: commonInfo.Link,
    Date: Date,
    Author: Author,
    Categories: Categories,
    slugifiedTitle: slugify(commonInfo.Title),
    slugifiedAuthor: slugify(Author),
    formattedDate: formatItemDate(Date),
  };
  // Only add AuthorSite if provided
  if (AuthorSite && AuthorSite.trim() !== "") {
    entryData.AuthorSite = AuthorSite;
  }
  return;
};

// Function to ENTER site info
const enterSite = async () => {
  const commonInfo = await promptCommonInfo("enter");
  const Date = await input({
    message: "Date (YYYY-MM-DD):",
    default: getDefaultDate(),
    validate: validateDate,
  });
  entryData = {
    Issue: commonInfo.Issue,
    Type: "site",
    Title: commonInfo.Title,
    Link: commonInfo.Link,
    Date: Date,
  };
  return;
};

// Function to ENTER release info
const enterRelease = async () => {
  const commonInfo = await promptCommonInfo("enter");
  const additionalInfo = await input({
    message: "Date (YYYY-MM-DD):",
    default: getDefaultDate(),
    validate: validateDate,
  });
  entryData = {
    Issue: commonInfo.Issue,
    Type: "release",
    Title: commonInfo.Title,
    Link: commonInfo.Link,
    Date: additionalInfo,
  };
  return;
};

// Function to ENTER starter info
const enterStarter = async () => {
  const commonInfo = await promptCommonInfo("enter");
  entryData = {
    Issue: commonInfo.Issue,
    Type: "starter",
    Title: commonInfo.Title,
    Link: commonInfo.Link,
  };
  return;
};

// Function to EDIT post info
const editPost = async () => {
  const commonInfo = await promptCommonInfo("edit", entryData);
  const Date = await input({
    message: "Date:",
    default: entryData.Date,
    validate: validateDate,
  });
  const Author = await input({
    message: "Author:",
    default: entryData.Author,
    validate: (input) => (input ? true : "Author is required."),
  });
  const AuthorSite = await input({
    message: "Author site (optional):",
    default: entryData.AuthorSite || "",
    validate: validateAuthorSite,
  });
  const Categories = await checkbox({
    message: "Categories (1 or more):",
    pageSize: 10,
    choices: uniqueCategories.map((category) => {
      return {
        value: category,
        checked: entryData.Categories.includes(category),
      };
    }),
    validate: (input) =>
      input.length > 0 ? true : "At least one category must be selected.",
  });
  entryData = {
    Issue: commonInfo.Issue,
    Type: "blog post",
    Title: commonInfo.Title,
    Link: commonInfo.Link,
    Date: Date,
    Author: Author,
    slugifiedTitle: slugify(commonInfo.Title),
    slugifiedAuthor: slugify(Author),
    formattedDate: formatItemDate(Date),
  };
  // Only add AuthorSite if provided
  if (AuthorSite && AuthorSite.trim() !== "") {
    entryData.AuthorSite = AuthorSite;
  }
  entryData.Categories = Categories;
  return;
};

// Function to EDIT site info
const editSite = async () => {
  const commonInfo = await promptCommonInfo("edit", entryData);
  const Date = await input({
    message: "Date:",
    default: getDefaultDate(),
    validate: validateDate,
  });
  entryData = {
    Issue: commonInfo.Issue,
    Type: "site",
    Title: commonInfo.Title,
    Link: commonInfo.Link,
    Date: Date,
  };
  return;
};

// Function to EDIT release info
const editRelease = async () => {
  const commonInfo = await promptCommonInfo("edit", entryData);
  const Date = await input({
    message: "Date:",
    default: getDefaultDate(),
    validate: validateDate,
  });
  entryData = {
    Issue: commonInfo.Issue,
    Type: "release",
    Title: commonInfo.Title,
    Link: commonInfo.Link,
    Date: Date,
  };
  return;
};

// Function to EDIT starter info
const editStarter = async () => {
  const commonInfo = await promptCommonInfo("edit", entryData);
  entryData = {
    Issue: commonInfo.Issue,
    Type: "starter",
    Title: commonInfo.Title,
    Link: commonInfo.Link,
  };
  return;
};

// Function to process user selected steps after entry
const afterEntry = async () => {
  const whatNext = await rawlist({
    message: "What's next?",
    choices: [
      { value: "save & exit" },
      { value: "save & add another" },
      { value: "edit entry" },
      { value: "save, push, & exit" },
    ],
  });
  switch (whatNext) {
    case "save & exit":
      await appendToJsonFile(entryData);
      await genIssueRecords();
      return (nextAction = "exit");
    case "save & add another":
      await appendToJsonFile(entryData);
      nextAction = "add another";
      return;
    case "edit entry":
      nextAction = "ask what next";
      switch (entryData.Type) {
        case "blog post":
          await editPost();
          return;
        case "site":
          await editSite();
          return;
        case "release":
          await editRelease();
          return;
        case "starter":
          await editStarter();
          return;
        default:
          console.log("Invalid EDIT type");
          return;
      }
    case "save, push, & exit": // New case added here
      await appendToJsonFile(entryData);
      await genIssueRecords();
      await pushChanges();
      return (nextAction = "exit");
    default:
      console.log("Invalid choice");
      return;
  }
};

// Function to validate if the entry data is a valid JSON object
const validateJsonObject = (data) => {
  try {
    const jsonString = JSON.stringify(data);
    JSON.parse(jsonString);
    return true;
  } catch (error) {
    console.log("Error parsing JSON:", error.message);
    return false;
  }
};

// Function to append the validated entry data to the JSON file
const appendToJsonFile = async (data) => {
  try {
    console.log("Appending to JSON file...", data);
    const fileData = fs.readFileSync(dbFilePath, "utf8");
    const jsonData = JSON.parse(fileData);
    jsonData.push(data);
    fs.writeFileSync(dbFilePath, JSON.stringify(jsonData, null, 2), "utf8");
    console.log(chalk.green("Entry successfully saved!"));
  } catch (error) {
    console.error(chalk.red("Error writing to the file:", error));
  }
};

// Function to push changes to the Git repository
const pushChanges = async () => {
  const execPromise = util.promisify(exec);

  try {
    // Change to the specified directory
    process.chdir(config.dbFileDir);

    // Perform Git operations
    await execPromise(`git add ${config.dbFilename}`);
    await execPromise(`git commit -m "Added to bundledb.json"`);
    await execPromise(`git push origin main`);

    console.log(chalk.green("Changes pushed to the repository successfully!"));
  } catch (error) {
    console.error(chalk.red("Error pushing changes to the repository:", error));
  }
};

// Main function to prompt for entry type and
// call the respective entry function
const main = async () => {
  // make a backup of the file before creating new entries
  // make a single backup per entry/editing session
  if (!backedUp) {
    makeBackupFile(dbFilePath);
    const inputFilePath = dbFilePath;
    makeBackupFile(inputFilePath);
    backedUp = true;
  }

  const entryType = await rawlist({
    message: "Type of entry:",
    choices: [
      { value: "post" },
      { value: "site" },
      { value: "release" },
      { value: "starter" },
      { value: "Generate issue records" },
    ],
  });

  switch (entryType) {
    case "post":
      await enterPost();
      break;
    case "site":
      await enterSite();
      break;
    case "release":
      await enterRelease();
      break;
    case "starter":
      await enterStarter();
      break;
    case "Generate issue records":
      await genIssueRecords();
      console.log(chalk.green("Issue records generated successfully!"));
      return;
    default:
      console.log("Invalid ENTRY type");
      return;
  }

  // Validate if the entry data is a valid JSON object
  if (validateJsonObject(entryData)) {
    console.log("Entry Data is a valid JSON object:", entryData);
  } else {
    console.error(chalk.red("Entry Data is not a valid JSON object"));
  }

  while (nextAction !== "exit") {
    await afterEntry();
    switch (nextAction) {
      case "exit":
        break;
      case "add another":
        return main();
      case "ask what next":
        continue;
    }
  }
  const latestIssueNumber = getLatestIssueNumber();
  const itemCounts = countEntriesByIssue(latestIssueNumber);
  // Output the results
  console.log(chalk.blue(`Issue Number: ${itemCounts.issueNumber}`));
  console.log(chalk.green(`Blog Posts: ${itemCounts.blogPostCount}`));
  console.log(chalk.green(`Sites: ${itemCounts.siteCount}`));
  console.log(chalk.green(`Releases: ${itemCounts.releaseCount}`));
  console.log(chalk.green(`Starters: ${itemCounts.starterCount}`));
  console.log("All done...bye!");
};

// Run the main function
main().catch((error) => {
  console.error(chalk.red("An error occurred:", error));
});
