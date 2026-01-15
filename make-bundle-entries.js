import { input, rawlist, checkbox, confirm, search } from "@inquirer/prompts";
import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";
import puppeteer from "puppeteer";
import {
  makeBackupFile,
  getLatestIssueNumber,
  checkForDuplicateUrl,
  countEntriesByIssue,
  getUniqueCategories,
  formatItemDate,
} from "./utils.js";
import { config } from "./config.js";
import { fetchTimeout } from "./cacheconfig.js";
import { genIssueRecords } from "./genissuerecords.js";
import { getRSSLink } from "./getrsslink.js";
import { getFavicon } from "./getfavicon.js";
import { getSocialLinks } from "./getsociallinks.js";
import { getDescription } from "./getdescription.js";
import { getGitHubDescription } from "./getgithubdescription.js";
import { hasLeaderboardLink } from "./hasleaderboardlink.js";
import { genScreenshotFilename } from "./genscreenshotfilename.js";
import { exec } from "child_process";
import util from "util";
import slugify from "@sindresorhus/slugify";

// Get the location of the bundle database file
let dbFilePath = config.dbFilePath;
let showcaseDataPath = config.showcaseDataPath;
let dbBackupDir = config.dbBackupDir;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotDir = path.join(__dirname, "screenshots");
const productionScreenshotDir = path.join(
  __dirname,
  "../11tybundle.dev/content/screenshots"
);
// Set db file backup state
let backedUp = false;
// Set next action after initial entry
let nextAction = "ask what next";
// Create the entry data object
let entryData = {};
// Global browser instance for screenshot capture
let browser = null;
let { uniqueCategoryChoices, uniqueCategories } = getUniqueCategories();
let uniqueAuthors = [];

// Function to get unique authors from blog posts in the production database
const getUniqueAuthors = () => {
  try {
    const data = fs.readFileSync(dbFilePath, "utf8");
    const jsonData = JSON.parse(data);
    const authors = jsonData
      .filter((entry) => entry.Type === "blog post")
      .map((entry) => entry.Author)
      .filter((author) => author && author.trim() !== "");
    return [...new Set(authors)].sort();
  } catch (err) {
    console.error(chalk.red("Error reading authors from database:", err));
    return [];
  }
};

// Function to get existing author metadata from most recent blog post
const getExistingAuthorMetadata = (authorName) => {
  try {
    const data = fs.readFileSync(dbFilePath, "utf8");
    const jsonData = JSON.parse(data);

    // Filter blog posts by author
    const authorPosts = jsonData.filter(
      (entry) => entry.Type === "blog post" && entry.Author === authorName
    );

    if (authorPosts.length === 0) {
      return null;
    }

    // Sort by date descending and get the most recent
    const mostRecentPost = authorPosts.sort((a, b) => {
      const dateA = new Date(a.Date);
      const dateB = new Date(b.Date);
      return dateB - dateA; // Most recent first
    })[0];

    // Extract metadata
    return {
      AuthorSite: mostRecentPost.AuthorSite || "",
      AuthorSiteDescription: mostRecentPost.AuthorSiteDescription || "",
      socialLinks: mostRecentPost.socialLinks || {
        mastodon: "",
        bluesky: "",
        youtube: "",
        github: "",
        linkedin: "",
      },
      favicon: mostRecentPost.favicon || "",
      rssLink: mostRecentPost.rssLink || "",
      postTitle: mostRecentPost.Title,
      postDate: mostRecentPost.Date,
    };
  } catch (err) {
    console.error(chalk.red("Error reading author metadata:", err));
    return null;
  }
};

// Function to display existing author metadata
const displayExistingAuthorMetadata = (metadata) => {
  console.log(chalk.cyan("\n=== Existing Author Metadata ==="));
  console.log(
    chalk.gray(`From: "${metadata.postTitle}" (${metadata.postDate})`)
  );
  console.log(chalk.white(`AuthorSite: ${metadata.AuthorSite || "(empty)"}`));
  console.log(
    chalk.white(
      `AuthorSiteDescription: ${metadata.AuthorSiteDescription || "(empty)"}`
    )
  );
  console.log(chalk.white(`RSS Link: ${metadata.rssLink || "(empty)"}`));
  console.log(chalk.white(`Favicon: ${metadata.favicon || "(empty)"}`));
  console.log(chalk.white("Social Links:"));
  console.log(
    chalk.white(`  Mastodon: ${metadata.socialLinks.mastodon || "(empty)"}`)
  );
  console.log(
    chalk.white(`  Bluesky: ${metadata.socialLinks.bluesky || "(empty)"}`)
  );
  console.log(
    chalk.white(`  YouTube: ${metadata.socialLinks.youtube || "(empty)"}`)
  );
  console.log(
    chalk.white(`  GitHub: ${metadata.socialLinks.github || "(empty)"}`)
  );
  console.log(
    chalk.white(`  LinkedIn: ${metadata.socialLinks.linkedin || "(empty)"}`)
  );
  console.log(chalk.cyan("================================\n"));
};

