// Fetch all JSON files from the 11ty-community repository
// and combine them into a single array

import { writeFileSync, readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import "dotenv/config";

// Get our bearings for this module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// GitHub repository information
const REPO_OWNER = "11ty";
const REPO_NAME = "11ty-community";
const DIRECTORY_PATH = "built-with-eleventy";
const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// Common headers for GitHub API requests
function getGitHubHeaders() {
  const headers = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "11ty-showcase",
  };

  if (GITHUB_TOKEN) {
    headers.Authorization = `token ${GITHUB_TOKEN}`;
  }

  return headers;
}

/**
 * Get the default branch of the repository
 */
async function getDefaultBranch() {
  const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}`;

  const response = await fetch(url, {
    headers: getGitHubHeaders(),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch repo info: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  return data.default_branch;
}

/**
 * Fetch the list of ALL files in the GitHub directory using Git Trees API
 * This bypasses the 1,000 file limit of the Contents API
 */
async function fetchDirectoryContents() {
  // First, get the default branch
  const branch = await getDefaultBranch();
  console.log(`Using branch: ${branch}`);

  // Get the tree SHA for the directory using recursive tree API
  const treeUrl = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/${branch}?recursive=1`;

  console.log(`Fetching tree contents from: ${treeUrl}`);

  const response = await fetch(treeUrl, {
    headers: getGitHubHeaders(),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch tree: ${response.status} ${response.statusText}`
    );
  }

  const treeData = await response.json();

  // Filter for files in the specific directory
  const directoryFiles = treeData.tree
    .filter(
      (item) =>
        item.type === "blob" &&
        item.path.startsWith(DIRECTORY_PATH + "/") &&
        item.path.endsWith(".json")
    )
    .map((item) => ({
      name: item.path.split("/").pop(),
      path: item.path,
      sha: item.sha,
      // Construct the raw content URL
      download_url: `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${branch}/${item.path}`,
    }));

  return directoryFiles;
}

/**
 * Fetch the commit history for a file to get creation and last modified dates
 */
async function fetchFileCommitDates(filePath) {
  const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/commits?path=${filePath}&per_page=1`;

  const response = await fetch(url, {
    headers: getGitHubHeaders(),
  });

  if (!response.ok) {
    console.warn(`Could not fetch commit dates for ${filePath}`);
    return null;
  }

  const commits = await response.json();

  if (commits.length === 0) {
    return null;
  }

  // The first commit in the response is the most recent
  const lastModified = commits[0].commit.author.date;

  // To get creation date, we need the first commit (fetch from the end)
  const firstCommitUrl = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/commits?path=${filePath}&per_page=1&page=1`;

  // For simplicity, we'll use the Link header or just get all commits
  // But for efficiency, let's just get the last modified date for now
  // To get creation date accurately, we'd need to paginate to the last page

  return {
    lastModified: lastModified,
  };
}

/**
 * Fetch the content of a single JSON file from GitHub
 */
async function fetchFileContent(downloadUrl, filePath) {
  console.log(`Fetching file: ${downloadUrl}`);

  const response = await fetch(downloadUrl);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch file: ${response.status} ${response.statusText}`
    );
  }

  const content = await response.json();

  // Add commit date information
  const dates = await fetchFileCommitDates(filePath);
  if (dates) {
    content._github_last_modified = dates.lastModified;
  }

  return content;
}

/**
 * Main function to fetch all JSON files and combine them
 */
async function fetchAllCommunityData() {
  try {
    const outputPath = join(__dirname, "devdata", "communityData.json");

    // Load existing data if it exists
    let existingData = [];
    let existingUrlMap = new Map();

    if (existsSync(outputPath)) {
      console.log("Loading existing data file...");
      const existingContent = readFileSync(outputPath, "utf-8");
      existingData = JSON.parse(existingContent);

      // Create a Map of URLs to their index for quick lookup and updates
      existingData.forEach((item, index) => {
        if (item.url) {
          existingUrlMap.set(item.url, index);
        }
      });
      console.log(`Found ${existingData.length} existing entries\n`);
    }

    // Get list of files in the directory (all JSON files, no limit)
    const jsonFiles = await fetchDirectoryContents();

    console.log(
      `Found ${jsonFiles.length} JSON files (including all files beyond the 1,000 limit)`
    );

    // Fetch content of each JSON file
    const allData = [...existingData]; // Start with existing data
    let newCount = 0;
    let updatedCount = 0;

    for (const file of jsonFiles) {
      try {
        const content = await fetchFileContent(file.download_url, file.path);

        // Check if this URL already exists in our data
        if (content.url && existingUrlMap.has(content.url)) {
          // Update the existing entry with new metadata
          const index = existingUrlMap.get(content.url);
          allData[index] = { ...allData[index], ...content };
          console.log(`↻ Updated metadata: ${file.name} (${content.url})`);
          updatedCount++;
        } else {
          // Add as new entry
          allData.push(content);
          if (content.url) {
            existingUrlMap.set(content.url, allData.length - 1);
          }
          console.log(`✓ Added new: ${file.name}`);
          newCount++;
        }
      } catch (error) {
        console.error(`✗ Failed to load ${file.name}:`, error.message);
      }
    }

    console.log(
      `\nResults: ${newCount} new entries added, ${updatedCount} entries updated`
    );
    console.log(`Total entries in dataset: ${allData.length}`);

    // Save to output file
    writeFileSync(outputPath, JSON.stringify(allData, null, 2));
    console.log(`\nData saved to: ${outputPath}`);

    return allData;
  } catch (error) {
    console.error("Error fetching community data:", error);
    throw error;
  }
}

// Run the script
fetchAllCommunityData();
