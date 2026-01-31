#!/usr/bin/env node

// Bundle script - Main menu launcher for editorial scripts

import { select } from "@inquirer/prompts";
import { exec, spawn } from "child_process";
import chalk from "chalk";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Script menu options
const scripts = [
  {
    name: "1. Make Bundle Entries - Create new database entries",
    value: "make-bundle-entries.js",
  },
  {
    name: "2. Check Empty Fields - Validate database entries",
    value: "check-empty-fields.js",
  },
  {
    name: "3. Single Screenshot - Generate a replacement screenshot",
    value: "single-screenshot.js",
  },
  {
    name: "4. Check Link Errors - Scan database for broken links",
    value: "check-link-errors.js",
  },
  {
    name: "5. Generate Latest Data - Export latest issue data",
    value: "generate-latest-data.js",
  },
  {
    name: "6. Create Blog Post - Create new issue announcement post",
    value: "create-blog-post.js",
  },
  {
    name: "7. Remove Test Data - Remove bobDemo entries from database",
    value: "remove-test-data.js",
  },
  {
    name: "8. Copy Production Data - Copy production data to devdata",
    value: "copy-prod-to-devdata.js",
  },
  {
    name: "9. Generate Insights - Generate and view database insights",
    value: "generate-insights",
  },
  {
    name: chalk.dim("10. Exit"),
    value: "exit",
  },
];

// Function to run a script
const runScript = (scriptName) => {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, scriptName);

    console.log(chalk.cyan(`\nRunning ${scriptName}...\n`));

    const child = spawn("node", [scriptPath], {
      stdio: "inherit", // Inherit stdin, stdout, stderr for interactive prompts
      cwd: __dirname,
    });

    child.on("close", (code) => {
      if (code !== 0) {
        console.log(chalk.yellow(`\n${scriptName} exited with code ${code}\n`));
      }
      resolve(code);
    });

    child.on("error", (err) => {
      console.error(
        chalk.red(`\nError running ${scriptName}: ${err.message}\n`),
      );
      reject(err);
    });
  });
};

// Main menu function
const showMenu = async () => {
  while (true) {
    console.log(chalk.yellow("\n📦 11ty Bundle Tools\n"));

    const choice = await select({
      message: "Select a script to run:",
      choices: scripts,
      pageSize: scripts.length,
    });

    if (choice === "exit") {
      console.log(chalk.green("\n👋 Goodbye!\n"));
      process.exit(0);
    }

    try {
      if (choice === "generate-insights") {
        await runScript("generate-insights.js");
        const insightsPath = path.join(__dirname, "insights", "index.html");
        exec(`open "${insightsPath}"`);
      } else {
        await runScript(choice);
      }
    } catch (error) {
      // Error already logged in runScript
    }

    // After script completes, loop back to menu
    console.log(chalk.dim("\n" + "─".repeat(50) + "\n"));
  }
};

// Start the menu
showMenu();
