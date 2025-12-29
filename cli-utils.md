# CLI Utilities Documentation

This document contains the help documentation for all command-line utilities in the dbtools project.

---

## copy-cached-favicons.js

```
Copy Cached Favicons
====================

Copies processed favicon files from the cache directory to the project's
public assets directory.

USAGE:
  node copy-cached-favicons.js [OPTIONS]

OPTIONS:
  -h, --help     Show this help message
  -f, --force    Force overwrite existing files (default: skip existing)

DESCRIPTION:
  By default, this script skips files that already exist in the destination
  directory, making repeated runs fast. Use --force to overwrite all files.

SOURCE:      .cache/favicons/
DESTINATION: /Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundle.dev/_site/img/favicons/

EXAMPLES:
  node copy-cached-favicons.js           # Copy only new files
  node copy-cached-favicons.js --force   # Overwrite all files
```

---

## check-empty-fields.js

```
Check Empty Fields
==================

Interactive script to find and fill empty description and rssLink fields
in the bundledb database by fetching data from the web.

USAGE:
  node check-empty-fields.js [OPTIONS]

OPTIONS:
  -h, --help     Show this help message

DESCRIPTION:
  This script provides an interactive menu to:

  1. Process the entire database
     - Scans all entries for empty description or rssLink fields
     - Attempts to fetch missing data from the web

  2. Process a specific domain
     - Filter entries by domain (e.g., benmyers.dev)
     - Choose to auto-fetch all empty fields, or
     - Manually provide an RSS link for all entries from that domain

  The script creates a backup before making any changes and provides
  a summary of what will be updated before proceeding.

DATABASE:
  /Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb/bundledb.json

EXAMPLES:
  node check-empty-fields.js    # Start interactive mode
```

---

## check-link-errors.js

```
Check Link Errors
=================

Scans all links in the bundledb database to detect broken or problematic URLs.

USAGE:
  node check-link-errors.js [OPTIONS]

OPTIONS:
  -h, --help     Show this help message

DESCRIPTION:
  This script checks all links in the database (excluding those with a Skip
  property) for HTTP errors and connection issues. It categorizes errors into:

  PERMANENT ERRORS:
  - 404 Not Found, 410 Gone, 403 Forbidden
  - DNS resolution failures
  These indicate content is likely permanently unavailable.

  TEMPORARY ERRORS:
  - 5xx Server Errors, 429 Too Many Requests
  - Timeouts, Connection Refused, SSL/Certificate issues
  These may resolve on their own and should be rechecked later.

  Results are saved to:
  - log/permanent-errors.txt
  - log/temporary-errors.txt

DATABASE:
  /Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb/bundledb.json

EXAMPLES:
  node check-link-errors.js    # Check all links in database
```

---

## add-empty-authorsitedesc.js

```
Add Empty AuthorSiteDescription Property
=========================================

Adds an empty AuthorSiteDescription property to blog post entries that
don't already have one.

USAGE:
  node add-empty-authorsitedesc.js [OPTIONS]

OPTIONS:
  -h, --help     Show this help message

DESCRIPTION:
  This script ensures all blog posts in the database have an
  AuthorSiteDescription property, even if initially empty. It:

  - Scans for blog post entries missing the AuthorSiteDescription property
  - Creates a backup of the database before making changes
  - Adds an empty AuthorSiteDescription field (set to "")
  - Places it immediately after the AuthorSite property
  - Updates the bundledb.json file

  This is useful for database schema updates when adding a new field
  to existing records.

DATABASE:
  /Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb/bundledb.json

EXAMPLES:
  node add-empty-authorsitedesc.js    # Add missing properties
```
