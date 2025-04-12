import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  chats: defineTable({
    userId: v.id("users"),
    threadId: v.string(),
    updateTitlesScheduledFunctionId: v.optional(v.id("_scheduled_functions")),
  }).index("by_threadId", ["threadId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
