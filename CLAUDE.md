# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **dbtools** — a set of Node.js CLI scripts for managing the database that drives [11tybundle.dev](https://11tybundle.dev). The database is a JSON file (`bundledb.json`) containing curated entries about Eleventy (11ty) blog posts, sites, releases, and starters. Related blog post: [bobmonsour.com/blog/node-cli-of-my-dreams/](https://bobmonsour.com/blog/node-cli-of-my-dreams/).

ES modules throughout (`"type": "module"` in package.json). No build step, no test suite.

## Running

```bash
node bundle.js          # Interactive main menu
node <script-name>.js   # Run any script directly
```

The main menu (`bundle.js`) launches these workflows via `@inquirer/prompts`:

1. **Make Bundle Entries** — create new database entries with auto-fetched metadata
2. **Check Empty Fields** — find and fill missing descriptions/RSS links
3. **Single Screenshot** — regenerate a site screenshot via Puppeteer
4. **Check Link Errors** — scan all links for broken URLs
5. **Generate Latest Data** — export entries for the most recent issue
6. **Create Blog Post** — generate a markdown post for a new issue announcement

## Dev vs Production Data

`config.js` has a `useTestData` flag (default `true`). When true, all scripts read/write to `devdata/` within this repo. When false, they target the production database at `../11tybundledb/`. Always verify this flag before running scripts.

## Architecture

**Data flow:** User runs interactive CLI -> script fetches metadata from the web -> validates/deduplicates -> backs up existing data -> writes to JSON database.

### Core modules

| File              | Purpose                                                                        |
| ----------------- | ------------------------------------------------------------------------------ |
| `config.js`       | Path configuration with dev/prod toggle                                        |
| `cacheconfig.js`  | Cache durations (eleventy-fetch) and fetch timeouts                            |
| `utils.js`        | Shared utilities: duplicate checking, backups, issue counting, date formatting |
| `db-processor.js` | Generic batch processor for database entries with filtering and error handling |
| `bundledata.js`   | Data loading/validation for the 11tybundle.dev site build                      |

Note that bundledata.js is only present here for reference. The live version of the file is in the sibling repo for 11tybundle.dev.

### Data fetching modules

Each module fetches one type of metadata from URLs:

- `fetchhtml.js` — base HTML fetcher with eleventy-fetch caching and 30-day failure cache
- `getdescription.js` — meta descriptions (cheerio)
- `getfavicon.js` — favicons via Google Favicon API, resized to 64x64 (sharp)
- `getsociallinks.js` — GitHub/Mastodon/Bluesky/LinkedIn/YouTube profile links
- `getrsslink.js` — RSS feed URLs from HTML link elements
- `getgithubdescription.js` — GitHub repo descriptions (octokit)
- `gettitle.js` — page titles
- `genscreenshots.js` / `single-screenshot.js` — site screenshots (Puppeteer, 1920x1080 JPEG)

### Caching strategy

- `@11ty/eleventy-fetch` handles HTTP caching with configurable durations in `cacheconfig.js` (most set to `1y`, database set to `0s`)
- Persistent failure caches in `./log/` (e.g., `description-fetch-failures.json`, `favicon-failures.json`) prevent re-fetching URLs that previously failed for 30 days
- Rate limiting via `bottleneck` for bulk link checking (max 500 concurrent)

### Backup system

Before any database write, scripts call `makeBackupFile()` from `utils.js`, creating timestamped copies in `devdata/bundledb-backups/` (or the production equivalent). Format: `bundledb-YYYY-MM-DD--HHMMSS.json`.

## Database Schema

Each entry in `bundledb.json` has:

- `Issue` (string), `Type` ("blog post" | "site" | "release" | "starter"), `Title`, `Link`, `Date` (ISO 8601), `formattedDate`
- Blog posts add: `Author`, `slugifiedAuthor`, `AuthorSite`, `AuthorSiteDescription`, `socialLinks` (object), `favicon`, `rssLink`, `Categories` (array), `description`
- Sites/starters add: `description`, `favicon`
- Optional: `Skip` (boolean) to exclude from processing, `leaderboardLink` for Speedlify

`showcase-data.json` tracks showcase sites with `title`, `description`, `link`, `favicon`, `screenshotpath`, `leaderboardLink`.

## Environment

Requires a `GITHUB_TOKEN` in `.env` for GitHub API access (octokit) — used for fetching starter repo data, community submissions, and repo descriptions.

## Key directories

- `devdata/` — development database files and backups
- `favicons/` — cached favicon images
- `screenshots/` — generated site screenshots
- `log/` — error logs and failure caches

## Notes on the generate-insights.js Script

Among the recent additions to this repo is the `generate-insights.js` script, which analyzes the database to produce insights about trends in the bundledb.json file. It generates an HTML and CSS file that visualizes these insights using charts and graphs.

This will be the focus of near term development in this repo, with plans to expand the types of insights generated and improve the visualizations. Future enhancements may include: making the resulting html more closely align with the visual style of the 11tybundle.dev website, ensuring that the resulting html page that is generated is "accessible" to those useing screen readers, ensuring that when used on smaller screens (mobile devices) the resulting html page is still easy to read and navigate, and further improving data quality with more effective data extraction methods.
