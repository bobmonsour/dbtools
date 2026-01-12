import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the 11tybundle.dev project
const BLOG_BASE_PATH =
  "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundle.dev/content/blog";
const OUTPUT_LOG = path.join(__dirname, "log", "remove-issue-prefix.log");

// Starting issue number (skip 1-4)
const START_ISSUE = 5;

/**
 * Extract issue number from filename
 */
function extractIssueNumber(filename) {
  const match = filename.match(/11ty-bundle-(\d+)\.md/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Remove "Issue {{ bundleIssue }} - " from the title in YAML front matter
 */
function removeTitlePrefix(content) {
  // Match the eleventyComputed title line and remove the prefix
  const regex =
    /(eleventyComputed:\s*\n\s+title:\s*["'])Issue\s+\{\{\s*bundleIssue\s*\}\}\s*-\s*/m;

  // Check if the prefix exists
  if (!regex.test(content)) {
    return { modified: false, content: content };
  }

  // Remove the prefix
  const newContent = content.replace(regex, "$1");

  return { modified: true, content: newContent };
}

/**
 * Extract the title from content for logging
 */
function extractTitle(content) {
  const regex = /eleventyComputed:\s*\n\s+title:\s*["'](.+?)["']/s;
  const match = content.match(regex);
  return match ? match[1] : null;
}

/**
 * Process all blog files
 */
function processAllFiles() {
  const years = [2023, 2024, 2025, 2026];
  const results = [];
  let totalModified = 0;

  console.log("=".repeat(70));
  console.log("REMOVING ISSUE PREFIX FROM BLOG TITLES");
  console.log("=".repeat(70));
  console.log(`Starting from Issue ${START_ISSUE}`);
  console.log();

  for (const year of years) {
    const yearPath = path.join(BLOG_BASE_PATH, year.toString());

    if (!fs.existsSync(yearPath)) {
      console.log(`Directory not found: ${yearPath}`);
      continue;
    }

    const files = fs.readdirSync(yearPath);
    const blogFiles = files
      .filter((file) => file.match(/^11ty-bundle-\d+\.md$/))
      .sort((a, b) => {
        const numA = extractIssueNumber(a);
        const numB = extractIssueNumber(b);
        return numA - numB;
      });

    console.log(`Processing ${year}...`);

    for (const filename of blogFiles) {
      const issueNumber = extractIssueNumber(filename);

      // Skip issues 1-4
      if (issueNumber < START_ISSUE) {
        console.log(
          `  Skipping Issue ${issueNumber} (below Issue ${START_ISSUE})`
        );
        continue;
      }

      const filePath = path.join(yearPath, filename);

      try {
        // Read the file
        const content = fs.readFileSync(filePath, "utf-8");
        const originalTitle = extractTitle(content);

        // Remove the prefix
        const { modified, content: newContent } = removeTitlePrefix(content);

        if (modified) {
          // Write the modified content back
          fs.writeFileSync(filePath, newContent, "utf-8");

          const newTitle = extractTitle(newContent);

          results.push({
            issueNumber,
            filename,
            filePath,
            originalTitle,
            newTitle,
            modified: true,
          });

          console.log(`  ✓ Modified Issue ${issueNumber}`);
          totalModified++;
        } else {
          results.push({
            issueNumber,
            filename,
            filePath,
            originalTitle,
            modified: false,
          });

          console.log(`  ⚠ Issue ${issueNumber}: No prefix found (skipped)`);
        }
      } catch (error) {
        console.log(
          `  ✗ Error processing Issue ${issueNumber}: ${error.message}`
        );
        results.push({
          issueNumber,
          filename,
          filePath,
          error: error.message,
        });
      }
    }

    console.log();
  }

  return { results, totalModified };
}

/**
 * Generate log report
 */
function generateReport(results, totalModified) {
  let report = "=".repeat(70) + "\n";
  report += "REMOVE ISSUE PREFIX FROM BLOG TITLES - REPORT\n";
  report += "=".repeat(70) + "\n\n";
  report += `Date: ${new Date().toISOString()}\n`;
  report += `Total Files Processed: ${results.length}\n`;
  report += `Total Files Modified: ${totalModified}\n`;
  report += `Starting Issue: ${START_ISSUE}\n\n`;

  // Modified files
  const modifiedFiles = results.filter((r) => r.modified);
  if (modifiedFiles.length > 0) {
    report += "=".repeat(70) + "\n";
    report += "MODIFIED FILES\n";
    report += "=".repeat(70) + "\n\n";

    for (const result of modifiedFiles) {
      report += `Issue ${result.issueNumber} (${result.filename})\n`;
      report += `File: ${result.filePath}\n\n`;
      report += `BEFORE:\n${result.originalTitle}\n\n`;
      report += `AFTER:\n${result.newTitle}\n\n`;
      report += "-".repeat(70) + "\n\n";
    }
  }

  // Skipped files (no prefix found)
  const skippedFiles = results.filter((r) => !r.modified && !r.error);
  if (skippedFiles.length > 0) {
    report += "=".repeat(70) + "\n";
    report += "SKIPPED FILES (NO PREFIX FOUND)\n";
    report += "=".repeat(70) + "\n\n";

    for (const result of skippedFiles) {
      report += `Issue ${result.issueNumber} (${result.filename})\n`;
      report += `Title: ${result.originalTitle}\n\n`;
    }
  }

  // Errors
  const errorFiles = results.filter((r) => r.error);
  if (errorFiles.length > 0) {
    report += "=".repeat(70) + "\n";
    report += "ERRORS\n";
    report += "=".repeat(70) + "\n\n";

    for (const result of errorFiles) {
      report += `Issue ${result.issueNumber} (${result.filename})\n`;
      report += `Error: ${result.error}\n\n`;
    }
  }

  return report;
}

/**
 * Main execution
 */
async function main() {
  console.log("\nREMOVE ISSUE PREFIX FROM BLOG TITLES\n");

  // Process all files
  const { results, totalModified } = processAllFiles();

  // Generate report
  const report = generateReport(results, totalModified);

  // Ensure log directory exists
  const logDir = path.dirname(OUTPUT_LOG);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // Write to log file
  fs.writeFileSync(OUTPUT_LOG, report, "utf-8");

  console.log("=".repeat(70));
  console.log("✓ Process complete!");
  console.log(`Modified: ${totalModified} files`);
  console.log(`Report written to: ${OUTPUT_LOG}`);
  console.log("=".repeat(70));
}

main();
