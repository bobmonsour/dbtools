import { getDescription } from "../getdescription.js";
import { processDbEntries } from "../db-processor.js";

await processDbEntries({
  typeFilter: "blog post",
  propertyToAdd: "description",
  fetchFunction: getDescription,
  inputProperty: "Link",
  outputFilename: "bundledb-with-post-descriptions.json",
  skipExisting: true,
  scriptName: "Blog Post Description Fetcher",
});
