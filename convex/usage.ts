import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { vProviderMetadata, vUsage } from "@convex-dev/agent";

export const insertRawUsage = internalMutation({
  args: {
    userId: v.id("users"),
    agentName: v.optional(v.string()),
    model: v.string(),
    provider: v.string(),
    usage: vUsage,
    providerMetadata: vProviderMetadata,
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    // Round down to the current hour in ms since epoch
    const billingPeriod = now - (now % (60 * 60 * 1000));
    return await ctx.db.insert("rawUsage", {
      ...args,
      billingPeriod,
    });
  },
});
