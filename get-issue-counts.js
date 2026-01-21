import { input, confirm } from "@inquirer/prompts";
import chalk from "chalk";
import fs from "fs";
import path from "path";

// Hardcoded path to production database
const BUNDLEDB_PATH =
  "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb/bundledb.json";

// Function to get the latest issue number from production database
const getLatestIssueNumber = () => {
  try {
    const data = fs.readFileSync(BUNDLEDB_PATH, "utf8");
    const jsonData = JSON.parse(data);
    const issueNumbers = jsonData
      .map((entry) => parseInt(entry.Issue, 10))
      .filter((num) => !isNaN(num));
    return issueNumbers.length > 0 ? Math.max(...issueNumbers).toString() : "0";
  } catch (err) {
    console.error(chalk.red("Error reading the JSON file:", err));
    return "0";
  }
};

// Function to count entries by issue number from production database
const countEntriesByIssue = (issueNumber) => {
  try {
    const data = fs.readFileSync(BUNDLEDB_PATH, "utf8");
    const jsonData = JSON.parse(data);

    let blogPostCount = 0;
    let siteCount = 0;
    let releaseCount = 0;
    let starterCount = 0;

    jsonData.forEach((item) => {
      if (item?.Skip) return;

      if (item.Issue == issueNumber) {
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
      chalk.red("Error reading or processing the JSON file:", error),
    );
    return {
      issueNumber,
      blogPostCount: 0,
      siteCount: 0,
      releaseCount: 0,
      starterCount: 0,
    };
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
      const itemCounts = countEntriesByIssue(issueNumber);
      // Output the results
      console.log(chalk.blue(`Issue Number: ${itemCounts.issueNumber}`));
      console.log(chalk.green(`Blog Posts: ${itemCounts.blogPostCount}`));
      console.log(chalk.green(`Sites: ${itemCounts.siteCount}`));
      console.log(chalk.green(`Releases: ${itemCounts.releaseCount}`));
      console.log(chalk.green(`Starters: ${itemCounts.starterCount}`));
      continueRequest = await promptAnotherRequest();
    }
    console.log(chalk.blue("Exiting the program."));
  } catch (error) {
    console.error(chalk.red("An error occurred:", error));
  }
};

// Run the main function
main();
