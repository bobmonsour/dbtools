import { rawlist } from "@inquirer/prompts";
import chalk from "chalk";

// Simulate the dataset selection
const testDatasetSelection = async () => {
  console.log("Testing dataset selection feature...\n");

  const datasetChoice = await rawlist({
    message: "Select which dataset to use:",
    choices: [
      { name: "Production dataset (11tybundledb)", value: "production" },
      {
        name: "Development dataset (devdata in this project)",
        value: "development",
      },
    ],
    default: "production",
  });

  console.log("\nYou selected:", datasetChoice);

  if (datasetChoice === "production") {
    console.log(chalk.green("\n✓ Using Production dataset (11tybundledb)\n"));
    console.log(
      "  dbFilePath: /Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb/bundledb.json"
    );
    console.log(
      "  showcaseDataPath: /Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb/showcase-data.json"
    );
    console.log(
      "  dbBackupDir: /Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb/db_backups"
    );
  } else {
    console.log(chalk.green("\n✓ Using Development dataset (devdata)\n"));
    console.log(
      "  dbFilePath: /Users/Bob/Dropbox/Docs/Sites/11tybundle/dbtools/devdata/bundledb.json"
    );
    console.log(
      "  showcaseDataPath: /Users/Bob/Dropbox/Docs/Sites/11tybundle/dbtools/devdata/showcase-data.json"
    );
    console.log(
      "  dbBackupDir: /Users/Bob/Dropbox/Docs/Sites/11tybundle/dbtools/devdata/bundledb-backups"
    );
  }
};

testDatasetSelection();
