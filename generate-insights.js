/**
 * Generate Bundle Insights Page
 *
 * Creates a static HTML page with SVG charts visualizing metrics
 * from the bundledb.json database.
 *
 * Run: node generate-insights.js
 */

import fs from "fs";
import path from "path";
import { rawlist } from "@inquirer/prompts";
import chalk from "chalk";

// Database paths (updated at runtime based on dataset selection)
let dbFilePath =
  "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb/bundledb.json";
let showcaseDataPath =
  "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb/showcase-data.json";
const OUTPUT_DIR = "./insights";

// Month when site jump should appear (11tybundle.dev redesign)
const SITE_JUMP_MONTH = "2026-01";

// ============================================================================
// Dataset Selection
// ============================================================================

const selectDataset = async () => {
  const datasetChoice = await rawlist({
    message: "Select which dataset to use:",
    choices: [
      { name: "Production dataset (11tybundledb)", value: "production" },
      {
        name: "Development dataset (devdata in this project)",
        value: "development",
      },
      { name: chalk.dim("Exit"), value: "exit" },
    ],
    default: "production",
  });

  // Handle exit
  if (datasetChoice === "exit") {
    console.log(chalk.yellow("\n👋 Exiting...\n"));
    process.exit(0);
  }

  // Update runtime configuration based on selection
  if (datasetChoice === "production") {
    dbFilePath =
      "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb/bundledb.json";
    showcaseDataPath =
      "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb/showcase-data.json";
    console.log(
      chalk.green("\n    ✓ Using Production dataset (11tybundledb)\n"),
    );
  } else {
    dbFilePath =
      "/Users/Bob/Dropbox/Docs/Sites/11tybundle/dbtools/devdata/bundledb.json";
    showcaseDataPath =
      "/Users/Bob/Dropbox/Docs/Sites/11tybundle/dbtools/devdata/showcase-data.json";
    console.log(chalk.green("\n    ✓ Using Development dataset (devdata)\n"));
  }
};

// ============================================================================
// Data Loading
// ============================================================================

function loadDatabase() {
  const data = fs.readFileSync(dbFilePath, "utf8");
  return JSON.parse(data);
}

