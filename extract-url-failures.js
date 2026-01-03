import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get current directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// File paths
const logFilePath = path.join(__dirname, "log/showcase-data-errors.log");
const outputFilePath = path.join(__dirname, "log/url-fetch-failures.txt");

try {
  // Read the log file
  const logContent = readFileSync(logFilePath, "utf-8");

  // Split into lines
  const lines = logContent.split("\n");

  // Extract URLs with "URL not accessible (fetch failed)"
  const urlSet = new Set();
  const pattern = /URL not accessible \(fetch failed\): (.+)$/;

  for (const line of lines) {
    if (line.includes("URL not accessible (fetch failed)")) {
      const match = line.match(pattern);
      if (match && match[1]) {
        urlSet.add(match[1]);
      }
    }
  }

  // Convert Set to sorted array
  const urls = Array.from(urlSet).sort();

  // Write to output file
  const output = urls.join("\n") + "\n";
  writeFileSync(outputFilePath, output);

  console.log(`✓ Extracted ${urls.length} unique URLs with fetch failures`);
  console.log(`✓ Results written to: ${outputFilePath}`);
} catch (error) {
  console.error("Error processing log file:", error.message);
  process.exit(1);
}
