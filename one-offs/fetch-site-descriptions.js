import { getDescription } from "../getdescription.js";
import { processDbEntries } from "../db-processor.js";

await processDbEntries({
  typeFilter: "site",
  propertyToAdd: "description",
  fetchFunction: getDescription,
  inputProperty: "Link",
  outputFilename: "bundledb-with-site-descriptions.json",
  skipExisting: true,
  scriptName: "Site Description Fetcher",
});
