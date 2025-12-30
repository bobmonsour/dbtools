import { readFile, writeFile } from "fs/promises";
import { config } from "./config.js";

// Define the desired property order for each entry type
const propertyOrder = {
  "blog post": [
    "Issue",
    "Type",
    "Title",
    "slugifiedTitle",
    "Link",
    "Date",
    "formattedDate",
    "description",
    "Author",
    "slugifiedAuthor",
    "AuthorSite",
    "AuthorSiteDescription",
    "socialLinks",
    "favicon",
    "rssLink",
    "Categories",
  ],
  release: [
    "Issue",
    "Type",
    "Title",
    "description",
    "Link",
    "Date",
    "formattedDate",
  ],
  site: [
    "Issue",
    "Type",
    "Title",
    "description",
    "Link",
    "Date",
    "formattedDate",
    "favicon",
  ],
};

/**
 * Reorder properties of an object based on a defined order
 * @param {Object} obj - The object to reorder
 * @param {Array} order - The desired property order
 * @returns {Object} - New object with reordered properties
 */
function reorderProperties(obj, order) {
  const reordered = {};

  // First, add properties in the defined order (only if they exist)
  for (const prop of order) {
    if (prop in obj) {
      reordered[prop] = obj[prop];
    }
  }

  // Then, add any remaining properties that weren't in the defined order
  for (const prop in obj) {
    if (!(prop in reordered)) {
      reordered[prop] = obj[prop];
    }
  }

  return reordered;
}

/**
 * Create a timestamped backup of the database
 * @param {Array} data - The database array to backup
 */
async function createBackup(data) {
  const timestamp = new Date()
    .toISOString()
    .replace(/T/, "--")
    .replace(/\..+/, "")
    .replace(/:/g, "");
  const backupPath = `${config.dbBackupDir}/bundledb-${timestamp}.json`;

  try {
    await writeFile(backupPath, JSON.stringify(data, null, 2), "utf8");
    console.log(`✓ Backup created: ${backupPath}`);
  } catch (error) {
    console.error(`✗ Failed to create backup: ${error.message}`);
    throw error;
  }
}

/**
 * Main function to reorder properties in the bundle database
 */
async function reorderBundleDatabase() {
  console.log("Starting property reordering...\n");

  try {
    // Read the database file
    console.log(`Reading: ${config.dbFilePath}`);
    const fileContent = await readFile(config.dbFilePath, "utf8");
    const entries = JSON.parse(fileContent);

    console.log(`Found ${entries.length} entries\n`);

    // Create backup before modifying
    await createBackup(entries);

    // Track statistics
    const stats = {
      "blog post": 0,
      release: 0,
      site: 0,
      unknown: 0,
    };

    // Reorder properties for each entry
    const reorderedEntries = entries.map((entry) => {
      const entryType = entry.Type;

      if (entryType && propertyOrder[entryType]) {
        stats[entryType]++;
        return reorderProperties(entry, propertyOrder[entryType]);
      } else {
        stats.unknown++;
        console.warn(
          `Warning: Unknown type "${entryType}" for entry: ${
            entry.Title || "Untitled"
          }`
        );
        return entry; // Return unchanged if type is unknown
      }
    });

    // Write the reordered data back to the file
    await writeFile(
      config.dbFilePath,
      JSON.stringify(reorderedEntries, null, 2),
      "utf8"
    );

    // Report results
    console.log("\n✓ Property reordering complete!");
    console.log("\nStatistics:");
    console.log(`  Blog posts: ${stats["blog post"]}`);
    console.log(`  Releases: ${stats.release}`);
    console.log(`  Sites: ${stats.site}`);
    if (stats.unknown > 0) {
      console.log(`  Unknown types: ${stats.unknown}`);
    }
    console.log(`\nTotal entries processed: ${entries.length}`);
  } catch (error) {
    console.error(`\n✗ Error: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
reorderBundleDatabase();
