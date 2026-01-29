/**
 * Generate Bundle Insights Page
 *
 * Creates a static HTML page with SVG charts visualizing metrics
 * from the production bundledb.json database.
 *
 * Run: node generate-insights.js
 */

import fs from "fs";
import path from "path";

// Production database path (hardcoded for read-only access)
const PRODUCTION_DB_PATH =
  "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb/bundledb.json";
const OUTPUT_DIR = "./insights";

// ============================================================================
// Data Loading
// ============================================================================

function loadDatabase() {
  const data = fs.readFileSync(PRODUCTION_DB_PATH, "utf8");
  return JSON.parse(data);
}

// ============================================================================
// Date Utilities
// ============================================================================

function parseDate(dateStr) {
  // Handle both YYYY-MM-DD and YYYY-MM-DDTHH:mm:ss.000 formats
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

function getYearMonth(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(yearMonth) {
  const [year, month] = yearMonth.split("-");
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${monthNames[parseInt(month) - 1]} ${year}`;
}

function getAllMonthsBetween(startDate, endDate) {
  const months = [];
  const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

  while (current <= end) {
    months.push(getYearMonth(current));
    current.setMonth(current.getMonth() + 1);
  }
  return months;
}

function formatNumber(num) {
  return num.toLocaleString("en-US");
}

// ============================================================================
// Metrics Computation
// ============================================================================

function computeEntryTypeMetrics(entries) {
  const validTypes = ["blog post", "site", "release"];
  const filtered = entries.filter(
    (e) => !e.Skip && validTypes.includes(e.Type),
  );

  // Current counts
  const counts = { "blog post": 0, site: 0, release: 0 };
  filtered.forEach((e) => counts[e.Type]++);

  // Find date range
  const dates = filtered.map((e) => parseDate(e.Date)).filter(Boolean);
  if (dates.length === 0) return { counts, cumulative: {} };

  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));
  const allMonths = getAllMonthsBetween(minDate, maxDate);

  // Cumulative counts by month
  const cumulative = {};
  validTypes.forEach((type) => {
    cumulative[type] = {};
    let running = 0;
    allMonths.forEach((month) => {
      const monthEntries = filtered.filter((e) => {
        const d = parseDate(e.Date);
        return d && getYearMonth(d) === month && e.Type === type;
      });
      running += monthEntries.length;
      cumulative[type][month] = running;
    });
  });

  return { counts, cumulative, months: allMonths };
}

function computeAuthorContributions(entries) {
  const filtered = entries.filter((e) => !e.Skip && e.Author);
  const authorCounts = {};

  filtered.forEach((e) => {
    authorCounts[e.Author] = (authorCounts[e.Author] || 0) + 1;
  });

  // Bucket into ranges
  const ranges = { "1-2": 0, "3-5": 0, "6-10": 0, "11-20": 0, "21+": 0 };
  Object.values(authorCounts).forEach((count) => {
    if (count >= 21) ranges["21+"]++;
    else if (count >= 11) ranges["11-20"]++;
    else if (count >= 6) ranges["6-10"]++;
    else if (count >= 3) ranges["3-5"]++;
    else if (count >= 1) ranges["1-2"]++;
  });

  return ranges;
}

function computeCategoryMetrics(entries) {
  const filtered = entries.filter(
    (e) => !e.Skip && e.Categories && e.Categories.length > 0,
  );

  // Count entries per category (excluding "How to...")
  const categoryCounts = {};
  const excludedCategories = ["How to..."];
  filtered.forEach((e) => {
    e.Categories.forEach((cat) => {
      if (!excludedCategories.includes(cat)) {
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      }
    });
  });

  // Get top 20 categories
  const sortedCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  const top20 = sortedCategories.map(([name, count]) => ({ name, count }));

  // Find date range for cumulative
  const dates = filtered.map((e) => parseDate(e.Date)).filter(Boolean);
  if (dates.length === 0) return { top20, cumulative: {} };

  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));
  const allMonths = getAllMonthsBetween(minDate, maxDate);

  // Cumulative counts by month for top 20 categories
  const cumulative = {};
  top20.forEach(({ name }) => {
    cumulative[name] = {};
    let running = 0;
    allMonths.forEach((month) => {
      const monthEntries = filtered.filter((e) => {
        const d = parseDate(e.Date);
        return d && getYearMonth(d) === month && e.Categories.includes(name);
      });
      running += monthEntries.length;
      cumulative[name][month] = running;
    });
  });

  return { top20, cumulative, months: allMonths };
}

function computeMissingDataMetrics(entries) {
  const filtered = entries.filter((e) => !e.Skip);

  // Get unique authors and their entries
  const authorEntries = {};
  filtered.forEach((e) => {
    if (e.Author) {
      if (!authorEntries[e.Author]) {
        authorEntries[e.Author] = {
          entries: [],
          rssLink: e.rssLink,
          favicon: e.favicon,
          authorSiteDescription: e.AuthorSiteDescription,
          authorSite: e.AuthorSite,
          author: e.Author,
        };
      }
      authorEntries[e.Author].entries.push(e);
      // Update with latest values if present
      if (e.rssLink) authorEntries[e.Author].rssLink = e.rssLink;
      if (e.favicon) authorEntries[e.Author].favicon = e.favicon;
      if (e.AuthorSiteDescription)
        authorEntries[e.Author].authorSiteDescription = e.AuthorSiteDescription;
      if (e.AuthorSite) authorEntries[e.Author].authorSite = e.AuthorSite;
    }
  });

  // Collect authors missing data with details
  const authorsWithMissingRssLink = [];
  const authorsWithMissingFavicon = [];
  const authorsWithMissingDescription = [];

  Object.entries(authorEntries).forEach(([authorName, author]) => {
    const authorInfo = { name: authorName, site: author.authorSite || "" };

    if (!author.rssLink || author.rssLink.trim() === "") {
      authorsWithMissingRssLink.push(authorInfo);
    }
    if (author.favicon === "#icon-person-circle") {
      authorsWithMissingFavicon.push(authorInfo);
    }
    if (
      !author.authorSiteDescription ||
      author.authorSiteDescription.trim() === ""
    ) {
      authorsWithMissingDescription.push(authorInfo);
    }
  });

  // Sort author lists alphabetically by name
  authorsWithMissingRssLink.sort((a, b) => a.name.localeCompare(b.name));
  authorsWithMissingFavicon.sort((a, b) => a.name.localeCompare(b.name));
  authorsWithMissingDescription.sort((a, b) => a.name.localeCompare(b.name));

  // Collect blog posts missing description
  const blogPosts = filtered.filter((e) => e.Type === "blog post");
  const postsWithMissingDescription = blogPosts
    .filter((e) => !e.description || e.description.trim() === "")
    .map((e) => ({ title: e.Title, link: e.Link }))
    .sort((a, b) => a.title.localeCompare(b.title));

  return {
    totalAuthors: Object.keys(authorEntries).length,
    missingRssLink: authorsWithMissingRssLink.length,
    missingFavicon: authorsWithMissingFavicon.length,
    missingAuthorSiteDescription: authorsWithMissingDescription.length,
    totalBlogPosts: blogPosts.length,
    missingBlogDescription: postsWithMissingDescription.length,
    // Detail lists
    authorsWithMissingRssLink,
    authorsWithMissingFavicon,
    authorsWithMissingDescription,
    postsWithMissingDescription,
  };
}

// ============================================================================
// SVG Chart Generation
// ============================================================================

// Color palette matching 11tybundle.dev design
const COLORS = {
  primary: "#c47328", // oklch(52% 0.1 60) approximation - warm orange
  secondary: "#a67c3d",
  tertiary: "#7a8c45",
  quaternary: "#4a9466",
  quinary: "#3d8e8e",
  senary: "#5577a3",
  septenary: "#7a5fa3",
  greyscale: "#666666",
  blogPost: "#5577a3", // senary - blue
  site: "#4a9466", // quaternary - green
  release: "#a67c3d", // secondary - gold
  surface: "#f5f3f0",
  surfaceMid: "#ebe8e3",
  surfaceFore: "#ddd9d2",
  text: "#1a1a1a",
  textMuted: "#666666",
};

// Extended color palette for categories (20 distinct colors)
const CATEGORY_COLORS = [
  "#c47328",
  "#a67c3d",
  "#7a8c45",
  "#4a9466",
  "#3d8e8e",
  "#5577a3",
  "#7a5fa3",
  "#a35f8e",
  "#c45a5a",
  "#d4854a",
  "#8faa3d",
  "#3daa8f",
  "#3d8faa",
  "#5a5ac4",
  "#8f3daa",
  "#aa3d8f",
  "#d46a4a",
  "#6abd4a",
  "#4a9dbd",
  "#9d4abd",
];

function generateBarChart(data, options = {}) {
  const {
    width = 600,
    height = 300,
    title = "",
    barColor = COLORS.primary,
    horizontal = false,
  } = options;

  // Use wider left padding for horizontal charts to accommodate longer labels
  const padding = {
    top: 50,
    right: 30,
    bottom: 60,
    left: horizontal ? 140 : 60,
  };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const labels = Object.keys(data);
  const values = Object.values(data);
  const maxValue = Math.max(...values);

  let bars = "";
  let xLabels = "";

  if (horizontal) {
    const barHeight = chartHeight / labels.length - 10;
    labels.forEach((label, i) => {
      const barWidth = (values[i] / maxValue) * chartWidth;
      const y = padding.top + i * (barHeight + 10);

      bars += `<rect x="${padding.left}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${typeof barColor === "object" ? barColor[label] || COLORS.primary : barColor}" rx="4"/>`;
      bars += `<text x="${padding.left - 10}" y="${y + barHeight / 2 + 5}" text-anchor="end" class="chart-label">${label}</text>`;
      bars += `<text x="${padding.left + barWidth + 5}" y="${y + barHeight / 2 + 5}" class="chart-value">${formatNumber(values[i])}</text>`;
    });
  } else {
    const barWidth = chartWidth / labels.length - 10;
    labels.forEach((label, i) => {
      const barHeight = (values[i] / maxValue) * chartHeight;
      const x = padding.left + i * (barWidth + 10) + 5;
      const y = padding.top + chartHeight - barHeight;

      bars += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${typeof barColor === "object" ? barColor[label] || COLORS.primary : barColor}" rx="4"/>`;
      bars += `<text x="${x + barWidth / 2}" y="${height - padding.bottom + 20}" text-anchor="middle" class="chart-label">${label}</text>`;
      bars += `<text x="${x + barWidth / 2}" y="${y - 5}" text-anchor="middle" class="chart-value">${formatNumber(values[i])}</text>`;
    });
  }

  return `
    <svg viewBox="0 0 ${width} ${height}" class="chart bar-chart" role="img" aria-label="${title}">
      <title>${title}</title>
      ${title ? `<text x="${width / 2}" y="25" text-anchor="middle" class="chart-title">${title}</text>` : ""}
      ${bars}
    </svg>
  `;
}