// Function to prompt for dataset selection and update runtime configuration
const selectDataset = async () => {
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

  // Update runtime configuration based on selection
  if (datasetChoice === "production") {
    dbFilePath =
      "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb/bundledb.json";
    showcaseDataPath =
      "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb/showcase-data.json";
    dbBackupDir =
      "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb/db_backups";

    // Update config object for utilities that reference it
    config.dbFilePath = dbFilePath;
    config.showcaseDataPath = showcaseDataPath;
    config.dbBackupDir = dbBackupDir;
    config.dbFileDir = "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb";

    console.log(chalk.green("\n✓ Using Production dataset (11tybundledb)\n"));
  } else {
    dbFilePath =
      "/Users/Bob/Dropbox/Docs/Sites/11tybundle/dbtools/devdata/bundledb.json";
    showcaseDataPath =
      "/Users/Bob/Dropbox/Docs/Sites/11tybundle/dbtools/devdata/showcase-data.json";
    dbBackupDir =
      "/Users/Bob/Dropbox/Docs/Sites/11tybundle/dbtools/devdata/bundledb-backups";

    // Update config object for utilities that reference it
    config.dbFilePath = dbFilePath;
    config.showcaseDataPath = showcaseDataPath;
    config.dbBackupDir = dbBackupDir;
    config.dbFileDir =
      "/Users/Bob/Dropbox/Docs/Sites/11tybundle/dbtools/devdata";

    console.log(chalk.green("\n✓ Using Development dataset (devdata)\n"));
  }

  // Refresh category and author lists from the selected database
  const result = getUniqueCategories();
  uniqueCategoryChoices = result.uniqueCategoryChoices;
  uniqueCategories = result.uniqueCategories;
  uniqueAuthors = getUniqueAuthors();
};

// Generate a date string that includes date and time in local timezone
const getCurrentDateTimeString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000`;
};

// Helper to extract origin from URL
const getOriginFromUrl = (url) => {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
};

// Normalize URL for comparison (strip www, normalize protocol)
const normalizeUrl = (url) => {
  try {
    const urlObj = new URL(url);
    let hostname = urlObj.hostname.toLowerCase();

    // Remove www. prefix
    if (hostname.startsWith("www.")) {
      hostname = hostname.substring(4);
    }

    // Normalize protocol to https
    const normalized = `https://${hostname}${urlObj.pathname}`;

    // Remove trailing slash
    return normalized.endsWith("/") && normalized.length > 1
      ? normalized.slice(0, -1)
      : normalized;
  } catch (e) {
    return url.toLowerCase();
  }
};

// Initialize browser for screenshot capture (lazy loading)
const initBrowser = async () => {
  if (!browser) {
    console.log(chalk.cyan("Launching browser for screenshots..."));
    browser = await puppeteer.launch();
  }
  return browser;
};

// Close browser on exit
const closeBrowser = async () => {
  if (browser) {
    await browser.close();
    browser = null;
  }
};

// Rename existing screenshot file with timestamp
const renameExistingScreenshot = (screenshotPath) => {
  if (!fs.existsSync(screenshotPath)) {
    return;
  }

  const timestamp = new Date()
    .toISOString()
    .replace(/:/g, "-")
    .replace(/\..+/, "")
    .replace("T", "-");
  const ext = path.extname(screenshotPath);
  const base = path.basename(screenshotPath, ext);
  const dir = path.dirname(screenshotPath);
  const newName = `${base}-${timestamp}${ext}`;
  const newPath = path.join(dir, newName);

  try {
    fs.renameSync(screenshotPath, newPath);
    console.log(chalk.gray(`  Renamed old screenshot to: ${newName}`));
  } catch (error) {
    console.log(
      chalk.yellow(`  Could not rename old screenshot: ${error.message}`)
    );
  }
};

// Capture screenshot for a URL
const captureScreenshot = async (url, filename) => {
  try {
    const browserInstance = await initBrowser();
    const page = await browserInstance.newPage();

    // Set viewport dimensions
    await page.setViewport({ width: 1920, height: 1080 });

    // Navigate to URL with timeout
    await page.goto(url, {
      waitUntil: "networkidle0",
      timeout: fetchTimeout.singleScreenshot,
    });

    // Wait for page to fully render
    await new Promise((resolve) =>
      setTimeout(resolve, fetchTimeout.screenshotDelay)
    );

    // Generate paths
    const localPath = path.join(screenshotDir, filename);
    const prodPath = path.join(productionScreenshotDir, filename);

    // Rename existing screenshots if they exist
    renameExistingScreenshot(localPath);
    renameExistingScreenshot(prodPath);

    // Ensure directories exist
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    if (!fs.existsSync(productionScreenshotDir)) {
      fs.mkdirSync(productionScreenshotDir, { recursive: true });
    }

    // Take screenshot
    await page.screenshot({
      path: localPath,
      type: "jpeg",
      quality: 100,
    });

    // Copy to production location
    fs.copyFileSync(localPath, prodPath);

    await page.close();

    console.log(chalk.green(`  ✓ Screenshot captured: ${filename}`));
    return `/screenshots/${filename}`;
  } catch (error) {
    console.log(chalk.red(`  ✗ Screenshot failed: ${error.message}`));
    return null;
  }
};

// Transform bundledb entry to showcase format
const transformToShowcaseFormat = (
  entry,
  screenshotpath,
  leaderboardLink = null
) => {
  const showcase = {
    title: entry.Title || "",
    description: entry.description || "",
    link: entry.Link || "",
    date: entry.Date || "",
    formattedDate: entry.formattedDate || "",
    favicon: entry.favicon || "",
    screenshotpath: screenshotpath || "",
  };

  // Add leaderboardLink only if it exists
  if (leaderboardLink) {
    showcase.leaderboardLink = leaderboardLink;
  }

  return showcase;
};

// Load showcase-data.json
const loadShowcaseData = () => {
  try {
    if (fs.existsSync(showcaseDataPath)) {
      return JSON.parse(fs.readFileSync(showcaseDataPath, "utf-8"));
    }
    return [];
  } catch (error) {
    console.log(
      chalk.yellow(`Could not load showcase-data.json: ${error.message}`)
    );
    return [];
  }
};

// Save showcase-data.json
const saveShowcaseData = (data) => {
  try {
    // Sort by date descending
    data.sort((a, b) => new Date(b.date) - new Date(a.date));

    fs.writeFileSync(showcaseDataPath, JSON.stringify(data, null, 2));
    console.log(chalk.green("  ✓ showcase-data.json updated"));
  } catch (error) {
    console.log(
      chalk.red(`  ✗ Could not save showcase-data.json: ${error.message}`)
    );
  }
};

