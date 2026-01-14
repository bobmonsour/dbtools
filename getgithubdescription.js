// Fetch GitHub repository description using Octokit
import { Octokit } from "octokit";
import path from "path";
import { fileURLToPath } from "url";
import { promises as fs } from "fs";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Persistent failure cache across builds
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const failureCachePath = path.join(
  __dirname,
  "log/github-description-failures.json"
);
let failureCache = {};

// Load failure cache from disk
try {
  const data = await fs.readFile(failureCachePath, "utf-8");
  failureCache = JSON.parse(data);
} catch {
  // File doesn't exist yet or is invalid, start with empty cache
  failureCache = {};
}

// Helper to save failure cache to disk
const saveFailureCache = async () => {
  try {
    await fs.mkdir(path.dirname(failureCachePath), { recursive: true });
    await fs.writeFile(failureCachePath, JSON.stringify(failureCache, null, 2));
  } catch (error) {
    console.error(
      "Failed to save GitHub description failure cache:",
      error.message
    );
  }
};

// Helper to get current date as YYYY-MM-DD
const getCurrentDate = () => {
  const now = new Date();
  return now.toISOString().split("T")[0];
};

// Helper to check if a failure is older than 30 days
const isFailureExpired = (failureDate) => {
  const stored = new Date(failureDate);
  const now = new Date();
  const daysDiff = (now - stored) / (1000 * 60 * 60 * 24);
  return daysDiff >= 30;
};

// Parse GitHub URL to extract owner and repo
const parseGitHubUrl = (url) => {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/").filter(Boolean);
    if (pathParts.length >= 2) {
      return {
        owner: pathParts[0],
        repo: pathParts[1],
      };
    }
  } catch (error) {
    console.error("Invalid GitHub URL:", url);
  }
  return null;
};

// Initialize Octokit with GitHub token
let octokit;
try {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN not found in environment variables");
  }
  octokit = new Octokit({ auth: token });
} catch (error) {
  console.error("Failed to initialize Octokit:", error.message);
  process.exit(1);
}

/**
 * Fetches the description of a GitHub repository
 * @param {string} githubUrl - Full GitHub repository URL
 * @returns {Promise<string>} Repository description or empty string
 */
export const getGitHubDescription = async (githubUrl) => {
  // Check persistent failure cache first
  if (failureCache[githubUrl]) {
    const failureDate = failureCache[githubUrl];
    // If failure is less than 30 days old, skip fetch
    if (!isFailureExpired(failureDate)) {
      return "";
    }
    // If 30+ days old, we'll retry (continue to fetch below)
  }

  // Parse GitHub URL
  const parsed = parseGitHubUrl(githubUrl);
  if (!parsed) {
    console.log(`Invalid GitHub URL format: ${githubUrl}`);
    failureCache[githubUrl] = getCurrentDate();
    await saveFailureCache();
    return "";
  }

  const { owner, repo } = parsed;

  try {
    // Fetch repository information from GitHub API
    const response = await octokit.rest.repos.get({
      owner,
      repo,
    });

    const description = response.data.description || "";

    // Success! Remove from failure cache if it was there
    if (failureCache[githubUrl]) {
      delete failureCache[githubUrl];
      await saveFailureCache();
    }

    return description;
  } catch (error) {
    console.log(
      `Error fetching GitHub description for ${githubUrl}: ${error.message}`
    );

    // Add to persistent failure cache with current date
    failureCache[githubUrl] = getCurrentDate();
    await saveFailureCache();

    return "";
  }
};
