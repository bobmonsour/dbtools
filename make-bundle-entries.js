import inquirer from "inquirer";
import axios from "axios";
import fs from "fs";
import readline from "readline";
import chalk from "chalk";
import {
  makeBackupFile,
  getLatestIssueNumber,
  checkForDuplicateUrl,
} from "./utils.js";
import { config } from "./config.js";

// Get the location of the bundle database file
const dbFilePath = config.dbFilePath;

// Declare readline variable for user input
let rl;

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
const promptCommonInfo = async () => {
  const latestIssueNumber = getLatestIssueNumber();
  return await inquirer.prompt([
    {
      type: "input",
      name: "Issue",
      message: `Issue (latest is ${latestIssueNumber}):`,
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
      validate: (input) => (input ? true : "Title is required."),
    },
    {
      type: "input",
      name: "Link",
      message: "Link:",
      validate: validateLink,
    },
  ]);
};

// Function to handle blog post entry
const handleBlogPost = async () => {
  const commonInfo = await promptCommonInfo();
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
  return {
    Issue: commonInfo.Issue,
    Type: "blog post",
    Title: commonInfo.Title,
    Link: commonInfo.Link,
    Date: additionalInfo.Date,
    Author: additionalInfo.Author,
    Categories: additionalInfo.Categories,
  };
};

// Function to handle site entry
const handleSite = async () => {
  const commonInfo = await promptCommonInfo();
  return {
    Issue: commonInfo.Issue,
    Type: "site",
    Title: commonInfo.Title,
    Link: commonInfo.Link,
  };
};

// Function to handle release entry
const handleRelease = async () => {
  const commonInfo = await promptCommonInfo();
  const additionalInfo = await inquirer.prompt([
    {
      type: "input",
      name: "Date",
      message: "Date (YYYY-MM-DD):",
      default: getDefaultDate(),
      validate: validateDate,
    },
  ]);
  return {
    Issue: commonInfo.Issue,
    Type: "release",
    Title: commonInfo.Title,
    Link: commonInfo.Link,
    Date: additionalInfo.Date,
  };
};

// Function to handle starter entry
const handleStarter = async () => {
  const commonInfo = await promptCommonInfo();
  return {
    Issue: commonInfo.Issue,
    Type: "starter",
    Title: commonInfo.Title,
    Link: commonInfo.Link,
  };
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
const appendToJsonFile = (data) => {
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

// Function to initialize readline for user input
const initializeReadline = () => {
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
};

// Function to close readline interface
const closeReadline = () => {
  if (rl) {
    rl.close();
  }
};

// Function to prompt user for input
const promptUser = (query) => {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer);
    });
  });
};

// Function to edit a JSON object interactively
const editJsonObject = async (jsonObject) => {
  try {
    // Iterate through each key-value pair
    for (const [key, value] of Object.entries(jsonObject)) {
      const userInput = await promptUser(
        `${key} is "${value}" (Enter = accept, or enter new value): `
      );
      if (userInput) {
        jsonObject[key] = userInput;
      }
    }

    // Return the edited JSON object
    return jsonObject;
  } catch (error) {
    console.error("Error:", error);
  } finally {
    closeReadline();
  }
};

// Main function to prompt for entry type and handle accordingly
const main = async () => {
  // make a backup of the file before making changes
  const inputFilePath = dbFilePath;
  makeBackupFile(inputFilePath);
  closeReadline(); // Close readline before using inquirer
  const { entryType } = await inquirer.prompt([
    {
      type: "list",
      name: "entryType",
      message: "Type of entry:",
      choices: ["1) blog post", "2) site", "3) release", "4) starter"],
    },
  ]);

  let entryData;
  switch (entryType) {
    case "1) blog post":
      entryData = await handleBlogPost();
      break;
    case "2) site":
      entryData = await handleSite();
      break;
    case "3) release":
      entryData = await handleRelease();
      break;
    case "4) starter":
      entryData = await handleStarter();
      break;
    default:
      console.log("Invalid entry type");
      return;
  }

  // Validate if the entry data is a valid JSON object
  if (validateJsonObject(entryData)) {
    console.log("Entry Data is a valid JSON object:", entryData);
    // appendToJsonFile(entryData);
  } else {
    console.error(chalk.red("Entry Data is not a valid JSON object"));
  }

  closeReadline(); // Close readline before using inquirer
  const { whatNext } = await inquirer.prompt([
    {
      type: "list",
      name: "whatNext",
      message: "What's next?",
      choices: ["1) save & exit", "2) save & add another", "3) edit entry"],
    },
  ]);

  let exitStatus = false;
  switch (whatNext) {
    case "1) save & exit":
      appendToJsonFile(entryData);
      exitStatus = true;
      break;
    case "2) save & add another":
      appendToJsonFile(entryData);
      break;
    case "3) edit entry":
      // Provide an editing interface for the JSON object
      // Reinitialize readline for further editing
      initializeReadline();
      let editedData = await editJsonObject(entryData);
      if (validateJsonObject(editedData)) {
        console.log("Entry Data is a valid JSON object:", editedData);
        appendToJsonFile(editedData);
      } else {
        console.error(chalk.red("Entry Data is not a valid JSON object"));
      }
      break;
    default:
      console.log("Invalid choice");
      return;
  }

  if (exitStatus === false) {
    return main();
  } else {
    console.log("All done...bye!");
  }
};

// Run the main function
main().catch((error) => {
  console.error(chalk.red("An error occurred:", error));
});