// Check if entry exists in showcase-data.json by normalized URL
const findShowcaseEntry = (showcaseData, url) => {
  const normalizedUrl = normalizeUrl(url);
  return showcaseData.findIndex(
    (entry) => normalizeUrl(entry.link) === normalizedUrl
  );
};

// Display showcase entry in formatted style
const displayShowcaseEntry = (showcaseEntry) => {
  console.log(chalk.blue("\n--- Showcase Entry ---"));
  console.log(chalk.cyan("Title:"), showcaseEntry.title);
  console.log(chalk.cyan("Description:"), showcaseEntry.description);
  console.log(chalk.cyan("Link:"), showcaseEntry.link);
  console.log(chalk.cyan("Date:"), showcaseEntry.date);
  console.log(chalk.cyan("Formatted Date:"), showcaseEntry.formattedDate);
  console.log(chalk.cyan("Favicon:"), showcaseEntry.favicon);
  console.log(chalk.cyan("Screenshot Path:"), showcaseEntry.screenshotpath);
  if (showcaseEntry.leaderboardLink) {
    console.log(chalk.cyan("Leaderboard Link:"), showcaseEntry.leaderboardLink);
  }
  console.log(chalk.blue("--- End Showcase Entry ---\n"));
};

// Function to generate a default date for the entry
// The date should default to today's date in the format of YYYY-MM-DD
const getDefaultDate = () => {
  return getCurrentDateTimeString();
  // const currentDate = new Date();
  // const year = currentDate.getFullYear();
  // const month = String(currentDate.getMonth() + 1).padStart(2, "0");
  // const day = String(currentDate.getDate()).padStart(2, "0");
  // return `${year}-${month}-${day}`;
};

// Function to validate date format
const validateDate = (input) => {
  // Accept YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.000
  const datePattern = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
  const dateTimePattern =
    /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T\d{2}:\d{2}:\d{2}\.\d{3}$/;

  if (!datePattern.test(input) && !dateTimePattern.test(input)) {
    return "Please enter a valid date in YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.000 format.";
  }

  // Parse the date part only for validation
  const datePart = input.split("T")[0];
  const [year, month, day] = datePart.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0); // Set time to 00:00:00 for accurate comparison

  if (
    date.getMonth() + 1 !== month ||
    date.getDate() !== day ||
    date.getFullYear() !== year
  ) {
    return "Invalid date. Enter date in YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.000 format.";
  }

  return true;
};

// Function to validate URL format
const validateUrlFormat = (url) => {
  try {
    new URL(url);
    return true;
  } catch (err) {
    return "Please enter a valid URL.";
  }
};

// Function to check if URL is accessible
const validateUrlAccessibility = async (url) => {
  try {
    await axios.head(url);
    return true;
  } catch (err) {
    return "URL is not accessible.";
  }
};

// Function to validate the Link
const validateLink = async (input) => {
  const formatValidation = validateUrlFormat(input);
  if (formatValidation !== true) {
    return formatValidation;
  }
  if (checkForDuplicateUrl(input)) {
    return "This Link already exists in the data!";
  }
  const accessibilityValidation = await validateUrlAccessibility(input);
  return accessibilityValidation;
};

// Function to validate the Author site (optional field)
const validateAuthorSite = async (input) => {
  // Allow blank input (optional field)
  if (!input || input.trim() === "") {
    return true;
  }
  // If provided, validate format and accessibility
  const formatValidation = validateUrlFormat(input);
  if (formatValidation !== true) {
    return formatValidation;
  }
  const accessibilityValidation = await validateUrlAccessibility(input);
  return accessibilityValidation;
};

// Function to prompt for common information
const promptCommonInfo = async (enterOrEdit, entryData) => {
  const latestIssueNumber = getLatestIssueNumber();
  const commonInfo = {};
  commonInfo.Issue = await input({
    message: `Issue (latest is ${latestIssueNumber}):`,
    default: enterOrEdit === "edit" ? entryData.Issue : latestIssueNumber,
    validate: function (input) {
      if (input.trim() === "" || !isNaN(input)) {
        return true;
      }
      return "Please enter a valid number or leave the input blank.";
    },
  });
  commonInfo.Title = await input({
    message: "Title:",
    default: enterOrEdit === "edit" ? entryData.Title : null,
    validate: (input) => (input ? true : "Title is required."),
  });
  commonInfo.Link = await input({
    message: "Link:",
    default: enterOrEdit === "edit" ? entryData.Link : null,
    validate: validateLink,
  });
  return commonInfo;
};

