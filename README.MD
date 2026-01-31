# dbtools

A set of Node.js CLI scripts for managing the database that drives [11tybundle.dev](https://11tybundle.dev) — a community resource showcasing Eleventy blog posts, sites, releases, and starter projects.

The database is a JSON file (`bundledb.json`) containing 1,600+ curated entries from 400+ authors across 50+ categories. These tools handle everything from adding new entries with auto-fetched metadata to generating site screenshots, checking for broken links, and producing data insights.

If you want to know more about the early days of how these tools came about, I wrote a [blog post about them](https://bobmonsour.com/blog/node-cli-of-my-dreams/). They are far richer and more complex than I initially envisioned!

## How it works

Run `node bundle.js` to get an interactive menu with these options:

1. **Make Bundle Entries** — create new database entries (blog posts, sites, releases, starters) with auto-fetched metadata including descriptions, favicons, RSS links, and social links
2. **Check Empty Fields** — find and fill missing descriptions and RSS links
3. **Single Screenshot** — regenerate a site screenshot via Puppeteer
4. **Check Link Errors** — scan all database links for broken URLs
5. **Generate Latest Data** — export entries for the most recent issue
6. **Create Blog Post** — generate a markdown post for a new bundle issue announcement
7. **Remove Test Data** — remove test entries (identified by "bobDemo" in the title) from the database
8. **Copy Production Data** — copy production data files to the local dev environment
9. **Generate Insights** — analyze the database and generate an HTML page with charts visualizing trends

Each script can also be run directly with `node <script-name>.js`.

## Related projects

This repo is part of a three-repo system:

- **[11tybundle.dev](https://github.com/bobmonsour/11tybundle.dev)** — the Eleventy site that renders the data
- **11tybundledb** — the JSON database repository (bundledb.json, showcase-data.json)
- **dbtools** (this repo) — CLI scripts that populate and manage the database

Data flows one way: dbtools writes to 11tybundledb, and 11tybundle.dev reads from it at build time.

## Setup

Requires Node.js 22+ and a `GITHUB_TOKEN` in `.env` for GitHub API access.

```bash
npm install
node bundle.js
```

## Tech

ES modules throughout. Key dependencies include `@inquirer/prompts` for interactive CLI, `cheerio` for HTML parsing, `puppeteer` for screenshots, `sharp` for image processing, `@11ty/eleventy-fetch` for cached HTTP requests, and `octokit` for the GitHub API.
