import { config } from "./config.js";
import { exec } from "child_process";
import util from "util";
import path from "path";

const execPromise = util.promisify(exec);

const openDbFileInVSCode = async () => {
  try {
    // Construct the full path to the database file
    const dbFilePath = path.join(config.dbFileDir, config.dbFilename);

    console.log(`Opening ${dbFilePath} in a new VS Code window...`);

    // Use the 'code' command with --new-window flag to open the file in a new VS Code window
    await execPromise(`code --new-window "${dbFilePath}"`);

    console.log("File opened successfully in a new VS Code window!");

    // Close the terminal window after a brief delay
    setTimeout(() => {
      process.exit(0);
    }, 1000); // Wait 1 second before closing
  } catch (error) {
    console.error("Error opening file in VS Code:", error.message);
    console.log(
      "Make sure VS Code is installed and the 'code' command is available in your PATH."
    );
    // Exit with error code
    process.exit(1);
  }
};

// Run the function if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  openDbFileInVSCode();
}

export { openDbFileInVSCode };
