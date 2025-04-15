import { input, confirm, select } from "@inquirer/prompts";
import chalk from "chalk";
import { countEntriesAsOfDate } from "./utils.js";

// Function to validate the date
const validateDate = (date) => {
  const enteredDate = new Date(date);
  const today = new Date();
  if (isNaN(enteredDate.getTime()) || enteredDate >= today) {
    return "Please enter a valid date prior to today (yyyy-mm-dd)";
  }
  return true;
};

// Function to prompt the user for a date
const promptDate = async () => {
  const answer = await input({
    message: "Enter a date (yyyy-mm-dd):",
    validate: validateDate,
  });
  return answer;
};

// Function to prompt the user for 'before' or 'after'
const promptBeforeAfter = async () => {
  const answer = await select({
    message: "Select 'before' or 'after':",
    choices: [
      { name: "Before", value: "before" },
      { name: "After", value: "after" },
    ],
  });
  return answer;
};

// Function to prompt the user if they want to make another request
const promptAnotherRequest = async () => {
  const answer = await confirm({
    message: "Another request? (y/N):",
    default: false,
  });
  return answer;
};

// Main function to run the script
const main = async () => {
  try {
    let continueRequest = true;
    while (continueRequest) {
      const date = await promptDate();
      const beforeAfter = await promptBeforeAfter();
      const postCount = countEntriesAsOfDate(date, beforeAfter);
      // Output the results
      console.log(
        chalk.blue(
          `Number of posts ${beforeAfter} ${date}: ${chalk.green(postCount)}`
        )
      );
      continueRequest = await promptAnotherRequest();
    }
    console.log(chalk.blue("Exiting the program."));
  } catch (error) {
    console.error(chalk.red("An error occurred:", error));
  }
};

// Run the main function
main();