// Function to ENTER post info
const enterPost = async () => {
  const commonInfo = await promptCommonInfo("enter");
  const Date = await input({
    message: "Date (YYYY-MM-DD):",
    default: getDefaultDate(),
    validate: validateDate,
  });
  const Author = await search({
    message: "Author:",
    source: async (input) => {
      if (!input) return uniqueAuthors.map((name) => ({ value: name }));
      const lowerInput = input.toLowerCase();
      return uniqueAuthors
        .filter((name) => name.toLowerCase().startsWith(lowerInput))
        .map((name) => ({ value: name }));
    },
    validate: (input) => (input ? true : "Author is required."),
  });

  // Check for existing author metadata
  const existingMetadata = getExistingAuthorMetadata(Author);
  let useExistingMetadata = false;

  if (existingMetadata) {
    console.log(chalk.green(`\nFound existing metadata for author: ${Author}`));
    displayExistingAuthorMetadata(existingMetadata);

    useExistingMetadata = await confirm({
      message: "Use existing metadata?",
      default: true,
    });

    if (!useExistingMetadata) {
      console.log(chalk.yellow("Will fetch fresh metadata from website..."));
    }
  }

  const defaultAuthorSite =
    useExistingMetadata && existingMetadata
      ? existingMetadata.AuthorSite
      : getOriginFromUrl(commonInfo.Link);
  const AuthorSite = await input({
    message: "Author site (optional):",
    default: defaultAuthorSite,
    validate: validateAuthorSite,
  });
  const Categories = await checkbox({
    message: "Categories (1 or more):",
    pageSize: 10,
    choices: uniqueCategoryChoices,
    validate: (input) =>
      input.length > 0 ? true : "At least one category must be selected.",
  });

  // Fetch metadata
  let description = "";
  let authorSiteDescription = "";
  let rssLink = "";
  let socialLinks = {
    mastodon: "",
    bluesky: "",
    youtube: "",
    github: "",
    linkedin: "",
  };
  let favicon = "";

  // Always fetch description from the blog post link
  try {
    description = (await getDescription(commonInfo.Link)) || "";
  } catch (error) {
    console.log(chalk.yellow("Could not fetch description:", error.message));
  }

  const siteToFetch =
    AuthorSite && AuthorSite.trim() !== "" ? AuthorSite : commonInfo.Link;

  // Use existing metadata or fetch fresh
  if (useExistingMetadata && existingMetadata) {
    console.log(chalk.blue("Using existing author metadata..."));
    authorSiteDescription = existingMetadata.AuthorSiteDescription;
    rssLink = existingMetadata.rssLink;
    socialLinks = existingMetadata.socialLinks;
    favicon = existingMetadata.favicon;
  } else {
    console.log(chalk.blue("Fetching metadata..."));

    // Fetch AuthorSiteDescription if AuthorSite exists
    if (AuthorSite && AuthorSite.trim() !== "") {
      try {
        authorSiteDescription = (await getDescription(AuthorSite)) || "";
      } catch (error) {
        console.log(
          chalk.yellow(
            "Could not fetch author site description:",
            error.message
          )
        );
      }
    }

    try {
      rssLink = (await getRSSLink(siteToFetch)) || "";
    } catch (error) {
      console.log(chalk.yellow("Could not fetch RSS link:", error.message));
    }

    try {
      socialLinks = (await getSocialLinks(siteToFetch)) || socialLinks;
    } catch (error) {
      console.log(chalk.yellow("Could not fetch social links:", error.message));
    }

    try {
      favicon = (await getFavicon(siteToFetch, "post")) || "";
    } catch (error) {
      console.log(chalk.yellow("Could not fetch favicon:", error.message));
    }
  }

  entryData = {
    Issue: commonInfo.Issue,
    Type: "blog post",
    Title: commonInfo.Title,
    slugifiedTitle: slugify(commonInfo.Title),
    Link: commonInfo.Link,
    Date: Date,
    formattedDate: formatItemDate(Date),
    description: description || "",
    Author: Author,
    slugifiedAuthor: slugify(Author),
    ...(AuthorSite && AuthorSite.trim() !== "" ? { AuthorSite } : {}),
    ...(AuthorSite && AuthorSite.trim() !== ""
      ? { AuthorSiteDescription: authorSiteDescription }
      : {}),
    socialLinks: socialLinks || {
      mastodon: "",
      bluesky: "",
      youtube: "",
      github: "",
      linkedin: "",
    },
    favicon: favicon || "",
    rssLink: rssLink || "",
    Categories: Categories,
  };
  return;
};

// Function to ENTER site info
const enterSite = async () => {
  const commonInfo = await promptCommonInfo("enter");
  const Date = await input({
    message: "Date (YYYY-MM-DD):",
    default: getDefaultDate(),
    validate: validateDate,
  });

  // Fetch metadata
  console.log(chalk.blue("Fetching metadata..."));
  let description = "";
  let favicon = "";

  try {
    description = (await getDescription(commonInfo.Link)) || "";
  } catch (error) {
    console.log(chalk.yellow("Could not fetch description:", error.message));
  }

  try {
    favicon = (await getFavicon(commonInfo.Link, "site")) || "";
  } catch (error) {
    console.log(chalk.yellow("Could not fetch favicon:", error.message));
  }

  // Prompt for screenshot capture
  const captureScreenshotPrompt = await confirm({
    message: "Capture screenshot?",
    default: true,
  });

  let screenshotpath = null;
  let leaderboardLink = null;

  if (captureScreenshotPrompt) {
    console.log(chalk.blue("Capturing screenshot..."));

    // Generate filename
    const { filename } = await genScreenshotFilename(commonInfo.Link);

    // Capture screenshot
    screenshotpath = await captureScreenshot(commonInfo.Link, filename);

    // Check for leaderboard link if screenshot succeeded
    if (screenshotpath) {
      console.log(chalk.blue("Checking for leaderboard link..."));
      leaderboardLink = await hasLeaderboardLink(commonInfo.Link);
      if (leaderboardLink) {
        console.log(
          chalk.green(`  ✓ Leaderboard link found: ${leaderboardLink}`)
        );
      }
    }
  }

  entryData = {
    Issue: commonInfo.Issue,
    Type: "site",
    Title: commonInfo.Title,
    description: description || "",
    Link: commonInfo.Link,
    Date: Date,
    formattedDate: formatItemDate(Date),
    favicon: favicon || "",
  };

  // Add to showcase-data.json if screenshot was captured
  if (screenshotpath) {
    try {
      console.log(chalk.blue("Adding entry to showcase-data.json..."));

      // Backup showcase-data.json
      if (fs.existsSync(showcaseDataPath)) {
        makeBackupFile(showcaseDataPath);
      }

      // Load showcase data
      const showcaseData = loadShowcaseData();

      // Check for duplicate
      const existingIndex = findShowcaseEntry(showcaseData, commonInfo.Link);
      if (existingIndex >= 0) {
        console.log(
          chalk.yellow(
            "  Entry already exists in showcase-data.json, updating..."
          )
        );
        showcaseData[existingIndex] = transformToShowcaseFormat(
          entryData,
          screenshotpath,
          leaderboardLink
        );
      } else {
        // Add new entry
        const showcaseEntry = transformToShowcaseFormat(
          entryData,
          screenshotpath,
          leaderboardLink
        );
        showcaseData.push(showcaseEntry);
      }

      // Save showcase data
      saveShowcaseData(showcaseData);
    } catch (error) {
      console.log(
        chalk.red(`  ✗ Error updating showcase-data.json: ${error.message}`)
      );
    }
  }

  return;
};