function loadShowcaseData() {
  const data = fs.readFileSync(showcaseDataPath, "utf8");
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

function computeSiteJump(entries, showcaseData) {
  // Count showcase entries whose link is not found in any bundledb entry
  const bundleLinks = new Set(entries.filter((e) => !e.Skip).map((e) => e.Link));
  return showcaseData.filter((s) => !s.skip && !bundleLinks.has(s.link)).length;
}

function computeAuthorContributions(entries) {
  const filtered = entries.filter((e) => !e.Skip && e.Author);
  const authorData = {};

  filtered.forEach((e) => {
    if (!authorData[e.Author]) {
      authorData[e.Author] = {
        count: 0,
        site: e.AuthorSite || "",
      };
    }
    authorData[e.Author].count++;
    // Update site if we find one
    if (e.AuthorSite && !authorData[e.Author].site) {
      authorData[e.Author].site = e.AuthorSite;
    }
  });

  // Bucket into ranges
  const ranges = { "1-2": 0, "3-5": 0, "6-10": 0, "11-20": 0, "21+": 0 };
  Object.values(authorData).forEach(({ count }) => {
    if (count >= 21) ranges["21+"]++;
    else if (count >= 11) ranges["11-20"]++;
    else if (count >= 6) ranges["6-10"]++;
    else if (count >= 3) ranges["3-5"]++;
    else if (count >= 1) ranges["1-2"]++;
  });

  // Create sorted list of authors with 6+ contributions
  const prolificAuthors = Object.entries(authorData)
    .filter(([, data]) => data.count >= 6)
    .map(([name, data]) => ({ name, site: data.site, count: data.count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return { ranges, prolificAuthors };
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
    siteJump = null, // { month: "2026-01", amount: 796 }
  } = options;

  const padding = {
    top: 50,
    right: showLegend ? 180 : 30,
    bottom: 80,
    left: 70,
  };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Apply site jump to data if specified (modifies the cumulative values from jump month onward)
  let processedData = data;
  if (siteJump && siteJump.amount > 0 && data["site"]) {
    processedData = { ...data };
    processedData["site"] = { ...data["site"] };
    const jumpMonthIndex = months.indexOf(siteJump.month);
    if (jumpMonthIndex >= 0) {
      // Add jump amount to all months from jump month onward
      months.forEach((month, i) => {
        if (i >= jumpMonthIndex) {
          processedData["site"][month] =
            (data["site"][month] || 0) + siteJump.amount;
        }
      });
    }
  }

  // Find max value across all series
  let maxValue = 0;
  Object.values(processedData).forEach((series) => {
    Object.values(series).forEach((val) => {
      if (val > maxValue) maxValue = val;
    });
  });

  const seriesNames = Object.keys(processedData);
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
    yLabels += `<text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" class="chart-label">${formatNumber(val)}</text>`;
    yLabels += `<line x1="${padding.left}" y1="${y}" x2="${padding.left + chartWidth}" y2="${y}" stroke="#ddd" stroke-dasharray="2,2"/>`;
  }

  // Generate lines for each series
  let lines = "";
  let legend = "";

  seriesNames.forEach((name, seriesIndex) => {
    const series = processedData[name];
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
      // Add superscripts for "site" (if siteJump is active) and "release"
      let legendLabel = name;
      if (name === "site" && siteJump && siteJump.amount > 0) {
        legendLabel = `${name}<tspan baseline-shift="super" font-size="8">1</tspan>`;
      } else if (name === "release") {
        legendLabel = `${name}<tspan baseline-shift="super" font-size="8">2</tspan>`;
      }
      legend += `<text x="${width - padding.right + 28}" y="${legendY + 3}" class="chart-legend-label">${legendLabel}</text>`;
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
          <text x="${markerX}" y="${padding.top - 28}" text-anchor="middle" class="chart-marker-label-minor">11ty</text>
          <text x="${markerX}" y="${padding.top - 16}" text-anchor="middle" class="chart-marker-label-minor">${m.label}</text>
        `;
      } else {
        // Major marker: prominent styling
        // Split label into two lines if it contains a space
        const labelParts = m.label.split(" ");
        const line1 = labelParts.slice(0, -1).join(" ");
        const line2 = labelParts[labelParts.length - 1];
        // Position label above chart, center "launch" under "11tybundle.dev"
        const line1X = markerX + 10;
        const line1Width = 90; // approximate width of "11tybundle.dev"
        const line2CenterX = line1X + line1Width / 2;
        markerSvg += `
          <line x1="${markerX}" y1="${padding.top}" x2="${markerX}" y2="${padding.top + chartHeight}" stroke="${COLORS.primary}" stroke-width="2" stroke-dasharray="6,3"/>
          <circle cx="${markerX}" cy="${padding.top - 8}" r="6" fill="${COLORS.primary}"/>
          <text x="${line1X}" y="${padding.top - 28}" class="chart-marker-label">${line1}</text>
          <text x="${line2CenterX}" y="${padding.top - 15}" class="chart-marker-label chart-marker-label-centered">${line2}</text>
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
  const { entryTypes, authorContributions, categories, missingData, siteJump } =
    metrics;

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
  <title>11ty Bundle Insights | 11ty Bundle</title>
  <link rel="stylesheet" href="insights.css">
</head>
<body>
  <header class="site-header">
    <div class="container">
      <a href="https://11tybundle.dev" class="back-link">← Back to 11ty Bundle</a>
      <h1>11ty Bundle Insights</h1>
      <p class="generated-date">Generated on ${currentDate} &middot; Accuracy not guaranteed.</p>
    </div>
  </header>

  <main class="site-main">
    <!-- Entry Type Metrics -->
    <section class="section">
      <div class="container">
        <h2>Entry Types</h2>
        <p class="section-intro">Breakdown of content in the bundle databases by type.</p>

        <div class="stats-row">
          ${generateStatCard("Blog Posts", entryTypes.counts["blog post"])}
          ${generateStatCard("Sites", entryTypes.counts["site"] + (siteJump?.amount || 0))}
          ${generateStatCard("Releases", entryTypes.counts["release"])}
          ${generateStatCard(
            "Total",
            Object.values(entryTypes.counts).reduce((a, b) => a + b, 0) +
              (siteJump?.amount || 0),
          )}
        </div>

        <div class="chart-container">
          <h3>Cumulative entry growth over time</h3>
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
            siteJump: siteJump,
          })}
          ${siteJump && siteJump.amount > 0 ? `<p class="chart-footnote"><sup>1</sup> This jump represents the addition of sites from the <a href="https://www.11ty.dev/speedlify/">11ty Leaderboard</a> that were added at the time of the 11tybundle.dev redesign in January 2026.</p>` : ""}
          <p class="chart-footnote"><sup>2</sup> Release count includes selected releases starting in January 2023.</p>
        </div>

        <div class="chart-container chart-container--wide">
          <h3>Blog post category growth over time (top 15, excludes "How to...")</h3>
          ${generateLineChart(
            Object.fromEntries(
              categories.top20
                .slice(0, 15)
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

        <h3>Top 15 categories</h3>
        <p class="section-intro">Most frequently used categories across all entries (excludes "How to...").</p>

        <div class="chart-container">
          ${generateBarChart(
            Object.fromEntries(
              categories.top20.slice(0, 15).map((c) => [c.name, c.count]),
            ),
            {
              title: "",
              width: 800,
              height: 500,
              horizontal: true,
              barColor: COLORS.secondary,
            },
          )}
        </div>
      </div>
    </section>

    <!-- Author Contributions -->
    <section class="section">
      <div class="container">
        <h2>Author Contributions</h2>
        <p class="section-intro">Distribution of authors by number of contributions.</p>

        <div class="chart-container">
          ${generateBarChart(authorContributions.ranges, {
            title: "Authors by contribution range",
            width: 600,
            height: 300,
            barColor: COLORS.tertiary,
          })}
        </div>

        <p  class="section-intro">Authors with 6+ contributions (names are links to their sites)</p>
        <ul class="author-list">
          ${authorContributions.prolificAuthors
            .map((a) =>
              a.site
                ? `<li><a href="${a.site}" target="_blank" rel="noopener">${a.name}</a></li>`
                : `<li>${a.name}</li>`,
            )
            .join("\n          ")}
        </ul>
      </div>
    </section>

    <!-- Missing Data Metrics -->
    <section class="section">
      <div class="container">
        <h2>Data completeness</h2>
        <p class="section-intro">Tracking missing metadata across the database (accuracy not guaranteed).</p>

        <div class="stats-row stats-row--missing">
          ${generateStatCard(
            "Author sites missing RSS link",
            `${missingData.missingRssLink} <span class="stat-percent">(${((missingData.missingRssLink / missingData.totalAuthors) * 100).toFixed(1)}%)</span>`,
            `of ${missingData.totalAuthors} authors`,
          )}
          ${generateStatCard(
            "Author sites missing favicon",
            `${missingData.missingFavicon} <span class="stat-percent">(${((missingData.missingFavicon / missingData.totalAuthors) * 100).toFixed(1)}%)</span>`,
            `of ${missingData.totalAuthors} authors`,
          )}
          ${generateStatCard(
            "Author sites missing description",
            `${missingData.missingAuthorSiteDescription} <span class="stat-percent">(${((missingData.missingAuthorSiteDescription / missingData.totalAuthors) * 100).toFixed(1)}%)</span>`,
            `of ${missingData.totalAuthors} authors`,
          )}
          ${generateStatCard(
            "Blog posts missing description",
            `${missingData.missingBlogDescription} <span class="stat-percent">(${((missingData.missingBlogDescription / missingData.totalBlogPosts) * 100).toFixed(1)}%)</span>`,
            `of ${formatNumber(missingData.totalBlogPosts)} posts`,
          )}
        </div>

        <!-- Details sections for missing items -->
        <div class="missing-details">
          <details class="disclosure" name="missing-data-accordion">
            <summary>View ${formatNumber(missingData.missingRssLink)} author sites missing RSS link</summary>
            <p class="disclosure-intro">I attempt to examine your site to find an RSS link, but sometimes I can't find it automatically. If you know your site has an RSS feed, perhaps you're not using one of the well-known techniques for exposing it. Here are two blog posts that describe how to do this: <a href="https://chriscoyier.net/2024/01/13/exposed-rss/" target="_blank" rel="noopener">Exposed RSS</a> by Chris Coyier, and <a href="https://rknight.me/blog/please-expose-your-rss/" target="_blank" rel="noopener">Please, Expose your RSS</a> by Robb Knight.</p>
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
            <p class="disclosure-intro">I attempt to examine your site to find a favicon for your site, but sometimes I can't find it automatically. If you want to know how to add one, here are two blog posts that describe how to do this: <a href="https://equk.co.uk/2023/07/14/favicon-generation-in-eleventy/" target="_blank" rel="noopener">Favicon Generation In Eleventy</a> by equilibriumuk, and <a href="https://bnijenhuis.nl/notes/adding-a-favicon-in-eleventy/" target="_blank" rel="noopener">Adding a favicon in Eleventy</a> by Bernard Nijenhuis.</p>
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
            <p class="disclosure-intro">I attempt to examine your site to find a description for your blog post or site, but sometimes I can't find it automatically. If you want to know how to add one, here are two resources that describe how to do this: <a href="https://learn-eleventy.pages.dev/lesson/17/" target="_blank" rel="noopener">Lesson 17: Meta info, RSS feeds and module recap</a> and <a href="https://johnwargo.com/posts/2023/meta-keywords-in-eleventy/" target="_blank" rel="noopener">Meta Description and Keywords in Eleventy</a> by John M. Wargo.</p>
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
            <p class="disclosure-intro">I attempt to examine your site to find a description for your blog post or site, but sometimes I can't find it automatically. If you want to know how to add one, here are two resources that describe how to do this: <a href="https://learn-eleventy.pages.dev/lesson/17/" target="_blank" rel="noopener">Lesson 17: Meta info, RSS feeds and module recap</a> and <a href="https://johnwargo.com/posts/2023/meta-keywords-in-eleventy/" target="_blank" rel="noopener">Meta Description and Keywords in Eleventy</a> by John M. Wargo.</p>
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

.stat-percent {
  font-size: 0.5em;
  color: var(--text-colour-2);
  font-weight: normal;
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
  font-size: 12px;
  font-weight: normal;
  fill: var(--heading-colour-1);
}

.chart-marker-label-centered {
  text-anchor: middle;
}

.chart-marker-label-minor {
  font-size: 9px;
  fill: var(--text-colour-2);
}

/* Chart Footnote */
.chart-footnote {
  font-size: var(--step--1);
  color: var(--text-colour-2);
  margin-top: 0;
  font-style: italic;
}

.chart-footnote sup {
  font-size: 0.75em;
  margin-right: 0.2em;
}

.chart-footnote a {
  color: var(--primary-5);
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

.disclosure-intro {
  margin: 0 var(--space-s) var(--space-s);
  padding: var(--space-s);
  font-size: var(--step--1);
  color: var(--text-colour-2);
  background: var(--surface-fore);
  border-radius: 4px;
  line-height: 1.5;
}

.disclosure-intro a {
  color: var(--link-colour);
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

.author-list-title {
  font-size: var(--step-0);
  color: var(--heading-colour-1);
  margin-top: var(--space-l);
  margin-bottom: var(--space-s);
}

.author-list {
  margin: 0;
  padding: 0;
  list-style: none;
  columns: 2;
  column-gap: var(--space-l);
}

@media (min-width: 768px) {
  .author-list {
    columns: 4;
  }
}

.author-list li {
  padding: var(--space-3xs) 0;
  font-size: var(--step--1);
  break-inside: avoid;
}

.author-list a {
  color: var(--text-colour-1);
  text-decoration: underline;
  text-decoration-color: var(--surface-fore);
}

.author-list a:hover {
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

async function main() {
  // Prompt for dataset selection
  await selectDataset();

  console.log("🔍 Loading database...");
  const entries = loadDatabase();
  console.log(`   Loaded ${entries.length} entries`);

  console.log("� Loading showcase data...");
  const showcaseData = loadShowcaseData();
  console.log(`   Loaded ${showcaseData.length} showcase entries`);

  console.log("📊 Computing metrics...");
  const entryTypes = computeEntryTypeMetrics(entries);
  const siteJumpAmount = computeSiteJump(entries, showcaseData);
  console.log(
    `   Site jump: ${siteJumpAmount} (showcase: ${showcaseData.length} - sites: ${entryTypes.counts["site"]})`,
  );

  const metrics = {
    entryTypes,
    authorContributions: computeAuthorContributions(entries),
    categories: computeCategoryMetrics(entries),
    missingData: computeMissingDataMetrics(entries),
    siteJump: { month: SITE_JUMP_MONTH, amount: siteJumpAmount },
  };

  console.log("   Entry type counts:", metrics.entryTypes.counts);
  console.log(
    "   Author contribution ranges:",
    metrics.authorContributions.ranges,
  );
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

main().catch(console.error);
