import { getFavicon } from "../getfavicon.js";
import { processDbEntries } from "../db-processor.js";

await processDbEntries({
  typeFilter: "site",
  propertyToAdd: "favicon",
  fetchFunction: getFavicon,
  inputProperty: (item) => [
    item.Link, // first arg: the link
    "site", // second arg: the type
  ],
  outputFilename: "bundledb-with-site-favicons.json",
  skipExisting: true,
  scriptName: "Site Favicon Fetcher",
});
