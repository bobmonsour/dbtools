// Test script to check Campus Spark GitHub description
import { getGitHubDescription } from "./getgithubdescription.js";

const url = "https://github.com/CloudCannon/campus-spark-bookshop-template";

console.log(`Testing GitHub description fetch for: ${url}\n`);

try {
  const description = await getGitHubDescription(url);
  if (description) {
    console.log("✅ Description found:");
    console.log(description);
  } else {
    console.log("❌ No description found (returned empty string)");
  }
} catch (error) {
  console.error("❌ Error:", error.message);
}

// Check if failure cache was created
import { promises as fs } from "fs";
try {
  const cache = await fs.readFile(
    "./log/github-description-failures.json",
    "utf-8"
  );
  console.log("\n📋 Failure cache contents:");
  console.log(cache);
} catch {
  console.log("\n⚠️  No failure cache file found");
}
