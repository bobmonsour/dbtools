#!/usr/bin/env node

// Test script to capture screenshot for one starter entry

import puppeteer from "puppeteer";
import { genScreenshotFilename } from "./genscreenshotfilename.js";
import { fetchTimeout } from "./cacheconfig.js";
import path from "path";
import { fileURLToPath } from "url";
import fsSync from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotDir = path.join(__dirname, "screenshots");
const testUrl = "https://eleventeen.blog/";

console.log(`Testing screenshot capture for: ${testUrl}\n`);

try {
  const { filename } = await genScreenshotFilename(testUrl);
  console.log(`Generated filename: ${filename}`);

  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.setViewport({ width: 1920, height: 1080 });
  console.log("Navigating to URL...");

  await page.goto(testUrl, {
    waitUntil: "networkidle0",
    timeout: fetchTimeout.singleScreenshot,
  });

  await new Promise((resolve) =>
    setTimeout(resolve, fetchTimeout.screenshotDelay)
  );

  const localPath = path.join(screenshotDir, filename);

  if (!fsSync.existsSync(screenshotDir)) {
    fsSync.mkdirSync(screenshotDir, { recursive: true });
  }

  console.log("Capturing screenshot...");
  await page.screenshot({
    path: localPath,
    type: "jpeg",
    quality: 100,
  });

  await browser.close();

  console.log(`✓ Screenshot saved to: ${localPath}`);
} catch (error) {
  console.error("❌ Error:", error.message);
}
