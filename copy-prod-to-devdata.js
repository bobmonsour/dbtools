import fs from "fs";
import path from "path";
import chalk from "chalk";
import { fileURLToPath } from "url";

//***************
// Copy Production Data to Devdata
// Copies bundledb.json and showcase-data.json from the production
// 11tybundledb directory to the local devdata directory.
//***************

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDENT = "  ";

const PROD_DB_DIR = "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb";
const DEV_DATA_DIR = path.join(__dirname, "devdata");

const files = ["bundledb.json", "showcase-data.json"];

console.log(chalk.bold.yellow(`\n${INDENT}Copy Production Data to Devdata\n`));

try {
  for (const file of files) {
    const src = path.join(PROD_DB_DIR, file);
    const dest = path.join(DEV_DATA_DIR, file);
    fs.copyFileSync(src, dest);
    console.log(chalk.green(`${INDENT}Copied ${file}`));
  }
  console.log(
    chalk.green(`\n${INDENT}Production data copied to devdata successfully.\n`),
  );
} catch (err) {
  console.log(chalk.bold.red(`\n${INDENT}Error: ${err.message}\n`));
}