function generateLineChart(data, months, options = {}) {
  const {
    width = 800,
    height = 400,
    title = "",
    showLegend = true,
    marker = null,
  } = options;

  const padding = {
    top: 50,
    right: showLegend ? 180 : 30,
    bottom: 80,
    left: 70,
  };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Find max value across all series
  let maxValue = 0;
  Object.values(data).forEach((series) => {
    Object.values(series).forEach((val) => {
      if (val > maxValue) maxValue = val;
    });
  });

  const seriesNames = Object.keys(data);
  const xStep = chartWidth / (months.length - 1 || 1);

  // Generate axis labels (show every 6th month for readability)
  let xLabels = "";
  months.forEach((month, i) => {
    if (i % 6 === 0 || i === months.length - 1) {
      const x = padding.left + i * xStep;
      xLabels += `<text x="${x}" y="${height - padding.bottom + 20}" text-anchor="middle" class="chart-label" transform="rotate(-45, ${x}, ${height - padding.bottom + 20})">${formatMonthLabel(month)}</text>`;
    }
  });

  // Generate Y axis labels
  let yLabels = "";
  const ySteps = 5;
  for (let i = 0; i <= ySteps; i++) {
    const y = padding.top + chartHeight - (i / ySteps) * chartHeight;
    const val = Math.round((i / ySteps) * maxValue);
    yLabels += `<text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" class="chart-label">${val}</text>`;
    yLabels += `<line x1="${padding.left}" y1="${y}" x2="${padding.left + chartWidth}" y2="${y}" stroke="#ddd" stroke-dasharray="2,2"/>`;
  }

  // Generate lines for each series
  let lines = "";
  let legend = "";

  seriesNames.forEach((name, seriesIndex) => {
    const series = data[name];
    const color =
      seriesNames.length <= 3
        ? {
            "blog post": COLORS.blogPost,
            site: COLORS.site,
            release: COLORS.release,
          }[name] || CATEGORY_COLORS[seriesIndex]
        : CATEGORY_COLORS[seriesIndex % CATEGORY_COLORS.length];

    const points = months.map((month, i) => {
      const x = padding.left + i * xStep;
      const y =
        padding.top +
        chartHeight -
        ((series[month] || 0) / maxValue) * chartHeight;
      return `${x},${y}`;
    });

    lines += `<polyline points="${points.join(" ")}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;

    // Legend entry
    if (showLegend) {
      const legendY = padding.top + seriesIndex * 20;
      legend += `<rect x="${width - padding.right + 10}" y="${legendY - 8}" width="12" height="12" fill="${color}" rx="2"/>`;
      legend += `<text x="${width - padding.right + 28}" y="${legendY + 3}" class="chart-legend-label">${name}</text>`;
    }
  });

  // Generate markers if specified (e.g., launch date, release dates)
  let markerSvg = "";

  // Handle single marker (backward compatibility) or array of markers
  const markers = Array.isArray(options.markers)
    ? options.markers
    : marker
      ? [marker]
      : [];

  markers.forEach((m) => {
    if (m && m.month && months.includes(m.month)) {
      const markerIndex = months.indexOf(m.month);
      const markerX = padding.left + markerIndex * xStep;
      const isMinor = m.type === "minor";

      if (isMinor) {
        // Minor marker: smaller, lighter styling
        markerSvg += `
          <line x1="${markerX}" y1="${padding.top}" x2="${markerX}" y2="${padding.top + chartHeight}" stroke="${COLORS.textMuted}" stroke-width="1" stroke-dasharray="4,4"/>
          <circle cx="${markerX}" cy="${padding.top - 5}" r="4" fill="${COLORS.textMuted}"/>
          <text x="${markerX}" y="${padding.top - 12}" text-anchor="middle" class="chart-marker-label-minor">${m.label}</text>
        `;
      } else {
        // Major marker: prominent styling
        markerSvg += `
          <line x1="${markerX}" y1="${padding.top}" x2="${markerX}" y2="${padding.top + chartHeight}" stroke="${COLORS.primary}" stroke-width="2" stroke-dasharray="6,3"/>
          <circle cx="${markerX}" cy="${padding.top - 8}" r="6" fill="${COLORS.primary}"/>
          <text x="${markerX + 10}" y="${padding.top + 15}" class="chart-marker-label">${m.label}</text>
        `;
      }
    }
  });

  return `
    <svg viewBox="0 0 ${width} ${height}" class="chart line-chart" role="img" aria-label="${title}">
      <title>${title}</title>
      ${title ? `<text x="${padding.left}" y="25" class="chart-title">${title}</text>` : ""}
      ${yLabels}
      ${xLabels}
      ${markerSvg}
      ${lines}
      ${legend}
    </svg>
  `;
}

function generateStatCard(label, value, subtext = "") {
  const formattedValue =
    typeof value === "number" ? formatNumber(value) : value;
  return `
    <div class="stat-card">
      <div class="stat-value">${formattedValue}</div>
      <div class="stat-label">${label}</div>
      ${subtext ? `<div class="stat-subtext">${subtext}</div>` : ""}
    </div>
  `;
}

// ============================================================================
// HTML Generation
// ============================================================================

function generateHTML(metrics) {
  const { entryTypes, authorContributions, categories, missingData } = metrics;

  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bundle Insights | 11ty Bundle</title>
  <link rel="stylesheet" href="insights.css">
</head>
<body>
  <header class="site-header">
    <div class="container">
      <a href="https://11tybundle.dev" class="back-link">← Back to 11ty Bundle</a>
      <h1>Bundle Insights</h1>
      <p class="generated-date">Generated on ${currentDate}</p>
    </div>
  </header>

  <main class="site-main">
    <!-- Entry Type Metrics -->
    <section class="section">
      <div class="container">
        <h2>Entry Types</h2>
        <p class="section-intro">Breakdown of content in the bundle database by type.</p>

        <div class="stats-row">
          ${generateStatCard("Blog Posts", entryTypes.counts["blog post"])}
          ${generateStatCard("Sites", entryTypes.counts["site"])}
          ${generateStatCard("Releases", entryTypes.counts["release"])}
          ${generateStatCard(
            "Total",
            Object.values(entryTypes.counts).reduce((a, b) => a + b, 0),
          )}
        </div>

        <div class="chart-container">
          <h3>Cumulative Growth Over Time</h3>
          ${generateLineChart(entryTypes.cumulative, entryTypes.months, {
            title: "",
            width: 900,
            height: 400,
            markers: [
              { month: "2022-01", label: "v1.0.0", type: "minor" },
              { month: "2023-02", label: "v2.0.0", type: "minor" },
              { month: "2023-05", label: "11tybundle.dev launch" },
              { month: "2024-10", label: "v3.0.0", type: "minor" },
            ],
          })}
        </div>
      </div>
    </section>

    <!-- Author Contributions -->
    <section class="section">
      <div class="container">
        <h2>Author Contributions</h2>
        <p class="section-intro">Distribution of authors by number of contributions.</p>

        <div class="chart-container">
          ${generateBarChart(authorContributions, {
            title: "Authors by Contribution Range",
            width: 600,
            height: 300,
            barColor: COLORS.tertiary,
          })}
        </div>
      </div>
    </section>

    <!-- Category Metrics -->
    <section class="section">
      <div class="container">
        <h2>Top 20 Categories</h2>
        <p class="section-intro">Most frequently used categories across all entries.</p>

        <div class="chart-container">
          ${generateBarChart(
            Object.fromEntries(categories.top20.map((c) => [c.name, c.count])),
            {
              title: "",
              width: 800,
              height: 500,
              horizontal: true,
              barColor: COLORS.secondary,
            },
          )}
        </div>

        <div class="chart-container chart-container--wide">
          <h3>Category Growth Over Time (Top 10)</h3>
          ${generateLineChart(
            Object.fromEntries(
              categories.top20
                .slice(0, 10)
                .map((c) => [c.name, categories.cumulative[c.name]]),
            ),
            categories.months,
            {
              title: "",
              width: 1000,
              height: 450,
              showLegend: true,
            },
          )}
        </div>
      </div>
    </section>

    <!-- Missing Data Metrics -->
    <section class="section">
      <div class="container">
        <h2>Data Completeness</h2>
        <p class="section-intro">Tracking missing metadata across the database (data accuracy not guaranteed).</p>

        <div class="stats-row stats-row--missing">
          ${generateStatCard(
            "Author Sites Missing RSS Link",
            missingData.missingRssLink,
            `of ${missingData.totalAuthors} authors`,
          )}
          ${generateStatCard(
            "Author Sites Missing Favicon",
            missingData.missingFavicon,
            `of ${missingData.totalAuthors} authors`,
          )}
          ${generateStatCard(
            "Author Sites Missing Description",
            missingData.missingAuthorSiteDescription,
            `of ${missingData.totalAuthors} authors`,
          )}
          ${generateStatCard(
            "Blog Posts Missing Description",
            missingData.missingBlogDescription,
            `of ${missingData.totalBlogPosts} posts`,
          )}
        </div>

        <!-- Details sections for missing items -->
        <div class="missing-details">
          <details class="disclosure" name="missing-data-accordion">
            <summary>View ${formatNumber(missingData.missingRssLink)} author sites missing RSS link</summary>
            <ul class="missing-list">
              ${missingData.authorsWithMissingRssLink
                .map(
                  (a) =>
                    `<li>${a.site ? `<a href="${a.site}" target="_blank" rel="noopener">${a.name}</a>` : a.name}</li>`,
                )
                .join("\n              ")}
            </ul>
          </details>

          <details class="disclosure" name="missing-data-accordion">
            <summary>View ${formatNumber(missingData.missingFavicon)} author sites missing favicon</summary>
            <ul class="missing-list">
              ${missingData.authorsWithMissingFavicon
                .map(
                  (a) =>
                    `<li>${a.site ? `<a href="${a.site}" target="_blank" rel="noopener">${a.name}</a>` : a.name}</li>`,
                )
                .join("\n              ")}
            </ul>
          </details>

          <details class="disclosure" name="missing-data-accordion">
            <summary>View ${formatNumber(missingData.missingAuthorSiteDescription)} author sites missing description</summary>
            <ul class="missing-list">
              ${missingData.authorsWithMissingDescription
                .map(
                  (a) =>
                    `<li>${a.site ? `<a href="${a.site}" target="_blank" rel="noopener">${a.name}</a>` : a.name}</li>`,
                )
                .join("\n              ")}
            </ul>
          </details>

          <details class="disclosure" name="missing-data-accordion">
            <summary>View ${formatNumber(missingData.missingBlogDescription)} blog posts missing description</summary>
            <ul class="missing-list">
              ${missingData.postsWithMissingDescription
                .map(
                  (p) =>
                    `<li><a href="${p.link}" target="_blank" rel="noopener">${p.title}</a></li>`,
                )
                .join("\n              ")}
            </ul>
          </details>
        </div>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="container">
      <p>Part of the <a href="https://11tybundle.dev">11ty Bundle</a> project</p>
    </div>
  </footer>
</body>
</html>`;
}

function generateCSS() {
  return `/* Bundle Insights Styles
 * Matching 11tybundle.dev design system
 */

:root {
  /* Font families */
  --font-default: Candara, "Noto Sans", source-sans-pro, sans-serif;
  --font-display-bold: "Optima", var(--font-default);
  --font-display-extrablack: "Optima", var(--font-default);
  --font-brand: "Courier New", monospace;

  /* Spacing (from Utopia fluid scale) */
  --space-3xs: clamp(0.3125rem, 0.2917rem + 0.0926vw, 0.375rem);
  --space-2xs: clamp(0.5625rem, 0.5208rem + 0.1852vw, 0.6875rem);
  --space-xs: clamp(0.875rem, 0.8125rem + 0.2778vw, 1.0625rem);
  --space-s: clamp(1.125rem, 1.0417rem + 0.3704vw, 1.375rem);
  --space-m: clamp(1.6875rem, 1.5625rem + 0.5556vw, 2.0625rem);
  --space-l: clamp(2.25rem, 2.0833rem + 0.7407vw, 2.75rem);
  --space-xl: clamp(3.375rem, 3.125rem + 1.1111vw, 4.125rem);

  /* Font sizes */
  --step--1: clamp(0.9375rem, 0.8833rem + 0.2407vw, 1.1rem);
  --step-0: clamp(1.125rem, 1.0417rem + 0.3704vw, 1.375rem);
  --step-1: clamp(1.35rem, 1.2271rem + 0.5463vw, 1.7188rem);
  --step-2: clamp(1.62rem, 1.4439rem + 0.7829vw, 2.1484rem);
  --step-3: clamp(1.944rem, 1.6968rem + 1.0986vw, 2.6855rem);

  /* Layout */
  --grid-max-width: 85.25rem;
  --grid-gutter: clamp(1.125rem, 0.5833rem + 2.4074vw, 2.75rem);

  /* Colors - Light theme */
  --surface-back: #faf8f5;
  --surface-mid: #f0ede8;
  --surface-fore: #e5e1da;
  --text-colour-1: #1a1a1a;
  --text-colour-2: #666666;
  --heading-colour-1: #c47328;
  --primary-5: #c47328;
}

@media (prefers-color-scheme: dark) {
  :root {
    --surface-back: #1a1a1a;
    --surface-mid: #252525;
    --surface-fore: #333333;
    --text-colour-1: #e8e6e3;
    --text-colour-2: #999999;
    --heading-colour-1: #e8a855;
    --primary-5: #e8a855;
  }
}

/* Reset */
*, *::before, *::after {
  box-sizing: border-box;
}

body, h1, h2, h3, p, figure {
  margin: 0;
}

/* Base */
html {
  scroll-behavior: smooth;
}

body {
  min-height: 100vh;
  line-height: 1.5;
  background: var(--surface-back);
  font-family: var(--font-default);
  font-size: var(--step-0);
  color: var(--text-colour-1);
  display: grid;
  grid-template-rows: auto 1fr auto;
}

h1, h2, h3 {
  font-family: var(--font-display-bold);
  color: var(--heading-colour-1);
  line-height: 1.2;
}

h1 {
  font-size: clamp(1.9438rem, 1.1929rem + 3.337vw, 3rem);
  font-family: var(--font-display-extrablack);
}

h2 {
  font-size: var(--step-3);
  margin-bottom: var(--space-xs);
}

h3 {
  font-size: var(--step-1);
  margin-bottom: var(--space-xs);
}

a {
  color: var(--primary-5);
  transition: color 150ms ease-in-out;
}

a:hover {
  color: var(--text-colour-1);
}

/* Layout */
.container {
  max-width: var(--grid-max-width);
  padding-inline: var(--grid-gutter);
  margin-inline: auto;
}

/* Header */
.site-header {
  padding-block: var(--grid-gutter);
  border-bottom: 1px solid var(--surface-fore);
  background: var(--surface-mid);
}

.site-header .container {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
}

.back-link {
  font-size: var(--step--1);
  text-decoration: none;
}

.generated-date {
  font-size: var(--step--1);
  color: var(--text-colour-2);
}

/* Main */
.site-main {
  padding-block: var(--grid-gutter);
}

.section {
  padding-block: var(--grid-gutter);
  border-bottom: 1px solid var(--surface-fore);
}

.section:last-child {
  border-bottom: none;
}

.section-intro {
  color: var(--text-colour-2);
  margin-bottom: var(--space-m);
}

/* Stats Row */
.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--grid-gutter);
  margin-bottom: var(--space-l);
}

.stat-card {
  background: var(--surface-mid);
  border: 1px solid var(--surface-fore);
  padding: var(--space-s);
  border-radius: 8px;
  text-align: center;
}

.stat-value {
  font-size: var(--step-3);
  font-family: var(--font-display-bold);
  color: var(--heading-colour-1);
  line-height: 1;
}

.stat-label {
  font-size: var(--step--1);
  color: var(--text-colour-2);
  margin-top: var(--space-3xs);
}

.stat-subtext {
  font-size: 0.85rem;
  color: var(--text-colour-2);
  margin-top: var(--space-3xs);
  opacity: 0.8;
}

/* Charts */
.chart-container {
  margin-bottom: var(--space-l);
  overflow-x: auto;
}

.chart-container--wide {
  max-width: 100%;
}

.chart {
  max-width: 100%;
  height: auto;
}

.chart-title {
  font-family: var(--font-display-bold);
  font-size: 16px;
  fill: var(--text-colour-1);
}

.chart-label {
  font-size: 11px;
  fill: var(--text-colour-2);
}

.chart-value {
  font-size: 12px;
  font-weight: bold;
  fill: var(--text-colour-1);
}

.chart-legend-label {
  font-size: 11px;
  fill: var(--text-colour-1);
}

.chart-marker-label {
  font-size: 11px;
  font-weight: bold;
  fill: var(--heading-colour-1);
}

.chart-marker-label-minor {
  font-size: 9px;
  fill: var(--text-colour-2);
}

/* Missing Data Details */
.missing-details {
  margin-top: var(--space-l);
  display: flex;
  flex-direction: column;
  gap: var(--space-s);
}

.disclosure {
  background: var(--surface-mid);
  border: 1px solid var(--surface-fore);
  border-radius: 8px;
}

.disclosure summary {
  padding: var(--space-s);
  cursor: pointer;
  font-family: var(--font-display-bold);
  color: var(--heading-colour-1);
  list-style: none;
}

.disclosure summary::-webkit-details-marker {
  display: none;
}

.disclosure summary::before {
  content: "▶";
  display: inline-block;
  margin-right: var(--space-xs);
  transition: transform 0.2s ease;
}

.disclosure[open] summary::before {
  transform: rotate(90deg);
}

.disclosure summary:hover {
  background: var(--surface-fore);
}

.missing-list {
  margin: 0;
  padding: var(--space-s);
  padding-top: 0;
  list-style: none;
  columns: 2;
  column-gap: var(--space-l);
}

@media (min-width: 768px) {
  .missing-list {
    columns: 3;
  }
}

.missing-list li {
  padding: var(--space-3xs) 0;
  font-size: var(--step--1);
  break-inside: avoid;
}

.missing-list a {
  color: var(--text-colour-1);
  text-decoration: underline;
  text-decoration-color: var(--surface-fore);
}

.missing-list a:hover {
  text-decoration-color: var(--primary-5);
}

/* Footer */
.site-footer {
  padding-block: var(--grid-gutter);
  background: var(--surface-mid);
  border-top: 1px solid var(--surface-fore);
  font-size: var(--step--1);
  color: var(--text-colour-2);
  text-align: center;
}

/* Responsive */
@media (max-width: 768px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }

  .chart {
    min-width: 600px;
  }
}
`;
}

// ============================================================================
// Main Execution
// ============================================================================

function main() {
  console.log("🔍 Loading production database...");
  const entries = loadDatabase();
  console.log(`   Loaded ${entries.length} entries`);

  console.log("📊 Computing metrics...");
  const metrics = {
    entryTypes: computeEntryTypeMetrics(entries),
    authorContributions: computeAuthorContributions(entries),
    categories: computeCategoryMetrics(entries),
    missingData: computeMissingDataMetrics(entries),
  };

  console.log("   Entry type counts:", metrics.entryTypes.counts);
  console.log("   Author contribution ranges:", metrics.authorContributions);
  console.log(
    "   Top categories:",
    metrics.categories.top20
      .slice(0, 5)
      .map((c) => c.name)
      .join(", "),
  );
  console.log("   Missing data:", metrics.missingData);

  console.log("📝 Generating HTML...");
  const html = generateHTML(metrics);

  console.log("🎨 Generating CSS...");
  const css = generateCSS();

  console.log("💾 Writing files...");

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, "index.html"), html);
  fs.writeFileSync(path.join(OUTPUT_DIR, "insights.css"), css);

  console.log(`\n✅ Done! Files written to ${OUTPUT_DIR}/`);
  console.log(`   - index.html`);
  console.log(`   - insights.css`);
  console.log(`\nOpen insights/index.html in a browser to view.`);
}

main();
