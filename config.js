// Set up required configuration to support the 11ty Bundle database utilities
const useTestData = true; // Set to false to use production data
let config;

if (useTestData) {
  config = {
    // Use the following for testing
    dbFileDir: "/Users/Bob/Dropbox/Docs/Sites/11tybundle/dbtools/devdata",
    dbFilename: "bundledb.json",
    dbFilePath:
      "/Users/Bob/Dropbox/Docs/Sites/11tybundle/dbtools/devdata/bundledb.json",
    dbBackupDir:
      "/Users/Bob/Dropbox/Docs/Sites/11tybundle/dbtools/devdata/bundledb-backups",
    showcaseBackupDir:
      "/Users/Bob/Dropbox/Docs/Sites/11tybundle/dbtools/devdata/showcase-data-backups",
    badLinksDir:
      "/Users/Bob/Dropbox/Docs/Sites/11tybundle/dbtools/devdata/badlinks",
    issueRecordsPath:
      "/Users/Bob/Dropbox/Docs/Sites/11tybundle/dbtools/devdata/issuerecords.json",
    communityDataPath:
      "/Users/Bob/Dropbox/Docs/Sites/11tybundle/dbtools/devdata/community-data.json",
    showcaseDataPath:
      "/Users/Bob/Dropbox/Docs/Sites/11tybundle/dbtools/devdata/showcase-data.json",
  };
} else {
  config = {
    dbFileDir: "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb",
    dbFilename: "bundledb.json",
    dbFilePath:
      "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb/bundledb.json",
    dbBackupDir:
      "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb/bundledb-backups",
    showcaseBackupDir:
      "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb/showcase-data-backups",
    badLinksDir:
      "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb/badlinks",
    issueRecordsPath:
      "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb/issuerecords.json",
    communityDataPath:
      "/Users/Bob/Dropbox/Docs/Sites/11tybundle/dbtools/devdata/community-data.json",
    showcaseDataPath:
      "/Users/Bob/Dropbox/Docs/Sites/11tybundle/11tybundledb/showcase-data.json",
  };
}

export { config };
