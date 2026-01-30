import { rawlist } from "@inquirer/prompts";
import fs from "fs";
import chalk from "chalk";
import { getDescription } from "./getdescription.js";
import { makeBackupFile } from "./utils.js";

//***************
// Fetch Missing Descriptions
// This script processes bundledb.json and showcase-data.json to find
// and fill in empty string descriptions using the enhanced getDescription
// function that checks multiple sources.
//
// Only processes entries where the description property exists
// but is an empty string ("").
//***************

// Configuration paths based on mode
let config = {
  bundledbPath: "",
  bundledbBackupDir: "",
  showcaseDataPath: "",
  showcaseDataBackupDir: "",
};

// Helper to format timestamp for display
const formatTimestamp = () => {
  const now = new Date();
  return now.toISOString().replace("T", " ").slice(0, 19);
};

// Helper to get timestamp for filenames
const getTimestamp = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}--${hours}${minutes}${seconds}`;
};

// Process bundledb.json for empty string descriptions
const processBundleDb = async () => {
  console.log(chalk.blue("\n📚 Processing bundledb.json...\n"));

  // Read the database
  const data = fs.readFileSync(config.bundledbPath, "utf-8");
  const db = JSON.parse(data);
  console.log(`Total entries: ${db.length}`);

  // Create backup
  console.log(chalk.gray("Creating backup..."));
  await makeBackupFile(config.bundledbPath, config.bundledbBackupDir);
  console.log(chalk.green("✓ Backup created\n"));

  // Find blog posts with empty string description
  const blogPostsEmptyDesc = db.filter(
    (item) =>
      item.Type === "blog post" && !item.Skip && item.description === "",
  );

  // Find blog posts with empty string AuthorSiteDescription
  const blogPostsEmptyAuthorDesc = db.filter(
    (item) =>
      item.Type === "blog post" &&
      !item.Skip &&
      item.AuthorSiteDescription === "",
  );

  // Find sites with empty string description
  const sitesEmptyDesc = db.filter(
    (item) => item.Type === "site" && !item.Skip && item.description === "",
  );

  console.log(chalk.yellow("Empty string descriptions found:"));
  console.log(
    `  Blog posts (description):           ${blogPostsEmptyDesc.length}`,
  );
  console.log(
    `  Blog posts (AuthorSiteDescription): ${blogPostsEmptyAuthorDesc.length}`,
  );
  console.log(`  Sites (description):                ${sitesEmptyDesc.length}`);
  console.log();

  const results = {
    blogDescTotal: blogPostsEmptyDesc.length,
    blogDescSuccess: 0,
    blogAuthorDescTotal: blogPostsEmptyAuthorDesc.length,
    blogAuthorDescSuccess: 0,
    siteDescTotal: sitesEmptyDesc.length,
    siteDescSuccess: 0,
  };

  // Process blog posts with empty description
  if (blogPostsEmptyDesc.length > 0) {
    console.log(chalk.yellow("Processing blog post descriptions...\n"));

    for (let i = 0; i < blogPostsEmptyDesc.length; i++) {
      const item = blogPostsEmptyDesc[i];
      const progress = `[${i + 1}/${blogPostsEmptyDesc.length}]`;
      const link = item.Link;

      process.stdout.write(`${progress} ${item.Title.substring(0, 50)}... `);

      try {
        const description = await getDescription(link);
        if (description && description.trim() !== "") {
          item.description = description;
          results.blogDescSuccess++;
          console.log(chalk.green("✓"));
        } else {
          console.log(chalk.gray("○ not found"));
        }
      } catch (error) {
        console.log(chalk.red(`✗ ${error.message}`));
      }
    }
  }

  // Process blog posts with empty AuthorSiteDescription
  if (blogPostsEmptyAuthorDesc.length > 0) {
    console.log(
      chalk.yellow("\nProcessing blog post AuthorSiteDescriptions...\n"),
    );

    for (let i = 0; i < blogPostsEmptyAuthorDesc.length; i++) {
      const item = blogPostsEmptyAuthorDesc[i];
      const progress = `[${i + 1}/${blogPostsEmptyAuthorDesc.length}]`;
      const link = item.AuthorSite;

      if (!link) {
        console.log(`${progress} ${item.Author || "Unknown"} - no AuthorSite`);
        continue;
      }

      process.stdout.write(
        `${progress} ${(item.Author || "Unknown").substring(0, 30)}... `,
      );

      try {
        const description = await getDescription(link);
        if (description && description.trim() !== "") {
          item.AuthorSiteDescription = description;
          results.blogAuthorDescSuccess++;
          console.log(chalk.green("✓"));
        } else {
          console.log(chalk.gray("○ not found"));
        }
      } catch (error) {
        console.log(chalk.red(`✗ ${error.message}`));
      }
    }
  }

  // Process sites with empty description
  if (sitesEmptyDesc.length > 0) {
    console.log(chalk.yellow("\nProcessing site descriptions...\n"));

    for (let i = 0; i < sitesEmptyDesc.length; i++) {
      const item = sitesEmptyDesc[i];
      const progress = `[${i + 1}/${sitesEmptyDesc.length}]`;
      const link = item.Link;

      if (!link) {
        console.log(`${progress} ${item.Author || "Unknown"} - no link`);
        continue;
      }

      process.stdout.write(
        `${progress} ${(item.Author || item.Link).substring(0, 40)}... `,
      );

      try {
        const description = await getDescription(link);
        if (description && description.trim() !== "") {
          item.description = description;
          results.siteDescSuccess++;
          console.log(chalk.green("✓"));
        } else {
          console.log(chalk.gray("○ not found"));
        }
      } catch (error) {
        console.log(chalk.red(`✗ ${error.message}`));
      }
    }
  }

  // Write updated database
  fs.writeFileSync(config.bundledbPath, JSON.stringify(db, null, 2));
  console.log(chalk.green("\n✓ bundledb.json updated"));

  return results;
};

// Process showcase-data.json for empty string descriptions
const processShowcaseData = async () => {
  console.log(chalk.blue("\n🖼️  Processing showcase-data.json...\n"));

  // Read the database
  const data = fs.readFileSync(config.showcaseDataPath, "utf-8");
  const db = JSON.parse(data);
  console.log(`Total entries: ${db.length}`);

  // Create backup
  console.log(chalk.gray("Creating backup..."));
  await makeBackupFile(config.showcaseDataPath, config.showcaseDataBackupDir);
  console.log(chalk.green("✓ Backup created\n"));

  // Find showcase entries with empty string description
  const showcaseEmptyDesc = db.filter((item) => item.description === "");

  console.log(chalk.yellow("Empty string descriptions found:"));
  console.log(`  Showcase entries: ${showcaseEmptyDesc.length}`);
  console.log();

  const results = {
    showcaseDescTotal: showcaseEmptyDesc.length,
    showcaseDescSuccess: 0,
  };

  // Process showcase entries with empty description
  if (showcaseEmptyDesc.length > 0) {
    console.log(chalk.yellow("Processing showcase descriptions...\n"));

    for (let i = 0; i < showcaseEmptyDesc.length; i++) {
      const item = showcaseEmptyDesc[i];
      const progress = `[${i + 1}/${showcaseEmptyDesc.length}]`;
      const link = item.link;

      if (!link) {
        console.log(`${progress} ${item.title || "Unknown"} - no link`);
        continue;
      }

      process.stdout.write(
        `${progress} ${(item.title || item.link).substring(0, 40)}... `,
      );

      try {
        const description = await getDescription(link);
        if (description && description.trim() !== "") {
          item.description = description;
          results.showcaseDescSuccess++;
          console.log(chalk.green("✓"));
        } else {
          console.log(chalk.gray("○ not found"));
        }
      } catch (error) {
        console.log(chalk.red(`✗ ${error.message}`));
      }
    }
  }

  // Write updated database
  fs.writeFileSync(config.showcaseDataPath, JSON.stringify(db, null, 2));
  console.log(chalk.green("\n✓ showcase-data.json updated"));

  return results;
};

// Main function
const main = async () => {
  console.log(chalk.blue.bold("\n🔍 Fetch Missing Descriptions\n"));
  console.log(
    chalk.gray(
      "This script finds entries with empty string descriptions and attempts\n" +
        "to fetch them using multiple sources: meta description, og:description,\n" +
        "twitter:description, Dublin Core, and JSON-LD schema.org.\n",
    ),
  );

  // Prompt for test/production mode
  const mode = await rawlist({
    message: "Select which dataset to use:",
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

  // Handle exit
  if (mode === "exit") {
    console.log(chalk.yellow("\n👋 Exiting...\n"));
    process.exit(0);
  }

  // Set configuration based on mode
  if (mode === "development") {
    config = {
      bundledbPath:
        "/Users/Bob/Dropbox/Docs/Sites/11tybundle/dbtools/devdata/bundledb.json",
      bundledbBackupDir:
        "/Users/Bob/Dropbox/Docs/Sites/11tybundle/dbtools/devdata/bundledb-backups",
      showcaseDataPath:
        "/Users/Bob/Dropbox/Docs/Sites/11tybundle/dbtools/devdata/showcase-data.json",
      showcaseDataBackupDir:
        "/Users/Bob/Dropbox/Docs/Sites/11tybundle/dbtools/devdata/showcase-data-backups",
    };
  } else {
    config = {
      bundledbPath:
        "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb/bundledb.json",
      bundledbBackupDir:
        "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb/bundledb-backups",
      showcaseDataPath:
        "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb/showcase-data.json",
      showcaseDataBackupDir:
        "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb/showcase-data-backups",
    };
  }

  console.log(
    chalk.green(
      `\n✓ Using ${mode === "development" ? "Development" : "Production"} dataset`,
    ),
  );
  console.log(chalk.gray(`bundledb: ${config.bundledbPath}`));
  console.log(chalk.gray(`showcase: ${config.showcaseDataPath}`));

  console.log(chalk.gray(`\nStarted at: ${formatTimestamp()}\n`));

  // Process bundledb.json
  const bundleResults = await processBundleDb();

  // Process showcase-data.json
  const showcaseResults = await processShowcaseData();

  // Final summary
  console.log(
    chalk.blue.bold("\n═══════════════════════════════════════════════════"),
  );
  console.log(chalk.blue.bold("                      SUMMARY"));
  console.log(
    chalk.blue.bold("═══════════════════════════════════════════════════\n"),
  );

  console.log(chalk.yellow("Empty descriptions located:"));
  console.log(
    `  Blog posts (description):           ${bundleResults.blogDescTotal}`,
  );
  console.log(
    `  Blog posts (AuthorSiteDescription): ${bundleResults.blogAuthorDescTotal}`,
  );
  console.log(
    `  Sites (description):                ${bundleResults.siteDescTotal}`,
  );
  console.log(
    `  Showcase entries:                   ${showcaseResults.showcaseDescTotal}`,
  );

  const totalLocated =
    bundleResults.blogDescTotal +
    bundleResults.blogAuthorDescTotal +
    bundleResults.siteDescTotal +
    showcaseResults.showcaseDescTotal;
  console.log(
    `  ${chalk.bold(`Total:                                ${totalLocated}`)}`,
  );

  console.log(chalk.yellow("\nDescriptions successfully fetched:"));
  console.log(
    `  Blog posts (description):           ${bundleResults.blogDescSuccess}/${bundleResults.blogDescTotal}`,
  );
  console.log(
    `  Blog posts (AuthorSiteDescription): ${bundleResults.blogAuthorDescSuccess}/${bundleResults.blogAuthorDescTotal}`,
  );
  console.log(
    `  Sites (description):                ${bundleResults.siteDescSuccess}/${bundleResults.siteDescTotal}`,
  );
  console.log(
    `  Showcase entries:                   ${showcaseResults.showcaseDescSuccess}/${showcaseResults.showcaseDescTotal}`,
  );

  const totalSuccess =
    bundleResults.blogDescSuccess +
    bundleResults.blogAuthorDescSuccess +
    bundleResults.siteDescSuccess +
    showcaseResults.showcaseDescSuccess;
  console.log(
    chalk.green.bold(
      `\n  Total: ${totalSuccess}/${totalLocated} descriptions found and updated`,
    ),
  );
  console.log(chalk.gray(`\nCompleted at: ${formatTimestamp()}\n`));
};

// Run the script
main().catch((err) => {
  console.error(chalk.red("\n✗ Fatal error:"), err);
  process.exit(1);
});
