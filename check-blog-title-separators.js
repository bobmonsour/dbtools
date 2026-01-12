import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the 11tybundle.dev project
const BLOG_BASE_PATH =
  "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundle.dev/content/blog";
const OUTPUT_LOG = path.join(__dirname, "log", "blog-title-separators.log");

/**
 * Extract YAML front matter from markdown file
 */
function extractFrontMatter(fileContent) {
  const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---/;
  const match = fileContent.match(frontMatterRegex);

  if (!match) {
    return null;
  }

  return match[1];
}

/**
 * Extract eleventyComputed.title from YAML front matter
 */
function extractTitle(frontMatter) {
  // Match eleventyComputed: followed by title:
  const titleRegex = /eleventyComputed:\s*\n\s+title:\s*["'](.+?)["']/s;
  const match = frontMatter.match(titleRegex);

  if (!match) {
    return null;
  }

  return match[1];
}

/**
 * Extract issue number from filename (e.g., "11ty-bundle-75.md" -> 75)
 */
function extractIssueNumber(filename) {
  const match = filename.match(/11ty-bundle-(\d+)\.md/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Analyze what separators are used in the title
 * Returns an object with separator information
 */
function analyzeSeparators(title) {
  // Remove the "Issue X - " prefix to focus on the article titles
  const titleWithoutPrefix = title.replace(
    /^Issue\s+\{\{\s*bundleIssue\s*\}\}\s*-\s*/,
    ""
  );

  const separators = {
    comma: (titleWithoutPrefix.match(/,/g) || []).length,
    semicolon: (titleWithoutPrefix.match(/;/g) || []).length,
    pipe: (titleWithoutPrefix.match(/\|/g) || []).length,
    bullet: (titleWithoutPrefix.match(/•/g) || []).length,
    dash: (titleWithoutPrefix.match(/\s+[-–—]\s+/g) || []).length, // Spaced dashes
    questionMark: (titleWithoutPrefix.match(/\?/g) || []).length,
    exclamation: (titleWithoutPrefix.match(/!/g) || []).length,
    period: (titleWithoutPrefix.match(/\.\s+[A-Z]/g) || []).length, // Period followed by capital letter
  };

  // Determine primary separator (the one with highest count)
  let primarySeparator = "none";
  let maxCount = 0;

  for (const [sep, count] of Object.entries(separators)) {
    if (count > maxCount) {
      maxCount = count;
      primarySeparator = sep;
    }
  }

  // Check if multiple separators are being used (mixed punctuation)
  const nonZeroSeparators = Object.entries(separators)
    .filter(([_, count]) => count > 0)
    .map(([sep, _]) => sep);

  const isMixed = nonZeroSeparators.length > 1;

  return {
    separators,
    primary: primarySeparator,
    hasCommas: separators.comma > 0,
    isMixed,
    separatorTypes: nonZeroSeparators,
  };
}

/**
 * Process all blog files in a given year directory
 */
function processBlogYear(year) {
  const yearPath = path.join(BLOG_BASE_PATH, year.toString());
  const results = [];

  // Check if directory exists
  if (!fs.existsSync(yearPath)) {
    console.log(`Directory not found: ${yearPath}`);
    return results;
  }

  const files = fs.readdirSync(yearPath);
  const blogFiles = files.filter((file) => file.match(/^11ty-bundle-\d+\.md$/));

  console.log(`Processing ${blogFiles.length} files from ${year}...`);

  for (const filename of blogFiles) {
    const filePath = path.join(yearPath, filename);
    const issueNumber = extractIssueNumber(filename);

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const frontMatter = extractFrontMatter(content);

      if (!frontMatter) {
        results.push({
          issueNumber,
          filename,
          error: "No front matter found",
        });
        continue;
      }

      const title = extractTitle(frontMatter);

      if (!title) {
        results.push({
          issueNumber,
          filename,
          error: "No title found in front matter",
        });
        continue;
      }

      const separatorAnalysis = analyzeSeparators(title);

      results.push({
        issueNumber,
        filename,
        title,
        ...separatorAnalysis,
      });
    } catch (error) {
      results.push({
        issueNumber,
        filename,
        error: error.message,
      });
    }
  }

  return results;
}

/**
 * Generate log report
 */
function generateReport(results2025, results2026) {
  const allResults = [...results2025, ...results2026].sort(
    (a, b) => a.issueNumber - b.issueNumber
  );

  let report = "=".repeat(70) + "\n";
  report += "BLOG TITLE SEPARATOR ANALYSIS\n";
  report += "=".repeat(70) + "\n\n";
  report += `Analysis Date: ${new Date().toISOString()}\n`;
  report += `Total Files Analyzed: ${allResults.length}\n\n`;

  // Separate results by separator type
  const usingCommas = [];
  const nonComma = [];
  const errors = [];

  for (const result of allResults) {
    if (result.error) {
      errors.push(result);
    } else if (result.primary === "comma") {
      usingCommas.push(result);
    } else {
      nonComma.push(result);
    }
  }

  // Report on comma usage
  report += "=".repeat(70) + "\n";
  report += "FILES USING COMMAS AS PRIMARY SEPARATOR\n";
  report += "=".repeat(70) + "\n\n";
  report += `Count: ${usingCommas.length}\n`;
  report += `Issues: ${usingCommas.map((r) => r.issueNumber).join(", ")}\n\n`;

  // Report on non-comma separators
  report += "=".repeat(70) + "\n";
  report += "FILES USING NON-COMMA SEPARATORS\n";
  report += "=".repeat(70) + "\n\n";

  if (nonComma.length === 0) {
    report += "None found. All files use commas as separators.\n\n";
  } else {
    report += `Count: ${nonComma.length}\n\n`;

    for (const result of nonComma) {
      report += `Issue ${result.issueNumber} (${result.filename}):\n`;
      report += `  Primary Separator: ${result.primary}\n`;
      if (result.isMixed) {
        report += `  Mixed Separators: ${result.separatorTypes.join(", ")}\n`;
      }
      report += `  Separator Counts:\n`;
      for (const [sep, count] of Object.entries(result.separators)) {
        if (count > 0) {
          report += `    - ${sep}: ${count}\n`;
        }
      }
      report += `  Full Title: ${result.title}\n\n`;
    }
  }

  // Report errors
  if (errors.length > 0) {
    report += "=".repeat(70) + "\n";
    report += "ERRORS\n";
    report += "=".repeat(70) + "\n\n";

    for (const result of errors) {
      report += `Issue ${result.issueNumber} (${result.filename}): ${result.error}\n`;
    }
    report += "\n";
  }

  // Detailed listing
  report += "=".repeat(70) + "\n";
  report += "DETAILED LISTING OF ALL FILES\n";
  report += "=".repeat(70) + "\n\n";

  for (const result of allResults) {
    if (result.error) {
      report += `Issue ${result.issueNumber}: ERROR - ${result.error}\n`;
    } else {
      const separatorCounts = Object.entries(result.separators)
        .filter(([_, count]) => count > 0)
        .map(([sep, count]) => `${sep}:${count}`)
        .join(", ");

      report += `Issue ${result.issueNumber}: ${result.primary} (${separatorCounts})\n`;
    }
  }

  return report;
}

/**
 * Main execution
 */
async function main() {
  console.log("Starting blog title separator analysis...\n");

  // Process 2025 and 2026
  const results2025 = processBlogYear(2025);
  const results2026 = processBlogYear(2026);

  // Generate report
  const report = generateReport(results2025, results2026);

  // Ensure log directory exists
  const logDir = path.dirname(OUTPUT_LOG);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // Write to log file
  fs.writeFileSync(OUTPUT_LOG, report, "utf-8");

  console.log("\n✓ Analysis complete!");
  console.log(`Report written to: ${OUTPUT_LOG}`);
  console.log("\nSummary:");
  console.log(`  2025 files: ${results2025.length}`);
  console.log(`  2026 files: ${results2026.length}`);
  console.log(`  Total: ${results2025.length + results2026.length}`);
}

main();
