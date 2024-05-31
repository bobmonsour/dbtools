import * as fs from "node:fs";
import { promises as fsPromises } from "node:fs";
import axios from "axios";
import chalk from "chalk";
import { format } from "date-fns";
import Bottleneck from "bottleneck";
import { performance } from "perf_hooks";
import { config } from "./config.js";

// Get the location of the bundle database file
// and the location of where to put the bad links file
const dbFilePath = config.dbFilePath;
const badLinksDir = config.badLinksDir;

// Function to check if URL is accessible
const checkUrlAccessibility = async (url) => {
  try {
    await axios.head(url);
    return true;
  } catch (err) {
    return false;
  }
};

// Function to create a directory if it doesn't exist
async function createDirIfNotExists(dir) {
  try {
    await fsPromises.mkdir(dir, { recursive: true });
    // console.log(`Directory '${dir}' created or already exists.`);
  } catch (err) {
    console.error(`Error creating directory '${dir}':`, err);
  }
}

// Function to read the JSON file and verify the accessibility of each Link
const verifyLinks = async () => {
  try {
    await createDirIfNotExists(badLinksDir);
    // Read the JSON file
    const data = fs.readFileSync(dbFilePath, "utf8");
    const jsonData = JSON.parse(data);

    // Initialize counters and array for inaccessible links
    let accessibleCount = 0;
    let inaccessibleCount = 0;
    const badLinks = [];

    // Create a limiter to control the number of concurrent requests
    const limiter = new Bottleneck({
      maxConcurrent: 500, // Adjust the number of concurrent requests as needed
    });

    // Iterate over each item and check the accessibility of the Link
    const promises = jsonData.map((item) => {
      return limiter.schedule(async () => {
        const isAccessible = await checkUrlAccessibility(item.Link);
        if (isAccessible) {
          accessibleCount++;
        } else {
          inaccessibleCount++;
          console.log(
            chalk.red(`${inaccessibleCount}. Link inaccessible: ${item.Link}`)
          );
          badLinks.push(item.Link);
        }
      });
    });

    // Wait for all promises to complete
    await Promise.all(promises);

    // Output the total number of accessible and inaccessible links
    console.log(
      chalk.green(`Total number of accessible links: ${accessibleCount}`)
    );
    console.log(
      chalk.red(`Total number of inaccessible links: ${inaccessibleCount}`)
    );

    // Write the array of inaccessible links to a new HTML file
    const currentDate = format(new Date(), "yyyy-MM-dd");
    const badLinksFilePath = `${badLinksDir}/badlinks-${currentDate}.html`;
    const htmlContent = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Bad Links Report</title>
            </head>
            <body>
                <h1>Bad Links Report</h1>
                <ul>
                    ${badLinks
                      .map(
                        (link) =>
                          `<li><a href="${link}" target="_blank">${link}</a></li>`
                      )
                      .join("")}
                </ul>
            </body>
            </html>
        `;
    fs.writeFileSync(badLinksFilePath, htmlContent, "utf8");
    console.log(
      chalk.green(`Inaccessible links have been written to ${badLinksFilePath}`)
    );
  } catch (error) {
    console.error(
      chalk.red("Error reading or processing the JSON file:", error)
    );
  }
};

// Measure the execution time of the verifyLinks function
const measureExecutionTime = async () => {
  console.log(
    chalk.blue("Verifying the accessibility of links in bundledb.json...")
  );
  const start = performance.now();
  await verifyLinks();
  const end = performance.now();
  const executionTime = ((end - start) / 1000).toFixed(2);
  console.log(chalk.blue(`Total execution time: ${executionTime} seconds`));
};

// Run the measurement function
measureExecutionTime().catch((error) => {
  console.error(chalk.red("An error occurred:", error));
});
