// issueRecords.json is generated whenever a new item is added to
// bundledb.json and is available to templates and filters when
// building the 11tybundle.dev site.

import { config } from "./config.js";
//***** FOR WRITING ISSUE RECORDS ARRAY TO A FILE *****
import path from "path";
import { promises as fs } from "fs";
//*****

// generate issueRecords array from the bundleRecords
// with each record containing the issue number and counts of
// blog posts, releases, and sites for that issue
const buildIssueRecords = (bundleRecords) => {
  const countsByIssue = new Map();

  for (const item of bundleRecords) {
    // Ignore records explicitly marked to be skipped
    if (item?.Skip) continue;

    const issueNum = Number(item?.Issue);
    if (!Number.isFinite(issueNum) || issueNum < 1) continue;

    if (!countsByIssue.has(issueNum)) {
      countsByIssue.set(issueNum, { blogPosts: 0, releases: 0, sites: 0 });
    }
    const bucket = countsByIssue.get(issueNum);

    switch (item.Type) {
      case "blog post":
        bucket.blogPosts += 1;
        break;
      case "release":
        bucket.releases += 1;
        break;
      case "site":
        bucket.sites += 1;
        break;
      default:
        break;
    }
  }

  const maxIssue = Math.max(0, ...countsByIssue.keys());
  const issueRecords = [];
  for (let i = 1; i <= maxIssue; i++) {
    const c = countsByIssue.get(i) || { blogPosts: 0, releases: 0, sites: 0 };
    issueRecords.push({
      issue: i,
      blogPosts: c.blogPosts,
      releases: c.releases,
      sites: c.sites,
    });
  }

  return issueRecords;
};

/**
 * Write the issueRecords array to the path specified in config.
 * @param {Array} issueRecords
 * @returns {string} output file path
 */
const writeIssueRecordsToFile = async (issueRecords) => {
  const outPath = config.issueRecordsPath;
  const outDir = path.dirname(outPath);

  try {
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(outPath, JSON.stringify(issueRecords, null, 2), "utf8");
    console.log(`Wrote ${issueRecords.length} issue records to ${outPath}`);
    return outPath;
  } catch (err) {
    console.error(
      "Failed to write issue records:",
      err && err.message ? err.message : err
    );
    throw err;
  }
};

export async function genIssueRecords() {
  // Read the bundledb.json file from the configured location
  const bundleDbData = await fs.readFile(config.dbFilePath, "utf8");
  const bundleRecords = JSON.parse(bundleDbData);

  const issueRecords = await buildIssueRecords(bundleRecords);
  await writeIssueRecordsToFile(issueRecords);
}
