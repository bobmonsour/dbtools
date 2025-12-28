import { getRSSLink } from "../getrsslink.js";
import { processDbEntries } from "../db-processor.js";

await processDbEntries({
  typeFilter: "blog post",
  propertyToAdd: "rssLink",
  fetchFunction: getRSSLink,
  inputProperty: (item) => item.AuthorSite || item.Link,
  outputFilename: "bundledb-with-rsslinks.json",
  skipExisting: true,
  scriptName: "Blog Post RSS Link Fetcher",
});