// Function to ENTER release info
const enterRelease = async () => {
  const commonInfo = await promptCommonInfo("enter");
  const additionalInfo = await input({
    message: "Date (YYYY-MM-DD):",
    default: getDefaultDate(),
    validate: validateDate,
  });
  // Fetch description
  let description = "";
  try {
    description = (await getDescription(commonInfo.Link)) || "";
  } catch (error) {
    console.log(chalk.yellow("Could not fetch description:", error.message));
  }

  entryData = {
    Issue: commonInfo.Issue,
    Type: "release",
    Title: commonInfo.Title,
    description: description,
    Link: commonInfo.Link,
    Date: additionalInfo,
    formattedDate: formatItemDate(additionalInfo),
  };
  return;
};

// Function to ENTER starter info
const enterStarter = async () => {
  const commonInfo = await promptCommonInfo("enter");

  // Prompt for Demo URL
  const Demo = await input({
    message: "Demo URL (optional):",
    default: "",
    validate: async (input) => {
      if (!input || input.trim() === "") return true;
      const formatValidation = validateUrlFormat(input);
      if (formatValidation !== true) return formatValidation;
      return await validateUrlAccessibility(input);
    },
  });

  // Fetch description from GitHub repo
  console.log(chalk.blue("Fetching metadata..."));
  let description = "";

  try {
    description = (await getGitHubDescription(commonInfo.Link)) || "";
    if (description) {
      console.log(chalk.green("  ✓ Description fetched from GitHub"));
    }
  } catch (error) {
    console.log(
      chalk.yellow("Could not fetch GitHub description:", error.message)
    );
  }

  // If GitHub fetch failed and Demo URL exists, try fetching from Demo site
  if (!description && Demo && Demo.trim() !== "") {
    try {
      description = (await getDescription(Demo)) || "";
      if (description) {
        console.log(chalk.green("  ✓ Description fetched from Demo site"));
      }
    } catch (error) {
      console.log(
        chalk.yellow("Could not fetch Demo site description:", error.message)
      );
    }
  }

  let screenshotpath = null;

  // Prompt for screenshot capture if Demo URL exists
  if (Demo && Demo.trim() !== "") {
    const captureScreenshotPrompt = await confirm({
      message: "Capture screenshot?",
      default: true,
    });

    if (captureScreenshotPrompt) {
      console.log(chalk.blue("Capturing screenshot..."));

      // Generate filename from Demo URL
      const { filename } = await genScreenshotFilename(Demo);

      // Capture screenshot
      screenshotpath = await captureScreenshot(Demo, filename);
    }
  }

  entryData = {
    Issue: commonInfo.Issue,
    Type: "starter",
    Title: commonInfo.Title,
    Link: commonInfo.Link,
  };

  // Add optional fields if they exist
  if (Demo && Demo.trim() !== "") {
    entryData.Demo = Demo;
  }
  if (description) {
    entryData.description = description;
  }
  if (screenshotpath) {
    entryData.screenshotpath = screenshotpath;
  }

  return;
};

