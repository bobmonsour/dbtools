import { input, confirm } from "@inquirer/prompts";
import fs from "fs";
import chalk from "chalk";
import { getLatestIssueNumber } from "./utils.js";
import { config } from "./config.js";

// Get the location of the bundle database file
const dbFilePath = config.dbFilePath;

// Function to read the JSON file and count the number of each type of entry for a given Issue number
const countEntriesByIssue = (issueNumber) => {
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

    // Output the results
    console.log(chalk.blue(`Issue Number: ${issueNumber}`));
    console.log(chalk.green(`Blog Posts: ${blogPostCount}`));
    console.log(chalk.green(`Sites: ${siteCount}`));
    console.log(chalk.green(`Releases: ${releaseCount}`));
    console.log(chalk.green(`Starters: ${starterCount}`));
  } catch (error) {
    console.error(
      chalk.red("Error reading or processing the JSON file:", error)
    );
  }
};

// Function to prompt the user for the issue number
const promptIssueNumber = async () => {
  const answer = await input({
    message: "Enter the issue number:",
    default: getLatestIssueNumber(),
    validate: (input) => {
      if (!isNaN(input)) {
        return true;
      }
      return "Please enter a valid number";
    },
  });
  console.log("answer: ", answer);
  return answer;
};

// Function to prompt the user if they want to make another request
const promptAnotherRequest = async () => {
  const answer = await confirm({
    message: "Another issue? (y/N):",
    default: false,
  });
  return answer;
};

// Main function to run the script
const main = async () => {
  try {
    let continueRequest = true;
    while (continueRequest) {
      const issueNumber = await promptIssueNumber();
      countEntriesByIssue(issueNumber);
      continueRequest = await promptAnotherRequest();
    }
    console.log(chalk.blue("Exiting the program."));
  } catch (error) {
    console.error(chalk.red("An error occurred:", error));
  }
};

// Run the main function
main();
