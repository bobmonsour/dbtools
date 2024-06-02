import readline from "readline";
import inquirer from "inquirer";

let rl;

function initializeReadline() {
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function closeReadline() {
  if (rl) {
    rl.close();
  }
}

async function promptUser(query) {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer);
    });
  });
}

async function editJsonObject(jsonObject) {
  try {
    // Iterate through each key-value pair
    for (const [key, value] of Object.entries(jsonObject)) {
      const userInput = await promptUser(
        `Current value for "${key}" is "${value}". Press Enter to accept or type a new value: `
      );
      if (userInput) {
        jsonObject[key] = userInput;
      }
    }

    // Return the edited JSON object
    return jsonObject;
  } catch (error) {
    console.error("Error:", error);
  } finally {
    closeReadline();
  }
}

async function main() {
  // Use inquirer to capture initial key-value pairs
  closeReadline(); // Close readline before using inquirer
  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "key1",
      message: "Enter value for key1:",
      default: "value1",
    },
    {
      type: "input",
      name: "key2",
      message: "Enter value for key2:",
      default: "value2",
    },
    {
      type: "input",
      name: "key3",
      message: "Enter value for key3:",
      default: "value3",
    },
  ]);

  // Create the initial JSON object
  const initialJsonObject = answers;

  // Reinitialize readline for further editing
  initializeReadline();

  // Allow user to edit the JSON object using readline
  const editedJsonObject = await editJsonObject(initialJsonObject);
  console.log("Edited JSON object:", JSON.stringify(editedJsonObject, null, 2));
}

initializeReadline();
main();