// Function to EDIT post info
const editPost = async () => {
  const commonInfo = await promptCommonInfo("edit", entryData);
  const Date = await input({
    message: "Date:",
    default: entryData.Date,
    validate: validateDate,
  });
  const Author = await search({
    message: "Author:",
    default: entryData.Author,
    source: async (input) => {
      const searchInput = input || entryData.Author || "";
      if (!searchInput) return uniqueAuthors.map((name) => ({ value: name }));
      const lowerInput = searchInput.toLowerCase();
      return uniqueAuthors
        .filter((name) => name.toLowerCase().startsWith(lowerInput))
        .map((name) => ({ value: name }));
    },
    validate: (input) => (input ? true : "Author is required."),
  });
  const defaultAuthorSite =
    entryData.AuthorSite || getOriginFromUrl(commonInfo.Link);
  const AuthorSite = await input({
    message: "Author site (optional):",
    default: defaultAuthorSite,
    validate: validateAuthorSite,
  });
  const Categories = await checkbox({
    message: "Categories (1 or more):",
    pageSize: 10,
    choices: uniqueCategories.map((category) => {
      return {
        value: category,
        checked: entryData.Categories.includes(category),
      };
    }),
    validate: (input) =>
      input.length > 0 ? true : "At least one category must be selected.",
  });

  // Fetch metadata
  console.log(chalk.blue("Fetching metadata..."));
  let description = "";
  let authorSiteDescription = "";
  let rssLink = "";
  let socialLinks = {
    mastodon: "",
    bluesky: "",
    youtube: "",
    github: "",
    linkedin: "",
  };
  let favicon = "";

  try {
    description = (await getDescription(commonInfo.Link)) || "";
  } catch (error) {
    console.log(chalk.yellow("Could not fetch description:", error.message));
  }

  const siteToFetch =
    AuthorSite && AuthorSite.trim() !== "" ? AuthorSite : commonInfo.Link;

  // Fetch AuthorSiteDescription if AuthorSite exists
  if (AuthorSite && AuthorSite.trim() !== "") {
    try {
      authorSiteDescription =
        (await getDescription(AuthorSite)) ||
        entryData.AuthorSiteDescription ||
        "";
    } catch (error) {
      console.log(
        chalk.yellow("Could not fetch author site description:", error.message)
      );
      // Preserve existing value if fetch fails
      authorSiteDescription = entryData.AuthorSiteDescription || "";
    }
  }

  try {
    rssLink = (await getRSSLink(siteToFetch)) || "";
  } catch (error) {
    console.log(chalk.yellow("Could not fetch RSS link:", error.message));
  }

  try {
    socialLinks = (await getSocialLinks(siteToFetch)) || socialLinks;
  } catch (error) {
    console.log(chalk.yellow("Could not fetch social links:", error.message));
  }

  try {
    favicon = (await getFavicon(siteToFetch, "post")) || "";
  } catch (error) {
    console.log(chalk.yellow("Could not fetch favicon:", error.message));
  }

  // Prompt for enrichment data editing
  console.log(
    chalk.blue(
      "\nReview and edit enrichment data (press Enter to keep fetched value):"
    )
  );

  description = await input({
    message: "Post description:",
    default: description,
  });

  if (AuthorSite && AuthorSite.trim() !== "") {
    authorSiteDescription = await input({
      message: "Author site description:",
      default: authorSiteDescription,
    });
  }

  favicon = await input({
    message: "Favicon:",
    default: favicon,
  });

  rssLink = await input({
    message: "RSS link:",
    default: rssLink,
  });

  socialLinks.mastodon = await input({
    message: "Mastodon:",
    default: socialLinks.mastodon || "",
  });

  socialLinks.bluesky = await input({
    message: "Bluesky:",
    default: socialLinks.bluesky || "",
  });

  socialLinks.youtube = await input({
    message: "YouTube:",
    default: socialLinks.youtube || "",
  });

  socialLinks.github = await input({
    message: "GitHub:",
    default: socialLinks.github || "",
  });

  socialLinks.linkedin = await input({
    message: "LinkedIn:",
    default: socialLinks.linkedin || "",
  });

  entryData = {
    Issue: commonInfo.Issue,
    Type: "blog post",
    Title: commonInfo.Title,
    slugifiedTitle: slugify(commonInfo.Title),
    Link: commonInfo.Link,
    Date: Date,
    formattedDate: formatItemDate(Date),
    description: description || "",
    Author: Author,
    slugifiedAuthor: slugify(Author),
    ...(AuthorSite && AuthorSite.trim() !== "" ? { AuthorSite } : {}),
    ...(AuthorSite && AuthorSite.trim() !== ""
      ? { AuthorSiteDescription: authorSiteDescription }
      : {}),
    socialLinks: socialLinks || {
      mastodon: "",
      bluesky: "",
      youtube: "",
      github: "",
      linkedin: "",
    },
    favicon: favicon || "",
    rssLink: rssLink || "",
    Categories: Categories,
  };
  return;
};

// Function to EDIT site info
const editSite = async () => {
  const commonInfo = await promptCommonInfo("edit", entryData);
  const Date = await input({
    message: "Date:",
    default: entryData.Date,
    validate: validateDate,
  });

  // Fetch metadata
  console.log(chalk.blue("Fetching metadata..."));
  let description = "";
  let favicon = "";

  try {
    description = (await getDescription(commonInfo.Link)) || "";
  } catch (error) {
    console.log(chalk.yellow("Could not fetch description:", error.message));
  }

  try {
    favicon = (await getFavicon(commonInfo.Link, "site")) || "";
  } catch (error) {
    console.log(chalk.yellow("Could not fetch favicon:", error.message));
  }

  // Prompt for enrichment data editing
  console.log(
    chalk.blue(
      "\nReview and edit enrichment data (press Enter to keep fetched value):"
    )
  );

  description = await input({
    message: "Description:",
    default: description,
  });

  favicon = await input({
    message: "Favicon:",
    default: favicon,
  });

  // Load showcase data early to check if entry exists
  const showcaseData = loadShowcaseData();
  const existingIndex = findShowcaseEntry(showcaseData, commonInfo.Link);

  // If showcase entry exists, allow editing showcase-specific properties
  let showcaseScreenshotPath = null;
  let showcaseLeaderboardLink = null;

  if (existingIndex >= 0) {
    console.log(
      chalk.blue(
        "\nReview and edit showcase-specific data (press Enter to keep current value):"
      )
    );

    showcaseScreenshotPath = await input({
      message: "Screenshot path:",
      default: showcaseData[existingIndex].screenshotpath || "",
    });

    showcaseLeaderboardLink = await input({
      message: "Leaderboard link (optional):",
      default: showcaseData[existingIndex].leaderboardLink || "",
    });
  }

  // Handle screenshot capture/regeneration
  let screenshotpath = null;
  let leaderboardLink = null;
  let shouldUpdateShowcase = false;

  if (existingIndex >= 0) {
    // Entry exists in showcase
    // Use edited values from showcase-specific prompts
    screenshotpath = showcaseScreenshotPath;
    leaderboardLink = showcaseLeaderboardLink || null;

    // Prompt for screenshot regeneration
    const regeneratePrompt = await confirm({
      message: "Regenerate screenshot?",
      default: false,
    });

    if (regeneratePrompt) {
      console.log(chalk.blue("Capturing screenshot..."));

      // Generate filename
      const { filename } = await genScreenshotFilename(commonInfo.Link);

      // Capture screenshot
      const newScreenshotPath = await captureScreenshot(
        commonInfo.Link,
        filename
      );

      if (newScreenshotPath) {
        screenshotpath = newScreenshotPath;

        // Check for leaderboard link if screenshot succeeded
        console.log(chalk.blue("Checking for leaderboard link..."));
        const newLeaderboardLink = await hasLeaderboardLink(commonInfo.Link);
        if (newLeaderboardLink) {
          leaderboardLink = newLeaderboardLink;
          console.log(
            chalk.green(`  ✓ Leaderboard link found: ${leaderboardLink}`)
          );
        }
      }
    }
    shouldUpdateShowcase = true;
  } else {
    // Entry doesn't exist - prompt to capture screenshot
    const captureScreenshotPrompt = await confirm({
      message: "Capture screenshot and add to showcase?",
      default: true,
    });

    if (captureScreenshotPrompt) {
      console.log(chalk.blue("Capturing screenshot..."));

      // Generate filename
      const { filename } = await genScreenshotFilename(commonInfo.Link);

      // Capture screenshot
      screenshotpath = await captureScreenshot(commonInfo.Link, filename);

      // Check for leaderboard link if screenshot succeeded
      if (screenshotpath) {
        console.log(chalk.blue("Checking for leaderboard link..."));
        leaderboardLink = await hasLeaderboardLink(commonInfo.Link);
        if (leaderboardLink) {
          console.log(
            chalk.green(`  ✓ Leaderboard link found: ${leaderboardLink}`)
          );
        }
        shouldUpdateShowcase = true;
      }
    }
  }

  entryData = {
    Issue: commonInfo.Issue,
    Type: "site",
    Title: commonInfo.Title,
    description: description || "",
    Link: commonInfo.Link,
    Date: Date,
    formattedDate: formatItemDate(Date),
    favicon: favicon || "",
  };

  // Update showcase-data.json if needed
  if (shouldUpdateShowcase && screenshotpath) {
    try {
      console.log(chalk.blue("Updating showcase-data.json..."));

      // Backup showcase-data.json
      if (fs.existsSync(showcaseDataPath)) {
        makeBackupFile(showcaseDataPath);
      }

      // Transform and update/add entry
      const showcaseEntry = transformToShowcaseFormat(
        entryData,
        screenshotpath,
        leaderboardLink
      );

      if (existingIndex >= 0) {
        showcaseData[existingIndex] = showcaseEntry;
      } else {
        showcaseData.push(showcaseEntry);
      }

      // Save showcase data
      saveShowcaseData(showcaseData);
    } catch (error) {
      console.log(
        chalk.red(`  ✗ Error updating showcase-data.json: ${error.message}`)
      );
    }
  }

  return;
};

