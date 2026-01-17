#!/usr/bin/env node

// Test script to capture screenshot for one starter entry

import puppeteer from "puppeteer";
import { genScreenshotFilename } from "./genscreenshotfilename.js";
import { fetchTimeout } from "./cacheconfig.js";
import path from "path";
import { fileURLToPath } from "url";
import fsSync from "fs";
import { rawlist, input } from "@inquirer/prompts";
import chalk from "chalk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Function to format timestamp for backup files
const getTimestamp = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}--${hours}${minutes}${seconds}`;
};

// Function to backup existing screenshot
const backupScreenshot = (filePath) => {
  if (!fsSync.existsSync(filePath)) {
    return null;
  }

  const parsedPath = path.parse(filePath);
  const timestamp = getTimestamp();
  const backupPath = path.join(
    parsedPath.dir,
    `${parsedPath.name}-${timestamp}${parsedPath.ext}`,
  );

  fsSync.renameSync(filePath, backupPath);
  return backupPath;
};

// Main function
const captureScreenshot = async () => {
  console.log(chalk.yellow("\n🖼️  Screenshot Generator\n"));

  try {
    // 1. Prompt for dataset selection
    const datasetChoice = await rawlist({
      message: "Select which dataset to use:",
      choices: [
        {
          name: "Production (../11tybundle.dev/content/screenshots)",
          value: "production",
        },
        {
          name: "Development (./screenshots in this project)",
          value: "development",
        },
        { name: chalk.dim("Exit"), value: "exit" },
      ],
      default: "production",
    });

    // Handle exit
    if (datasetChoice === "exit") {
      console.log(chalk.yellow("\n👋 Exiting...\n"));
      process.exit(0);
    }

    // Determine screenshot directory
    const screenshotDir =
      datasetChoice === "production"
        ? path.join(__dirname, "../11tybundle.dev/content/screenshots")
        : path.join(__dirname, "screenshots");

    console.log(chalk.dim(`\nUsing directory: ${screenshotDir}\n`));

    // 2. Prompt for URL
    const testUrl = await input({
      message: "Enter the URL to capture:",
      default: "https://eleventeen.blog/",
      validate: (value) => {
        if (!value.trim()) {
          return "URL cannot be empty";
        }
        try {
          new URL(value);
          return true;
        } catch {
          return "Please enter a valid URL";
        }
      },
    });

    console.log(chalk.cyan(`\nCapturing screenshot for: ${testUrl}\n`));

    const { filename } = await genScreenshotFilename(testUrl);
    console.log(chalk.dim(`Generated filename: ${filename}`));

    const screenshotPath = path.join(screenshotDir, filename);

    // 3. Backup existing screenshot if it exists
    const backupPath = backupScreenshot(screenshotPath);
    if (backupPath) {
      console.log(chalk.yellow(`✓ Backed up existing screenshot to:`));
      console.log(chalk.dim(`  ${backupPath}\n`));
    }

    // Ensure directory exists
    if (!fsSync.existsSync(screenshotDir)) {
      fsSync.mkdirSync(screenshotDir, { recursive: true });
    }

    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.setViewport({ width: 1920, height: 1080 });
    console.log(chalk.cyan("Navigating to URL..."));

    await page.goto(testUrl, {
      waitUntil: "networkidle0",
      timeout: fetchTimeout.singleScreenshot,
    });

    await new Promise((resolve) =>
      setTimeout(resolve, fetchTimeout.screenshotDelay),
    );

    console.log(chalk.cyan("Capturing screenshot..."));
    await page.screenshot({
      path: screenshotPath,
      type: "jpeg",
      quality: 100,
    });

    await browser.close();

    console.log(chalk.green(`\n✓ Screenshot saved to:`));
    console.log(chalk.white(`  ${screenshotPath}\n`));
  } catch (error) {
    console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
    process.exit(1);
  }
};

captureScreenshot();
