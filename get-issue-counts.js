import { input, confirm } from "@inquirer/prompts";
import chalk from "chalk";
import { getLatestIssueNumber, countEntriesByIssue } from "./utils.js";

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
