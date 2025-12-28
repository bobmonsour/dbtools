import { getDescription } from "../getdescription.js";
import { processDbEntries } from "../db-processor.js";

await processDbEntries({
  typeFilter: "release",
  propertyToAdd: "description",
  fetchFunction: getDescription,
  inputProperty: "Link",
  outputFilename: "bundledb-with-release-descriptions.json",
  skipExisting: true,
  scriptName: "Release Description Fetcher",
});