// Function to EDIT release info
const editRelease = async () => {
  const commonInfo = await promptCommonInfo("edit", entryData);
  const Date = await input({
    message: "Date:",
    default: getDefaultDate(),
    validate: validateDate,
  });
  // Fetch description
  let description = "";
  try {
    description = (await getDescription(commonInfo.Link)) || "";
  } catch (error) {
    console.log(chalk.yellow("Could not fetch description:", error.message));
  }

  // Prompt for enrichment data editing
  console.log(
    chalk.blue(
      "\nReview and edit enrichment data (press Enter to keep fetched value):"
    )
  );

  description = await input({
    message: "Description:",
    default: description,
  });

  entryData = {
    Issue: commonInfo.Issue,
    Type: "release",
    Title: commonInfo.Title,
    description: description,
    Link: commonInfo.Link,
    Date: Date,
    formattedDate: formatItemDate(Date),
  };
  return;
};

// Function to EDIT starter info
const editStarter = async () => {
  const commonInfo = await promptCommonInfo("edit", entryData);

  // Prompt for Demo URL
  const Demo = await input({
    message: "Demo URL (optional):",
    default: entryData.Demo || "",
    validate: async (input) => {
      if (!input || input.trim() === "") return true;
      const formatValidation = validateUrlFormat(input);
      if (formatValidation !== true) return formatValidation;
      return await validateUrlAccessibility(input);
    },
  });

  // Fetch metadata
  console.log(chalk.blue("Fetching metadata..."));
  let description = "";

  try {
    description = (await getGitHubDescription(commonInfo.Link)) || "";
    if (description) {
      console.log(chalk.green("  ✓ Description fetched from GitHub"));
    }
  } catch (error) {
    console.log(
      chalk.yellow("Could not fetch GitHub description:", error.message)
    );
  }

  // If GitHub fetch failed and Demo URL exists, try fetching from Demo site
  if (!description && Demo && Demo.trim() !== "") {
    try {
      description = (await getDescription(Demo)) || "";
      if (description) {
        console.log(chalk.green("  ✓ Description fetched from Demo site"));
      }
    } catch (error) {
      console.log(
        chalk.yellow("Could not fetch Demo site description:", error.message)
      );
    }
  }

  let screenshotpath = entryData.screenshotpath || null;

  // Prompt for screenshot capture if Demo URL exists
  if (Demo && Demo.trim() !== "") {
    // Check if screenshot already exists
    if (screenshotpath) {
      const regenerateScreenshot = await confirm({
        message: `Screenshot already exists (${screenshotpath}). Regenerate?`,
        default: false,
      });

      if (regenerateScreenshot) {
        console.log(chalk.blue("Capturing screenshot..."));
        const { filename } = await genScreenshotFilename(Demo);
        const newScreenshotPath = await captureScreenshot(Demo, filename);
        if (newScreenshotPath) {
          screenshotpath = newScreenshotPath;
        }
      }
    } else {
      const captureScreenshotPrompt = await confirm({
        message: "Capture screenshot?",
        default: true,
      });

      if (captureScreenshotPrompt) {
        console.log(chalk.blue("Capturing screenshot..."));
        const { filename } = await genScreenshotFilename(Demo);
        screenshotpath = await captureScreenshot(Demo, filename);
      }
    }
  }

  // Prompt for enrichment data editing
  console.log(
    chalk.blue(
      "\nReview and edit enrichment data (press Enter to keep fetched value):"
    )
  );

  description = await input({
    message: "Starter description:",
    default: description || entryData.description || "",
  });

  entryData = {
    Issue: commonInfo.Issue,
    Type: "starter",
    Title: commonInfo.Title,
    Link: commonInfo.Link,
  };

  // Add optional fields if they exist
  if (Demo && Demo.trim() !== "") {
    entryData.Demo = Demo;
  }
  if (description && description.trim() !== "") {
    entryData.description = description;
  }
  if (screenshotpath) {
    entryData.screenshotpath = screenshotpath;
  }

  return;
};

