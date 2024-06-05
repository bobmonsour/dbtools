import { input, confirm } from "@inquirer/prompts";
import chalk from "chalk";
import { checkForDuplicateUrl } from "./utils.js";

// Main function to prompt for a URL to see if it's already in the db
const main = async () => {
  // console.log(chalk.red("Latest issue number:", getLatestIssueNumber()));
  const url = await input({
    name: "url",
    message: "Enter URL to search for:",
  });

  // Check if the url is already in the database
  const isDuplicate = checkForDuplicateUrl(url);
  if (isDuplicate) {
    console.log(chalk.red("URL is already in the database"));
  } else {
    console.log(chalk.green("URL is not in the database"));
  }

  const restart = await confirm({
    name: "restart",
    message: "Do you want to check another URL? (y/N):",
    default: false,
  });

  if (restart) {
    return main();
  } else {
    console.log("All done!");
  }
};

// Run the main function
main().catch((error) => {
  console.error(chalk.red("An error occurred:", error));
});
