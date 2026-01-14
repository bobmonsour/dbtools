// Test script to verify description extraction from cita.hr
import { getDescription } from "./getdescription.js";

const url = "https://www.cita.hr/en/";

console.log(`Testing description extraction for: ${url}\n`);

try {
  const description = await getDescription(url);
  if (description) {
    console.log("✅ Description found:");
    console.log(description);
  } else {
    console.log("❌ No description found (returned empty string)");
  }
} catch (error) {
  console.error("❌ Error:", error.message);
}
