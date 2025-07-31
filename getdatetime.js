// Generate a date string that includes date and time in local timezone
const getCurrentDateTimeString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000`;
};

const getDefaultDate = () => {
  return getCurrentDateTimeString();
};

// If run directly from the command line, print the default date
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(getDefaultDate());
}

// Optionally export the function for use in other modules
export { getDefaultDate };
