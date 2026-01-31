import fs from "fs";
import path from "path";
import chalk from "chalk";
import { rawlist } from "@inquirer/prompts";
import { fileURLToPath } from "url";

//***************
// Remove Test Data
// Removes all entries from bundledb.json (and matching showcase-data.json
// entries) where the Title contains the case-sensitive string "bobDemo".
//***************

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDENT = "  ";

// Formatting helpers (consistent with other scripts)
const separator = () => console.log(chalk.dim("---"));
const blankLine = () => console.log();
const sectionHeader = (text) => {
  console.log(chalk.bold.yellow(`${INDENT}${text}`));
};
const successMessage = (text) => {
  console.log(chalk.green(`${INDENT}${text}`));
};
const errorMessage = (text) => {
  console.log(chalk.bold.red(`${INDENT}${text}`));
};
const statusMessage = (text) => console.log(chalk.cyan(`${INDENT}${text}`));

// Dataset paths
const datasets = {
  production: {
    dbFilePath:
      "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb/bundledb.json",
    showcaseDataPath:
      "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb/showcase-data.json",
  },
  development: {
    dbFilePath: path.join(__dirname, "devdata", "bundledb.json"),
    showcaseDataPath: path.join(__dirname, "devdata", "showcase-data.json"),
  },
};

async function removeTestData() {
  blankLine();
  sectionHeader("Remove Test Data (bobDemo entries)");
  blankLine();

  // Prompt for dataset selection
  const datasetChoice = await rawlist({
    message: "Select which dataset to clean:",
    choices: [
      { name: "Production dataset (11tybundledb)", value: "production" },
      {
        name: "Development dataset (devdata in this project)",
        value: "development",
      },
      { name: chalk.dim("Exit"), value: "exit" },
    ],
    default: "production",
  });

  if (datasetChoice === "exit") {
    console.log(chalk.yellow("\nExiting...\n"));
    return;
  }

  const { dbFilePath, showcaseDataPath } = datasets[datasetChoice];

  statusMessage(
    `Using ${datasetChoice} dataset`,
  );
  blankLine();

  // Read bundledb.json
  let bundleData;
  try {
    bundleData = JSON.parse(fs.readFileSync(dbFilePath, "utf8"));
  } catch (err) {
    errorMessage(`Failed to read bundledb.json: ${err.message}`);
    return;
  }

  if (!Array.isArray(bundleData)) {
    errorMessage("bundledb.json is not an array");
    return;
  }

  // Find and remove bobDemo entries
  const removedEntries = bundleData.filter(
    (entry) => entry.Title && entry.Title.includes("bobDemo"),
  );
  const cleanedData = bundleData.filter(
    (entry) => !entry.Title || !entry.Title.includes("bobDemo"),
  );

  if (removedEntries.length === 0) {
    statusMessage("No bobDemo entries found in bundledb.json. Nothing to do.");
    blankLine();
    return;
  }

  // Count removed entries by type
  const counts = { "blog post": 0, site: 0, release: 0, starter: 0 };
  const removedSiteLinks = new Set();
  for (const entry of removedEntries) {
    const type = entry.Type ? entry.Type.toLowerCase() : null;
    if (type && counts.hasOwnProperty(type)) {
      counts[type]++;
    }
    if (type === "site" && entry.Link) {
      removedSiteLinks.add(entry.Link);
    }
  }

  // Write cleaned bundledb.json
  fs.writeFileSync(dbFilePath, JSON.stringify(cleanedData, null, 2), "utf8");
  successMessage(`Wrote updated bundledb.json (${cleanedData.length} entries)`);

  // Clean showcase-data.json if any site entries were removed
  let showcaseRemoved = 0;
  if (removedSiteLinks.size > 0) {
    try {
      let showcaseData = JSON.parse(
        fs.readFileSync(showcaseDataPath, "utf8"),
      );
      if (Array.isArray(showcaseData)) {
        const before = showcaseData.length;
        showcaseData = showcaseData.filter(
          (entry) => !removedSiteLinks.has(entry.link),
        );
        showcaseRemoved = before - showcaseData.length;
        if (showcaseRemoved > 0) {
          fs.writeFileSync(
            showcaseDataPath,
            JSON.stringify(showcaseData, null, 2),
            "utf8",
          );
          successMessage(
            `Wrote updated showcase-data.json (${showcaseData.length} entries)`,
          );
        }
      }
    } catch (err) {
      errorMessage(`Failed to process showcase-data.json: ${err.message}`);
    }
  }

  // Summary
  blankLine();
  separator();
  sectionHeader("Removal Summary");
  blankLine();
  if (counts["blog post"] > 0) {
    statusMessage(`Blog posts removed: ${counts["blog post"]}`);
  }
  if (counts.site > 0) {
    statusMessage(`Sites removed: ${counts.site}`);
  }
  if (counts.release > 0) {
    statusMessage(`Releases removed: ${counts.release}`);
  }
  if (counts.starter > 0) {
    statusMessage(`Starters removed: ${counts.starter}`);
  }
  statusMessage(`Total bundledb entries removed: ${removedEntries.length}`);
  if (showcaseRemoved > 0) {
    statusMessage(`Showcase entries removed: ${showcaseRemoved}`);
  }
  separator();
  blankLine();
}

removeTestData();
