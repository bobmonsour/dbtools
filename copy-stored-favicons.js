import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse command-line arguments
const args = process.argv.slice(2);

// Show help and exit
if (args.includes("-h") || args.includes("--help")) {
  console.log(`
Copy Stored Favicons
====================

Copies processed favicon files from the storage directory to the project's
public assets directory.

USAGE:
  node copy-stored-favicons.js [OPTIONS]

OPTIONS:
  -h, --help     Show this help message
  -f, --force    Force overwrite existing files (default: skip existing)

DESCRIPTION:
  By default, this script skips files that already exist in the destination
  directory, making repeated runs fast. Use --force to overwrite all files.

SOURCE:      favicons/
DESTINATION: /Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundle.dev/_site/img/favicons/

EXAMPLES:
  node copy-stored-favicons.js           # Copy only new files
  node copy-stored-favicons.js --force   # Overwrite all files
`);
  process.exit(0);
}

const forceOverwrite = args.includes("--force") || args.includes("-f");

// Source and destination directories
const sourceDir = path.join(__dirname, "favicons");
const destDir =
  "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundle.dev/_site/img/favicons";

async function copyFavicons() {
  try {
    // Check if source directory exists
    try {
      await fs.access(sourceDir);
    } catch {
      console.error(`Source directory does not exist: ${sourceDir}`);
      return;
    }

    // Create destination directory if it doesn't exist
    await fs.mkdir(destDir, { recursive: true });

    // Read all files from source directory
    const files = await fs.readdir(sourceDir);

    if (files.length === 0) {
      console.log("No favicon files found in storage directory.");
      return;
    }

    console.log(`Copying ${files.length} favicon(s)...`);
    console.log(
      `Mode: ${forceOverwrite ? "FORCE OVERWRITE" : "Skip existing files"}`
    );

    let copied = 0;
    let skipped = 0;

    // Copy each file
    for (const file of files) {
      const sourcePath = path.join(sourceDir, file);
      const destPath = path.join(destDir, file);

      try {
        // Check if it's a file (not a directory)
        const stats = await fs.stat(sourcePath);
        if (stats.isFile()) {
          // Check if destination file exists (unless force overwrite is enabled)
          if (!forceOverwrite) {
            try {
              await fs.access(destPath);
              // File exists, skip it
              skipped++;
              console.log(`  ⊘ ${file} (already exists)`);
              continue;
            } catch {
              // File doesn't exist, proceed with copy
            }
          }

          await fs.copyFile(sourcePath, destPath);
          copied++;
          console.log(`  ✓ ${file}`);
        } else {
          skipped++;
        }
      } catch (error) {
        console.error(`  ✗ Failed to copy ${file}: ${error.message}`);
        skipped++;
      }
    }

    console.log(`\nCompleted: ${copied} copied, ${skipped} skipped`);
    console.log(`Destination: ${destDir}`);
  } catch (error) {
    console.error(`Error copying favicons: ${error.message}`);
  }
}

// Run the copy operation
copyFavicons();
