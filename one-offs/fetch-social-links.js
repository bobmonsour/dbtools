import { getSocialLinks } from "../getsociallinks.js";
import { processDbEntries } from "../db-processor.js";

await processDbEntries({
  typeFilter: "blog post",
  propertyToAdd: "socialLinks",
  fetchFunction: getSocialLinks,
  inputProperty: (item) => item.AuthorSite || item.Link,
  outputFilename: "bundledb-with-sociallinks.json",
  skipExisting: true,
  scriptName: "Blog Post Social Link Fetcher",
});
