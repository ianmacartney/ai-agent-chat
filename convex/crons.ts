import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Generate invoices for the previous month
crons.monthly(
  "generateInvoices",
  // Wait a day after the new month starts to generate invoices
  { day: 2, hourUTC: 0, minuteUTC: 0 },
  internal.usage.generateInvoices,
  {}
);

export default crons;
