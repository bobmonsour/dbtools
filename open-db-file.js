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

    // Wait a moment for VS Code to open, then close the terminal window
    setTimeout(async () => {
      try {
        // Close the terminal window using AppleScript
        await execPromise(
          `osascript -e 'tell application "Terminal" to close front window'`
        );
      } catch (err) {
        // If AppleScript fails, just exit the process
        console.log("Could not close terminal window automatically");
        process.exit(0);
      }
    }, 2000); // Wait 2 seconds to ensure VS Code has time to open
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
