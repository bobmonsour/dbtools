import { getFavicon } from "../getfavicon.js";
import { processDbEntries } from "../db-processor.js";

await processDbEntries({
  typeFilter: "blog post",
  propertyToAdd: "favicon",
  fetchFunction: getFavicon,
  inputProperty: (item) => [
    item.AuthorSite || item.Link, // first arg: the link
    "post", // second arg: the type
  ],
  outputFilename: "bundledb-with-post-favicons.json",
  skipExisting: true,
  scriptName: "Blog Post Favicon Fetcher",
});
