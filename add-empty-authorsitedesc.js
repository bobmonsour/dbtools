#!/usr/bin/env node

import fs from "fs";
import { config } from "./config.js";
import { makeBackupFile } from "./utils.js";

console.log("\n=== Add Empty AuthorSiteDescription Property ===\n");

// Read the bundledb file
console.log(`Reading bundledb from: ${config.dbFilePath}\n`);
const data = fs.readFileSync(config.dbFilePath, "utf8");
const bundledb = JSON.parse(data);

console.log(`Total entries in database: ${bundledb.length}\n`);

// Find blog posts without AuthorSiteDescription property
const blogPostsWithoutProp = bundledb.filter(
  (entry) =>
    entry.Type === "blog post" && !entry.hasOwnProperty("AuthorSiteDescription")
);

console.log(
  `Blog posts without AuthorSiteDescription property: ${blogPostsWithoutProp.length}\n`
);

if (blogPostsWithoutProp.length === 0) {
  console.log(
    "✓ No blog posts found without AuthorSiteDescription property.\n"
  );
  process.exit(0);
}

// Display some examples
console.log("Examples of entries to be updated:");
blogPostsWithoutProp.slice(0, 5).forEach((entry, index) => {
  console.log(`  ${index + 1}. ${entry.Title}`);
  console.log(`     Link: ${entry.Link}`);
});
if (blogPostsWithoutProp.length > 5) {
  console.log(`     ... and ${blogPostsWithoutProp.length - 5} more\n`);
} else {
  console.log();
}

// Create backup
console.log("Creating backup...");
await makeBackupFile(config.dbFilePath);
console.log("✓ Backup created successfully\n");

// Add empty AuthorSiteDescription property to all blog posts that don't have it
// Place it immediately after AuthorSite property
let updatedCount = 0;
bundledb.forEach((entry) => {
  if (
    entry.Type === "blog post" &&
    !entry.hasOwnProperty("AuthorSiteDescription")
  ) {
    // Reconstruct the object with AuthorSiteDescription in the correct position
    const keys = Object.keys(entry);
    const authorSiteIndex = keys.indexOf("AuthorSite");

    if (authorSiteIndex !== -1) {
      // Create new object with properties in correct order
      const newEntry = {};
      keys.forEach((key, index) => {
        newEntry[key] = entry[key];
        // Insert AuthorSiteDescription right after AuthorSite
        if (index === authorSiteIndex) {
          newEntry.AuthorSiteDescription = "";
        }
      });

      // Replace all properties in the entry
      Object.keys(entry).forEach((key) => delete entry[key]);
      Object.assign(entry, newEntry);
    } else {
      // If no AuthorSite, just add at the end
      entry.AuthorSiteDescription = "";
    }

    updatedCount++;
  }
});

// Save updated bundledb
console.log("Saving updated bundledb...");
fs.writeFileSync(config.dbFilePath, JSON.stringify(bundledb, null, 2));
console.log(`✓ Successfully updated ${updatedCount} entries\n`);

console.log("Done!\n");
