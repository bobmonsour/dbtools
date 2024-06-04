import inquirer from "inquirer";
import axios from "axios";
import fs from "fs";
import chalk from "chalk";
import {
  makeBackupFile,
  getLatestIssueNumber,
  checkForDuplicateUrl,
} from "./utils.js";
import { config } from "./config.js";

// Get the location of the bundle database file
const dbFilePath = config.dbFilePath;
// Set db file backup state
let backedUp = false;
// Set next action after initial entry
let nextAction = "ask what next";
// Create the entry data object
let entryData = {};

// Function to generate a default date for the entry
// The date should default to today's date in the format of YYYY-MM-DD
const getDefaultDate = () => {
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, "0");
  const day = String(currentDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Function to validate date format and ensure it is no later than today
const validateDate = (input) => {
  const datePattern = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
  if (!datePattern.test(input)) {
    return "Please enter a valid date in YYYY-MM-DD format.";
  }

  const [year, month, day] = input.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0); // Set time to 00:00:00 for accurate comparison

  if (
    date.getMonth() + 1 !== month ||
    date.getDate() !== day ||
    date.getFullYear() !== year
  ) {
    return "Invalid date. Enter date in YYYY-MM-DD format.";
  }

  if (date > currentDate) {
    return "Date cannot be later than today.";
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

// Function to prompt for common information
const promptCommonInfo = async (enterOrEdit, entryData) => {
  const latestIssueNumber = getLatestIssueNumber();
  return await inquirer.prompt([
    {
      type: "input",
      name: "Issue",
      message: `Issue (latest is ${latestIssueNumber}):`,
      default: enterOrEdit === "edit" ? entryData.Issue : latestIssueNumber,
      validate: function (input) {
        if (input.trim() === "" || !isNaN(input)) {
          return true;
        }
        return "Please enter a valid number or leave the input blank.";
      },
    },
    {
      type: "input",
      name: "Title",
      message: "Title:",
      default: enterOrEdit === "edit" ? entryData.Title : null,
      validate: (input) => (input ? true : "Title is required."),
    },
    {
      type: "input",
      name: "Link",
      message: "Link:",
      default: enterOrEdit === "edit" ? entryData.Link : null,
      validate: validateLink,
    },
  ]);
};

// Function to ENTER post info
const enterPost = async () => {
  const commonInfo = await promptCommonInfo("enter");
  const additionalInfo = await inquirer.prompt([
    {
      type: "input",
      name: "Date",
      message: "Date (YYYY-MM-DD):",
      default: getDefaultDate(),
      validate: validateDate,
    },
    {
      type: "input",
      name: "Author",
      message: "Author:",
      validate: (input) => (input ? true : "Author is required."),
    },
    {
      type: "checkbox",
      name: "Categories",
      message: "Categories (1 or more):",
      pageSize: 10,
      choices: config.categories,
      validate: (input) =>
        input.length > 0 ? true : "At least one category must be selected.",
    },
  ]);
  entryData = {
    Issue: commonInfo.Issue,
    Type: "blog post",
    Title: commonInfo.Title,
    Link: commonInfo.Link,
    Date: additionalInfo.Date,
    Author: additionalInfo.Author,
    Categories: additionalInfo.Categories,
  };
  return;
};

// Function to ENTER site info
const enterSite = async () => {
  const commonInfo = await promptCommonInfo("enter");
  entryData = {
    Issue: commonInfo.Issue,
    Type: "site",
    Title: commonInfo.Title,
    Link: commonInfo.Link,
  };
  return;
};

// Function to ENTER release info
const enterRelease = async () => {
  const commonInfo = await promptCommonInfo("enter");
  const additionalInfo = await inquirer.prompt([
    {
      type: "input",
      name: "Date",
      message: "Date (YYYY-MM-DD):",
      default: getDefaultDate(),
      validate: validateDate,
    },
  ]);
  entryData = {
    Issue: commonInfo.Issue,
    Type: "release",
    Title: commonInfo.Title,
    Link: commonInfo.Link,
    Date: additionalInfo.Date,
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
  const additionalInfo = await inquirer.prompt([
    {
      type: "input",
      name: "Date",
      message: "Date (YYYY-MM-DD):",
      default: entryData.Date,
      validate: validateDate,
    },
    {
      type: "input",
      name: "Author",
      message: "Author:",
      default: entryData.Author,
      validate: (input) => (input ? true : "Author is required."),
    },
    {
      type: "checkbox",
      name: "Categories",
      message: "Categories (1 or more):",
      pageSize: 10,
      choices: config.categories.map((category) => {
        return {
          name: category,
          checked: entryData.Categories.includes(category),
        };
      }),
      validate: (input) =>
        input.length > 0 ? true : "At least one category must be selected.",
    },
  ]);
  entryData = {
    Issue: commonInfo.Issue,
    Type: "blog post",
    Title: commonInfo.Title,
    Link: commonInfo.Link,
    Date: additionalInfo.Date,
    Author: additionalInfo.Author,
    Categories: additionalInfo.Categories,
  };
  return;
};

// Function to EDIT site info
const editSite = async () => {
  const commonInfo = await promptCommonInfo("edit", entryData);
  entryData = {
    Issue: commonInfo.Issue,
    Type: "site",
    Title: commonInfo.Title,
    Link: commonInfo.Link,
  };
  return;
};

// Function to EDIT release info
const editRelease = async () => {
  const commonInfo = await promptCommonInfo("edit", entryData);
  const additionalInfo = await inquirer.prompt([
    {
      type: "input",
      name: "Date",
      message: "Date (YYYY-MM-DD):",
      default: getDefaultDate(),
      validate: validateDate,
    },
  ]);
  entryData = {
    Issue: commonInfo.Issue,
    Type: "release",
    Title: commonInfo.Title,
    Link: commonInfo.Link,
    Date: additionalInfo.Date,
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
  const { whatNext } = await inquirer.prompt([
    {
      type: "list",
      name: "whatNext",
      message: "What's next?",
      choices: ["1) save & exit", "2) save & add another", "3) edit entry"],
    },
  ]);
  switch (whatNext) {
    case "1) save & exit":
      await appendToJsonFile(entryData);
      return (nextAction = "exit");
    case "2) save & add another":
      await appendToJsonFile(entryData);
      nextAction = "add another";
      return;
    case "3) edit entry":
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
    const fileData = fs.readFileSync(dbFilePath, "utf8");
    const jsonData = JSON.parse(fileData);
    jsonData.push(data);
    fs.writeFileSync(dbFilePath, JSON.stringify(jsonData, null, 2), "utf8");
    console.log(chalk.green("Entry successfully saved!"));
  } catch (error) {
    console.error(chalk.red("Error writing to the file:", error));
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

  const { entryType } = await inquirer.prompt([
    {
      type: "list",
      name: "entryType",
      message: "Type of entry:",
      choices: ["1) post", "2) site", "3) release", "4) starter"],
    },
  ]);

  switch (entryType) {
    case "1) post":
      await enterPost();
      break;
    case "2) site":
      await enterSite();
      break;
    case "3) release":
      await enterRelease();
      break;
    case "4) starter":
      await enterStarter();
      break;
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
  console.log("All done...bye!");
};

// Run the main function
main().catch((error) => {
  console.error(chalk.red("An error occurred:", error));
});
