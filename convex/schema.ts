import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import { vProviderMetadata, vUsage } from "@convex-dev/agent";

const applicationTables = {
  chats: defineTable({
    userId: v.id("users"),
    threadId: v.string(),
    updateTitlesScheduledFunctionId: v.optional(v.id("_scheduled_functions")),
  }).index("by_threadId", ["threadId"]),

  // If you want to track usage on a granular level, you could do something like this:
  rawUsage: defineTable({
    userId: v.id("users"),
    agentName: v.optional(v.string()),
    model: v.string(),
    provider: v.string(),

    // stats
    usage: vUsage,
    providerMetadata: vProviderMetadata,

    // This can be something like the timestamp of the hour this usage occurred
    // in or the first day of the current month, if you bill monthly.
    // You can then fetch all the usage at the end of the billing period
    // and calculate the total cost.
    billingPeriod: v.optional(v.number()), // When the usage period ended
  }).index("billingPeriod_userId", ["billingPeriod", "userId"]),

  invoices: defineTable({
    userId: v.id("users"),
    billingPeriod: v.number(),
    totalCost: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("paid"),
      v.literal("failed")
    ),
  }).index("billingPeriod_userId", ["billingPeriod", "userId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