// Function to process user selected steps after entry
const afterEntry = async () => {
  const whatNext = await rawlist({
    message: "What's next?",
    choices: [
      { value: "save & exit" },
      { value: "save & add another" },
      { value: "edit entry" },
      { value: "save, push, & exit" },
      { value: "exit without saving" },
    ],
  });
  switch (whatNext) {
    case "save & exit":
      await appendToJsonFile(entryData);
      await genIssueRecords();
      return (nextAction = "exit");
    case "save & add another":
      await appendToJsonFile(entryData);
      nextAction = "add another";
      return;
    case "edit entry":
      nextAction = "ask what next";
      switch (entryData.Type) {
        case "blog post":
          await editPost();
          return;
        case "site":
          await editSite();
          return;
        case "release":
          await editRelease();
          return;
        case "starter":
          await editStarter();
          return;
        default:
          console.log("Invalid EDIT type");
          return;
      }
    case "save, push, & exit": // New case added here
      await appendToJsonFile(entryData);
      await genIssueRecords();
      await pushChanges();
      return (nextAction = "exit");
    case "exit without saving":
      console.log(chalk.yellow("Exiting without saving..."));
      return (nextAction = "exit");
    default:
      console.log("Invalid choice");
      return;
  }
};

// Function to validate if the entry data is a valid JSON object
const validateJsonObject = (data) => {
  try {
    const jsonString = JSON.stringify(data);
    JSON.parse(jsonString);
    return true;
  } catch (error) {
    console.log("Error parsing JSON:", error.message);
    return false;
  }
};

// Function to append the validated entry data to the JSON file
const appendToJsonFile = async (data) => {
  try {
    console.log("Appending to JSON file...", data);
    const fileData = fs.readFileSync(dbFilePath, "utf8");
    const jsonData = JSON.parse(fileData);
    jsonData.push(data);
    fs.writeFileSync(dbFilePath, JSON.stringify(jsonData, null, 2), "utf8");
    console.log(chalk.green("Entry successfully saved!"));
  } catch (error) {
    console.error(chalk.red("Error writing to the file:", error));
  }
};

// Function to push changes to the Git repository
const pushChanges = async () => {
  const execPromise = util.promisify(exec);

  try {
    // Change to the specified directory
    process.chdir(config.dbFileDir);

    // Perform Git operations
    await execPromise(`git add ${config.dbFilename}`);
    await execPromise(`git commit -m "Added to bundledb.json"`);
    await execPromise(`git push origin main`);

    console.log(chalk.green("Changes pushed to the repository successfully!"));
  } catch (error) {
    console.error(chalk.red("Error pushing changes to the repository:", error));
  }
};

// Main function to prompt for entry type and
// call the respective entry function
const main = async () => {
  // Load unique authors for autocomplete (once per session)
  if (uniqueAuthors.length === 0) {
    uniqueAuthors = getUniqueAuthors();
    console.log(
      chalk.cyan(
        `Loaded ${uniqueAuthors.length} unique authors for autocomplete`
      )
    );
  }

  const entryType = await rawlist({
    message: "Type of entry:",
    choices: [
      { value: "post" },
      { value: "site" },
      { value: "release" },
      { value: "starter" },
      { value: "Generate issue records" },
    ],
  });

  // Prompt for dataset selection (unless generating issue records)
  if (entryType !== "Generate issue records") {
    await selectDataset();
  }

  // make a backup of the file before creating new entries
  // make a single backup per entry/editing session
  if (!backedUp) {
    makeBackupFile(dbFilePath);
    const inputFilePath = dbFilePath;
    makeBackupFile(inputFilePath);
    backedUp = true;
  }

  switch (entryType) {
    case "post":
      await enterPost();
      break;
    case "site":
      await enterSite();
      break;
    case "release":
      await enterRelease();
      break;
    case "starter":
      await enterStarter();
      break;
    case "Generate issue records":
      await genIssueRecords();
      console.log(chalk.green("Issue records generated successfully!"));
      return;
    default:
      console.log("Invalid ENTRY type");
      return;
  }

  // Validate if the entry data is a valid JSON object
  if (validateJsonObject(entryData)) {
    console.log("Entry Data is a valid JSON object:", entryData);

    // Display showcase entry if this is a site and it exists
    if (entryData.Type === "site") {
      const showcaseData = loadShowcaseData();
      const showcaseIndex = findShowcaseEntry(showcaseData, entryData.Link);
      if (showcaseIndex >= 0) {
        displayShowcaseEntry(showcaseData[showcaseIndex]);
      }
    }
  } else {
    console.error(chalk.red("Entry Data is not a valid JSON object"));
  }

  while (nextAction !== "exit") {
    await afterEntry();
    switch (nextAction) {
      case "exit":
        break;
      case "add another":
        return main();
      case "ask what next":
        continue;
    }
  }
  const latestIssueNumber = getLatestIssueNumber();
  const itemCounts = countEntriesByIssue(latestIssueNumber);
  // Output the results
  console.log(chalk.blue(`Issue Number: ${itemCounts.issueNumber}`));
  console.log(chalk.green(`Blog Posts: ${itemCounts.blogPostCount}`));
  console.log(chalk.green(`Sites: ${itemCounts.siteCount}`));
  console.log(chalk.green(`Releases: ${itemCounts.releaseCount}`));
  console.log(chalk.green(`Starters: ${itemCounts.starterCount}`));

  // Close browser if it was initialized
  await closeBrowser();

  console.log("All done...bye!");
};

// Run the main function
main().catch(async (error) => {
  console.error(chalk.red("An error occurred:", error));
  await closeBrowser();
});
