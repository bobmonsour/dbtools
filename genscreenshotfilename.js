export const genScreenshotFilename = async (link) => {
  const url = new URL(link);
  const domain = url.hostname.replace(/[./]/g, "-");
  const filename = `${domain}-large.jpg`;
  return { domain, filename, url };
};
