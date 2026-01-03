import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get current directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// File paths
const inputFilePath = path.join(__dirname, "log/url-fetch-failures.txt");
const outputFilePath = path.join(__dirname, "log/failure-retries.txt");

// Test URL accessibility
const testUrl = async (url) => {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    return {
      url,
      success: response.ok,
      status: response.status,
    };
  } catch (err) {
    return {
      url,
      success: false,
      error: err.message,
    };
  }
};

const main = async () => {
  try {
    // Read the input file
    const content = readFileSync(inputFilePath, "utf-8");
    const urls = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    console.log(`Testing ${urls.length} URLs...\n`);

    const stillFailing = [];
    const nowSucceeding = [];

    // Test each URL
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      console.log(`[${i + 1}/${urls.length}] Testing ${url}`);

      const result = await testUrl(url);

      if (result.success) {
        nowSucceeding.push(result);
        console.log(`  ✓ SUCCESS (${result.status})`);
      } else {
        stillFailing.push(result);
        const errorInfo = result.status
          ? `${result.status}`
          : result.error || "fetch failed";
        console.log(`  ✗ FAILED (${errorInfo})`);
      }
    }

    // Build output content
    let output = "";

    // Section 1: Still failing
    output += `STILL FAILING (${stillFailing.length} URLs)\n`;
    output += "=".repeat(60) + "\n\n";
    for (const result of stillFailing) {
      const errorInfo = result.status
        ? `${result.status}`
        : result.error || "fetch failed";
      output += `${result.url} - ${errorInfo}\n`;
    }

    output += "\n\n";

    // Section 2: Now succeeding
    output += `NOW SUCCEEDING (${nowSucceeding.length} URLs)\n`;
    output += "=".repeat(60) + "\n\n";
    for (const result of nowSucceeding) {
      output += `${result.url} - ${result.status}\n`;
    }

    // Write to output file
    writeFileSync(outputFilePath, output);

    console.log("\n" + "=".repeat(60));
    console.log(`SUMMARY`);
    console.log("=".repeat(60));
    console.log(`Total URLs tested: ${urls.length}`);
    console.log(`Still failing: ${stillFailing.length}`);
    console.log(`Now succeeding: ${nowSucceeding.length}`);
    console.log(`\n✓ Results written to: ${outputFilePath}`);
  } catch (error) {
    console.error("Error processing URLs:", error.message);
    process.exit(1);
  }
};

main();
