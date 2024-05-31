import inquirer from "inquirer";
import chalk from "chalk";
import { checkForDuplicateUrl } from "./utils.js";

// Main function to prompt for a link to see if it's already in the db
const main = async () => {
  // console.log(chalk.red("Latest issue number:", getLatestIssueNumber()));
  const { link } = await inquirer.prompt([
    {
      type: "input",
      name: "link",
      message: "Enter link to search for:",
    },
  ]);

  // Check if the link is already in the database
  const isDuplicate = checkForDuplicateUrl(link);
  if (isDuplicate) {
    console.log(chalk.red("Link is already in the database"));
  } else {
    console.log(chalk.green("Link is not in the database"));
  }

  const restart = await inquirer.prompt([
    {
      type: "confirm",
      name: "restart",
      message: "Do you want to check another link?",
      default: false,
    },
  ]);

  if (restart.restart) {
    return main();
  } else {
    console.log("All done!");
  }
};

// Run the main function
main().catch((error) => {
  console.error(chalk.red("An error occurred:", error));
});
