import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { blogTitleToList } from "./blog-title-filter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the 11tybundle.dev project
const BLOG_BASE_PATH =
  "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundle.dev/content/blog";
const OUTPUT_LOG = path.join(__dirname, "log", "blog-title-filter-test.log");

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
  // Try double quotes first (most common case)
  const doubleQuoteRegex = /eleventyComputed:\s*\n\s+title:\s*"(.+?)"/s;
  const doubleMatch = frontMatter.match(doubleQuoteRegex);

  if (doubleMatch) {
    return doubleMatch[1];
  }

  // Try single quotes
  const singleQuoteRegex = /eleventyComputed:\s*\n\s+title:\s*'(.+?)'/s;
  const singleMatch = frontMatter.match(singleQuoteRegex);

  if (singleMatch) {
    return singleMatch[1];
  }

  return null;
}

/**
 * Extract issue number from filename
 */
function extractIssueNumber(filename) {
  const match = filename.match(/11ty-bundle-(\d+)\.md/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Test the filter with sample titles
 */
function runTests() {
  console.log("=".repeat(70));
  console.log("TESTING BLOG TITLE FILTER");
  console.log("=".repeat(70));
  console.log();

  const testCases = [
    {
      name: "Title with commas only",
      input:
        "Issue {{ bundleIssue }} - First Article, Second Article, Third Article",
      expected: "3 items",
    },
    {
      name: "Title with actual issue number (rendered)",
      input: "Issue 82 - First Article, Second Article, Third Article",
      expected: "3 items (with rendered issue number)",
    },
    {
      name: "Title with commas and question mark",
      input:
        "Issue {{ bundleIssue }} - First Article, Got questions? Second Article",
      expected: "3 items (split on comma and question mark)",
    },
    {
      name: "Title with trailing ellipsis",
      input: "Issue {{ bundleIssue }} - First Article, Second Article...",
      expected: "2 items without ellipsis",
    },
    {
      name: "Title with ellipsis as separator",
      input:
        "Issue {{ bundleIssue }} - First Article...Second Article...Third Article",
      expected: "3 items (split on ellipsis)",
    },
    {
      name: "Title with period and space as separator",
      input:
        "Issue {{ bundleIssue }} - First Article. Second Article. Third Article",
      expected: "3 items (split on period + space)",
    },
    {
      name: "Title with exclamation point",
      input:
        "Issue {{ bundleIssue }} - Amazing News! Another Article, Final One",
      expected: "3 items (split on exclamation and comma)",
    },
    {
      name: "Single article (no separators)",
      input: "Issue {{ bundleIssue }} - Only One Article Here",
      expected: "1 item",
    },
  ];

  let report = "";

  for (const testCase of testCases) {
    console.log(`Test: ${testCase.name}`);
    console.log(`Input: ${testCase.input}`);
    console.log(`Expected: ${testCase.expected}`);

    const result = blogTitleToList(testCase.input);
    console.log("Output:");
    console.log(result);
    console.log();

    report += `${"=".repeat(70)}\n`;
    report += `Test: ${testCase.name}\n`;
    report += `${"=".repeat(70)}\n`;
    report += `Input:\n${testCase.input}\n\n`;
    report += `Expected: ${testCase.expected}\n\n`;
    report += `Output:\n${result}\n\n`;
  }

  return report;
}

/**
 * Process actual blog files
 */
function processActualFiles(years = [2023, 2024, 2025, 2026]) {
  console.log("=".repeat(70));
  console.log("PROCESSING ACTUAL BLOG FILES");
  console.log("=".repeat(70));
  console.log();

  let report = `${"=".repeat(70)}\n`;
  report += `ACTUAL BLOG FILE PROCESSING\n`;
  report += `${"=".repeat(70)}\n\n`;

  for (const year of years) {
    const yearPath = path.join(BLOG_BASE_PATH, year.toString());

    if (!fs.existsSync(yearPath)) {
      console.log(`Directory not found: ${yearPath}`);
      continue;
    }

    const files = fs.readdirSync(yearPath);
    const blogFiles = files.filter((file) =>
      file.match(/^11ty-bundle-\d+\.md$/)
    );

    console.log(`Processing ${blogFiles.length} files from ${year}...`);

    for (const filename of blogFiles) {
      const filePath = path.join(yearPath, filename);
      const issueNumber = extractIssueNumber(filename);

      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const frontMatter = extractFrontMatter(content);

        if (!frontMatter) {
          continue;
        }

        const title = extractTitle(frontMatter);

        if (!title) {
          continue;
        }

        const htmlOutput = blogTitleToList(title);

        console.log(`Issue ${issueNumber}:`);
        console.log(`  Original: ${title.substring(0, 80)}...`);
        const itemCount = (htmlOutput.match(/<li>/g) || []).length;
        console.log(`  Items: ${itemCount}`);
        console.log();

        report += `${"=".repeat(70)}\n`;
        report += `Issue ${issueNumber} (${filename})\n`;
        report += `${"=".repeat(70)}\n`;
        report += `Original Title:\n${title}\n\n`;
        report += `HTML Output:\n${htmlOutput}\n\n`;
      } catch (error) {
        console.log(`Error processing ${filename}: ${error.message}`);
      }
    }
  }

  return report;
}

/**
 * Main execution
 */
async function main() {
  console.log("BLOG TITLE FILTER TEST SCRIPT\n");

  // Run basic tests
  const testReport = runTests();

  // Process actual files
  const fileReport = processActualFiles();

  // Combine reports
  const fullReport =
    `BLOG TITLE FILTER TEST RESULTS\n` +
    `Generated: ${new Date().toISOString()}\n\n` +
    testReport +
    "\n" +
    fileReport;

  // Ensure log directory exists
  const logDir = path.dirname(OUTPUT_LOG);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // Write to log file
  fs.writeFileSync(OUTPUT_LOG, fullReport, "utf-8");

  console.log("=".repeat(70));
  console.log("✓ Testing complete!");
  console.log(`Report written to: ${OUTPUT_LOG}`);
  console.log("=".repeat(70));
}

main();
