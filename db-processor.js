import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Helper to get timestamp for backup filename
export const getTimestamp = () => {
  const now = new Date();
  return now
    .toISOString()
    .replace(/T/, "--")
    .replace(/:/g, "")
    .slice(0, 17)
    .replace(/--/, "--")
    .replace(/(\d{2})$/, "$1");
};

// Helper to format timestamp for display
export const formatTimestamp = () => {
  const now = new Date();
  return now.toISOString().replace("T", " ").slice(0, 19);
};

/**
 * Generic database entry processor
 *
 * @param {Object} options - Configuration options
 * @param {string} options.typeFilter - Type of entries to process ("blog post", "site", "release")
 * @param {string} options.propertyToAdd - Name of property to add to entries ("description", "rssLink", etc.)
 * @param {Function} options.fetchFunction - Async function that fetches the value (receives inputValue)
 * @param {string|Function} options.inputProperty - Property name to pass to fetchFunction (e.g., "Link", "AuthorSite"), or a function that receives the item and returns the input value
 * @param {string} options.outputFilename - Name for output file (e.g., "bundledb-with-descriptions.json")
 * @param {boolean} [options.skipExisting=true] - Skip items that already have the property
 * @param {string} [options.scriptName] - Name for logging (e.g., "Description Fetcher")
 */
export async function processDbEntries(options) {
  const {
    typeFilter,
    propertyToAdd,
    fetchFunction,
    inputProperty,
    outputFilename,
    skipExisting = true,
    scriptName = "Database Processor",
  } = options;

  const dbPath = path.join(__dirname, "devdata/bundledb.json");
  const backupDir = path.join(__dirname, "devdata/bundledb-backups");
  const outputPath = path.join(__dirname, "devdata", outputFilename);

  console.log(`\n=== ${scriptName} ===\n`);
  console.log(`Started at: ${formatTimestamp()}\n`);

  try {
    // Read bundledb.json
    console.log("Reading bundledb.json...");
    const data = await fs.readFile(dbPath, "utf-8");
    const db = JSON.parse(data);
    console.log(`Total entries in database: ${db.length}\n`);

    // Create timestamped backup
    const timestamp = getTimestamp();
    const backupPath = path.join(backupDir, `bundledb-${timestamp}.json`);
    await fs.mkdir(backupDir, { recursive: true });
    await fs.writeFile(backupPath, data);
    console.log(`Backup created: bundledb-${timestamp}.json\n`);

    // Filter items that need processing
    const itemsToProcess = db.filter((item) => {
      if (item.Skip) return false;
      if (item.Type !== typeFilter) return false;
      if (skipExisting && item[propertyToAdd]) return false;

      // Get input value using either property name or function
      const inputValue =
        typeof inputProperty === "function"
          ? inputProperty(item)
          : item[inputProperty];

      if (!inputValue) return false; // Skip if input value is missing
      return true;
    });

    console.log(
      `${typeFilter} entries without "${propertyToAdd}": ${itemsToProcess.length}`
    );

    if (itemsToProcess.length === 0) {
      console.log(
        `\nNo items to process. All ${typeFilter} entries already have "${propertyToAdd}".\n`
      );
      return { processed: 0, success: 0, skipped: 0 };
    }

    console.log(`Starting ${propertyToAdd} fetch...\n`);

    // Process each item
    let successCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < itemsToProcess.length; i++) {
      const item = itemsToProcess[i];
      const progress = `[${i + 1}/${itemsToProcess.length}]`;

      // Get input value using either property name or function
      const inputValue =
        typeof inputProperty === "function"
          ? inputProperty(item)
          : item[inputProperty];

      console.log(`${progress} Fetching: ${inputValue}`);

      try {
        const result = Array.isArray(inputValue)
          ? await fetchFunction(...inputValue)
          : await fetchFunction(inputValue);

        if (result) {
          item[propertyToAdd] = result;
          successCount++;
          const preview =
            typeof result === "string"
              ? result.length > 50
                ? result.substring(0, 50) + "..."
                : result
              : JSON.stringify(result).substring(0, 50);
          console.log(`${progress} ✓ Added ${propertyToAdd}: ${preview}\n`);
        } else {
          skippedCount++;
          console.log(`${progress} ○ No ${propertyToAdd} found\n`);
        }
      } catch (error) {
        skippedCount++;
        console.log(`${progress} ✗ Error: ${error.message}\n`);
      }
    }

    // Write updated database to output file
    console.log("Writing updated database...");
    await fs.writeFile(outputPath, JSON.stringify(db, null, 2));
    console.log(`Output saved to: ${outputFilename}\n`);

    // Summary
    console.log("=== Summary ===");
    console.log(`Processed: ${itemsToProcess.length} items`);
    console.log(`${propertyToAdd} added: ${successCount}`);
    console.log(`Skipped/failed: ${skippedCount}`);
    console.log(`\nCompleted at: ${formatTimestamp()}\n`);

    return {
      processed: itemsToProcess.length,
      success: successCount,
      skipped: skippedCount,
    };
  } catch (error) {
    console.error("\n❌ Fatal error:", error.message);
    throw error;
  }
}
