// Import 3rd party modules
import puppeteer from "puppeteer";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { appendFileSync, existsSync } from "fs";

// Get our bearings for this module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const targetFolder = join(__dirname, "../src/img/screenshots/");

// Import project constants and modules
import { siteList, siteCount, fetchTimeout } from ".config.js";
import { genScreenshotFilename } from "./genscreenshotfilename.js";

// Set dimensions for screenshots
const imageWidth = 1920;
const imageHeight = 1080;

const getScreenshot = async (link) => {
  // Extract domain from URL and create filename
  // console.log("Generating screenshot for site: ", link);
  const { domain, filename, url } = await genScreenshotFilename(link);
  const imageFilePath = `${targetFolder}${filename}`;

  // Check if screenshot file already exists
  if (existsSync(imageFilePath)) {
    console.log(`Using existing screenshot for ${domain}`);
    return filename;
  }

  // Generate new screenshot
  console.log("Capturing screenshot for site: ", link);
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Set the viewport's width and height, aspect ratio 16:9
  await page.setViewport({ width: imageWidth, height: imageHeight });

  try {
    // Open the site URL
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: fetchTimeout.screenshot,
    });

    // Capture screenshot and save it in the site's screenshots folder
    await page.screenshot({
      path: `${targetFolder}${filename}`,
      type: "jpeg",
      quality: 100,
    });
  } catch (err) {
    const timestamp = new Date().toISOString();
    const errorMessage = `[${timestamp}] getScreenshot: Error accessing ${link}: ${err.message}\n`;
    console.log(errorMessage.trim());
    appendFileSync("./log/screenshot-site-errors.txt", errorMessage);
    return ""; // Return empty filename on error
  } finally {
    await browser.close();
  }
  return filename;
};

const genscreenshots = async () => {
  console.log(`Generating screenshots for ${siteCount} sites...`);

  for (const site of siteList) {
    await getScreenshot(site.Link);
    // console.log(`Generated screenshot for ${site.Link}: `);
  }
  console.log("Screenshot generation complete.");
};

genscreenshots();
