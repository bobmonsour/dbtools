import { input } from "@inquirer/prompts";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";
import { exec } from "child_process";
import util from "util";

const execPromise = util.promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Path to the template file
const templatePath = path.join(__dirname, "11ty-bundle-xx.md");

// Path to the 11tybundle.dev blog directory
const blogBasePath = path.join(__dirname, "../11tybundle.dev/content/blog");

/**
 * Main function to create a new blog post
 */
async function createBlogPost() {
  console.log(chalk.blue.bold("\n=== Create 11ty Bundle Blog Post ===\n"));

  try {
    // Step 1: Prompt for issue number
    const issueNumber = await input({
      message: "Enter the issue number:",
      validate: (value) => {
        const num = parseInt(value, 10);
        if (isNaN(num) || num <= 0) {
          return "Please enter a valid positive number";
        }
        return true;
      },
    });

    // Step 2: Prompt for publication date
    const publicationDate = await input({
      message: "Enter the publication date (YYYY-MM-DD):",
      default: new Date().toISOString().split("T")[0],
      validate: (value) => {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(value)) {
          return "Please enter a valid date in YYYY-MM-DD format";
        }
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          return "Please enter a valid date";
        }
        return true;
      },
    });

    // Extract year from publication date
    const year = new Date(publicationDate).getFullYear();

    // Step 3: Prepare file path
    const yearDir = path.join(blogBasePath, year.toString());
    const fileName = `11ty-bundle-${issueNumber.padStart(2, "0")}.md`;
    const filePath = path.join(yearDir, fileName);

    // Check if file already exists
    if (fs.existsSync(filePath)) {
      console.log(chalk.red(`\n❌ File already exists: ${filePath}`));
      console.log(
        chalk.yellow(
          "Please choose a different issue number or delete the existing file.\n",
        ),
      );
      return;
    }

    // Create year directory if it doesn't exist
    if (!fs.existsSync(yearDir)) {
      console.log(chalk.yellow(`Creating directory: ${yearDir}`));
      fs.mkdirSync(yearDir, { recursive: true });
    }

    // Step 4: Read and populate template
    let templateContent = fs.readFileSync(templatePath, "utf-8");

    // Replace bundleIssue and date in the template
    templateContent = templateContent.replace(
      /^bundleIssue:\s*$/m,
      `bundleIssue: ${issueNumber}`,
    );
    templateContent = templateContent.replace(
      /^date:\s*$/m,
      `date: ${publicationDate}`,
    );

    // Write the new blog post file
    fs.writeFileSync(filePath, templateContent, "utf-8");

    console.log(chalk.green(`\n✅ Blog post created successfully!`));
    console.log(chalk.cyan(`   File: ${filePath}\n`));

    // Step 5: Open the file in VS Code
    try {
      await execPromise(`code "${filePath}"`);
      console.log(chalk.blue("📝 Opening file in VS Code...\n"));
    } catch (error) {
      console.log(
        chalk.yellow("⚠️  Could not open file in VS Code automatically."),
      );
      console.log(chalk.yellow(`   Please open manually: ${filePath}\n`));
    }
  } catch (error) {
    if (error.name === "ExitPromptError") {
      console.log(chalk.yellow("\n❌ Operation cancelled by user.\n"));
      return;
    }
    console.error(chalk.red("\n❌ Error creating blog post:"), error.message);
    console.error(error);
  }
}

// Run the script
createBlogPost();
