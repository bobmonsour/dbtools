import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get current directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// File paths
const failedUrlsPath = path.join(__dirname, "log/url-fetch-failures.txt");
const showcaseDataPath = path.join(__dirname, "devdata/showcase-data.json");

try {
  // Read the list of failed URLs
  const failedUrlsContent = readFileSync(failedUrlsPath, "utf-8");
  const failedUrls = failedUrlsContent
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  console.log(`Loaded ${failedUrls.length} failed URLs\n`);

  // Read the showcase data
  const showcaseDataContent = readFileSync(showcaseDataPath, "utf-8");
  const showcaseData = JSON.parse(showcaseDataContent);

  console.log(`Loaded ${showcaseData.length} showcase entries\n`);

  // Create a Set of showcase URLs for faster lookup
  const showcaseUrls = new Set(showcaseData.map((entry) => entry.link));

  // Check which failed URLs are in the showcase data
  const foundInShowcase = [];
  const notInShowcase = [];

  for (const failedUrl of failedUrls) {
    if (showcaseUrls.has(failedUrl)) {
      foundInShowcase.push(failedUrl);
    } else {
      notInShowcase.push(failedUrl);
    }
  }

  // Display results
  console.log("=".repeat(60));
  console.log("RESULTS");
  console.log("=".repeat(60));
  console.log(
    `\nFailed URLs FOUND in showcase-data.json: ${foundInShowcase.length}`
  );
  if (foundInShowcase.length > 0) {
    console.log(
      "\nThese URLs are in the showcase despite failing accessibility check:"
    );
    foundInShowcase.forEach((url, index) => {
      console.log(`  ${index + 1}. ${url}`);
    });
  }

  console.log(
    `\nFailed URLs NOT in showcase-data.json: ${notInShowcase.length}`
  );
  console.log("\n✓ Check complete");
} catch (error) {
  console.error("Error:", error.message);
  process.exit(1);
}
