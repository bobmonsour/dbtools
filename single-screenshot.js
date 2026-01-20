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
import { makeBackupFile, formatItemDate } from "./utils.js";
import { getfavicon } from "./getfavicon.js";
import { getDescription } from "./getdescription.js";
import { config } from "./config.js";

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

// Function to read showcase data
const readShowcaseData = () => {
  try {
    const data = fsSync.readFileSync(config.showcaseDataPath, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error(chalk.red("Error reading showcase-data.json:", err));
    return [];
  }
};

// Function to save showcase data
const saveShowcaseData = (data) => {
  try {
    fsSync.writeFileSync(
      config.showcaseDataPath,
      JSON.stringify(data, null, 2),
    );
    console.log(chalk.green("✓ Showcase data updated successfully\n"));
  } catch (err) {
    console.error(chalk.red("Error saving showcase-data.json:", err));
    throw err;
  }
};

// Function to find entry by URL in showcase data
const findEntryByUrl = (showcaseData, url) => {
  return showcaseData.find((entry) => entry.link === url);
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

// Function to save screenshot to directory
const saveScreenshotToDir = async (page, directory, filename) => {
  // Ensure directory exists
  if (!fsSync.existsSync(directory)) {
    fsSync.mkdirSync(directory, { recursive: true });
  }

  const screenshotPath = path.join(directory, filename);

  await page.screenshot({
    path: screenshotPath,
    type: "jpeg",
    quality: 100,
  });

  return screenshotPath;
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

    // Determine screenshot directories
    const localScreenshotDir = path.join(__dirname, "screenshots");
    const productionScreenshotDir = path.join(
      __dirname,
      "../11tybundle.dev/content/screenshots",
    );

    console.log(
      chalk.dim(
        `\nUsing ${datasetChoice === "production" ? "production" : "development"} mode\n`,
      ),
    );

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

    console.log(chalk.cyan(`\nProcessing: ${testUrl}\n`));

    // 3. Read showcase data and check if URL exists
    const showcaseData = readShowcaseData();
    const existingEntry = findEntryByUrl(showcaseData, testUrl);

    const { filename } = await genScreenshotFilename(testUrl);
    console.log(chalk.dim(`Screenshot filename: ${filename}`));

    let title = "";
    let isNewEntry = false;

    if (existingEntry) {
      console.log(chalk.green(`\n✓ URL found in showcase data`));
      console.log(chalk.dim(`  Title: ${existingEntry.title}\n`));

      // Backup existing screenshots in both locations if they exist
      const localScreenshotPath = path.join(localScreenshotDir, filename);
      const backupPathLocal = backupScreenshot(localScreenshotPath);
      if (backupPathLocal) {
        console.log(chalk.yellow(`✓ Backed up local screenshot`));
      }

      if (datasetChoice === "production") {
        const prodScreenshotPath = path.join(productionScreenshotDir, filename);
        const backupPathProd = backupScreenshot(prodScreenshotPath);
        if (backupPathProd) {
          console.log(chalk.yellow(`✓ Backed up production screenshot`));
        }
      }
      console.log("");
    } else {
      console.log(chalk.yellow(`\n⚠ URL not found in showcase data`));
      console.log(chalk.dim(`  Will create new entry\n`));
      isNewEntry = true;

      // Prompt for title for new entries
      title = await input({
        message: "Enter the site title:",
        validate: (value) => {
          if (!value.trim()) {
            return "Title cannot be empty";
          }
          return true;
        },
      });
    }

    // 4. Capture screenshot with Puppeteer
    console.log(chalk.cyan("\nLaunching browser..."));
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

    // 5. Save screenshots based on mode
    const savedPaths = [];

    // Always save to local directory
    const localPath = await saveScreenshotToDir(
      page,
      localScreenshotDir,
      filename,
    );
    savedPaths.push(localPath);
    console.log(chalk.green(`✓ Screenshot saved to local directory`));

    // Production mode: also save to production directory
    if (datasetChoice === "production") {
      const prodPath = await saveScreenshotToDir(
        page,
        productionScreenshotDir,
        filename,
      );
      savedPaths.push(prodPath);
      console.log(chalk.green(`✓ Screenshot saved to production directory`));
    }

    await browser.close();

    // 6. Update or create showcase entry
    if (isNewEntry) {
      console.log(chalk.cyan("\n📝 Creating new showcase entry..."));

      // Auto-fetch metadata
      console.log(chalk.dim("  Fetching favicon..."));
      const favicon = await getfavicon(testUrl);

      console.log(chalk.dim("  Fetching description..."));
      const description = await getDescription(testUrl);

      // Create new entry
      const now = new Date();
      const newEntry = {
        title: title,
        description: description || "",
        link: testUrl,
        date: now.toISOString(),
        formattedDate: formatItemDate(now.toISOString()),
        favicon: favicon || "#icon-globe",
        screenshotpath: `/screenshots/${filename}`,
      };

      // Backup showcase data before modifying
      console.log(chalk.dim("\n  Creating backup of showcase data..."));
      await makeBackupFile(config.showcaseDataPath, config.showcaseBackupDir);

      // Insert at beginning to maintain newest-first order
      showcaseData.unshift(newEntry);

      // Save updated showcase data
      saveShowcaseData(showcaseData);

      console.log(chalk.green(`\n✓ New showcase entry created successfully`));
      console.log(chalk.dim(`  Title: ${title}`));
      console.log(chalk.dim(`  Favicon: ${favicon || "#icon-globe"}`));
      console.log(
        chalk.dim(
          `  Description: ${description ? description.substring(0, 60) + "..." : "(none)"}`,
        ),
      );
    } else {
      // For existing entries, only screenshot is replaced - no data changes
      console.log(
        chalk.green(`\n✓ Screenshot replaced (showcase data unchanged)\n`),
      );
    }

    console.log(chalk.green(`✅ Process completed successfully!\n`));

    for (const savedPath of savedPaths) {
      console.log(chalk.white(`  ${savedPath}`));
    }
    console.log("");
  } catch (error) {
    console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
    process.exit(1);
  }
};

captureScreenshot();
