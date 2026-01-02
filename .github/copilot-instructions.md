# 11ty Bundle Database Tools - AI Agent Guide

## Project Purpose

CLI tooling for managing a JSON database (`bundledb.json`) that powers [11tybundle.dev](https://11tybundle.dev) - an Eleventy community newsletter. Scripts handle database entry creation, metadata enrichment (favicons, descriptions, RSS/social links), validation, and screenshot generation.

## Architecture

### Core Database Structure

- **Main database**: `devdata/bundledb.json` (test) or `11tybundledb/bundledb.json` (production)
- **Entry types**: "blog post", "site", "release" - each with type-specific required fields
- **Auto-backups**: Created before writes in `db_backups/` with timestamp format `bundledb-YYYY-MM-DD--HHMMSS.json`
- See [docs/bundleitems.md](docs/bundleitems.md) for complete schema examples

### Configuration System

- `config.js` - Central config with `useTestData` flag (toggle between test/production paths)
- `cacheconfig.js` - Eleventy-fetch cache durations and timeout settings
- Always check `config.useTestData` before modifying database paths

### Module Organization

- **Interactive CLI**: `make-bundle-entries.js` - Primary entry creation wizard using `@inquirer/prompts`
- **Data enrichment**: `get*.js` modules (getfavicon, getdescription, getrsslink, getsociallinks) - Single-purpose fetchers
- **Batch processing**: `one-offs/fetch-*.js` - Use `db-processor.js` pattern for bulk operations
- **Utilities**: `utils.js` - Shared functions (backup, validation, date formatting, category extraction)
- **Validation**: `check-*.js` scripts - Database integrity checks

## Critical Patterns

### Persistent Failure Caching

All fetch modules (`getfavicon.js`, `getdescription.js`, `fetchhtml.js`, etc.) maintain failure caches in `log/*-failures.json` to skip URLs that failed in the last 30 days. Always preserve this pattern when creating new fetchers:

```javascript
// Load from log/<module>-fetch-failures.json at module init
// Check cache before fetch, save failures with getCurrentDate()
// Retry expired failures (30+ days) via isFailureExpired()
```

### Database Processing Pattern (`db-processor.js`)

Standard approach for batch enrichment operations. See `one-offs/fetch-site-descriptions.js`:

```javascript
await processDbEntries({
  typeFilter: "site", // Entry type to process
  propertyToAdd: "description", // Property to add/update
  fetchFunction: getDescription, // Fetcher function
  inputProperty: "Link", // Source property for fetcher
  outputFilename: "bundledb-with-site-descriptions.json",
  skipExisting: true, // Skip items with property already set
  scriptName: "Site Description Fetcher",
});
```

Always creates timestamped backup before processing.

### Interactive CLI Workflow (`make-bundle-entries.js`)

- Validates URLs for uniqueness AND accessibility before entry
- Auto-slugifies titles and author names
- Defaults Issue number to latest in database
- Supports date formats: `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ss.000`
- Categories via checkbox selection from existing unique values
- Optional metadata enrichment after entry (favicon, description, RSS, social links)

### Cache Strategy (Eleventy Fetch)

- HTML/metadata: 1 year cache (`cacheDuration.descHtml`, `.faviconHtml`, etc.)
- Database reads: No cache (`0s`) - always fresh
- Timeout configuration in `cacheconfig.js` (3-5 seconds typical)
- Cache directory: `.cache/` at project root

## Developer Workflows

### Adding New Entries

```bash
node make-bundle-entries.js
```

Creates backup automatically. Choose "blog post", "site", or "release", then follow prompts.

### Batch Metadata Enrichment

```bash
# Run from one-offs/ directory
node one-offs/fetch-site-descriptions.js
node one-offs/fetch-site-favicons.js
```

Output files include enriched data in `devdata/` with descriptive names.

### Link Validation

```bash
node check-link-errors.js  # Categorizes errors as permanent/temporary
node verify-entry-links.js  # Checks specific entry types
```

Results logged to `log/permanent-errors.txt` and `log/temporary-errors.txt`.

### Screenshot Generation

Uses Puppeteer for 1920x1080 JPEG captures. Target folder outside this repo (`../src/img/screenshots/`).

## Common Gotchas

- **Database path confusion**: Always verify `config.useTestData` flag before running scripts
- **No npm scripts**: All tools run directly with `node <script>.js`
- **Backup safety**: Scripts auto-backup before writes; never manually edit production database without backup
- **Favicon resizing**: Fetches 128px from Google, resizes to 64px target via Sharp (logged in `log/resized-files.md`)
- **Slugification**: Uses `@sindresorhus/slugify` for consistent URL-safe strings
- **Date formatting**: `formatItemDate()` in utils.js converts ISO dates to human-readable format

## Key Files for Context

- [make-bundle-entries.js](make-bundle-entries.js) - Main CLI workflow and validation patterns
- [db-processor.js](db-processor.js) - Generic batch processing template
- [utils.js](utils.js) - Shared backup/validation/formatting functions
- [config.js](config.js) - Database path configuration
- [docs/bundleitems.md](docs/bundleitems.md) - Complete database schema reference
