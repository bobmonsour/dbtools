#!/usr/bin/env node

// Test script to retry Campus Spark screenshot

import { promises as fs } from "fs";
import puppeteer from "puppeteer";
import { genScreenshotFilename } from "./genscreenshotfilename.js";
import { fetchTimeout } from "./cacheconfig.js";
import { config } from "./config.js";
import path from "path";
import { fileURLToPath } from "url";
import fsSync from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotDir = path.join(__dirname, "../screenshots");
const productionScreenshotDir = path.join(
  __dirname,
  "../../11tybundle.dev/content/screenshots"
);
const dbFilePath = config.dbFilePath;

const campusSparkDemo = "https://endless-iris.cloudvent.net/";

console.log(`\nRetrying screenshot capture for Campus Spark`);
console.log(`Demo URL: ${campusSparkDemo}\n`);

try {
  const { filename } = await genScreenshotFilename(campusSparkDemo);
  console.log(`Filename: ${filename}`);

  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.setViewport({ width: 1920, height: 1080 });
  console.log("Navigating to URL...");

  await page.goto(campusSparkDemo, {
    waitUntil: "networkidle2",
    timeout: 60000, // Increased to 60 seconds
  });

  await new Promise(
    (resolve) => setTimeout(resolve, 5000) // Increased delay to 5 seconds
  );

  const localPath = path.join(screenshotDir, filename);
  const prodPath = path.join(productionScreenshotDir, filename);

  if (!fsSync.existsSync(screenshotDir)) {
    fsSync.mkdirSync(screenshotDir, { recursive: true });
  }
  if (!fsSync.existsSync(productionScreenshotDir)) {
    fsSync.mkdirSync(productionScreenshotDir, { recursive: true });
  }

  console.log("Capturing screenshot...");
  await page.screenshot({
    path: localPath,
    type: "jpeg",
    quality: 100,
  });

  // Copy to production location
  fsSync.copyFileSync(localPath, prodPath);

  await browser.close();

  console.log(`✓ Screenshot saved to: ${localPath}`);
  console.log(`✓ Copied to production: ${prodPath}`);

  // Update database entry
  console.log("\nUpdating database...");
  const data = await fs.readFile(dbFilePath, "utf-8");
  const entries = JSON.parse(data);

  const campusSpark = entries.find(
    (entry) => entry.Title === "Campus Spark" && entry.Type === "starter"
  );

  if (campusSpark) {
    campusSpark.screenshotpath = `/screenshots/${filename}`;
    await fs.writeFile(dbFilePath, JSON.stringify(entries, null, 2));
    console.log(
      `✓ Database updated with screenshotpath: /screenshots/${filename}`
    );
  } else {
    console.log("⚠️  Campus Spark entry not found in database");
  }
} catch (error) {
  console.error("❌ Error:", error.message);
}
