import { internalMutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import {
  ProviderMetadata,
  Usage,
  vProviderMetadata,
  vUsage,
} from "@convex-dev/agent";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

const HOUR_IN_MS = 60 * 60 * 1000;

function getBillingPeriod(at: number) {
  const now = new Date(at);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth());
  return startOfMonth.toISOString().split("T")[0];
}

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
    const billingPeriod = getBillingPeriod(Date.now());
    return await ctx.db.insert("rawUsage", {
      ...args,
      billingPeriod,
    });
  },
});

/**
 * Called from a cron monthly to calculate the
 * invoices for the previous billing period
 */
export const generateInvoices = internalMutation({
  args: {
    billingPeriod: v.optional(v.string()),
    cursor: v.optional(v.string()),
    inProgress: v.optional(
      v.object({
        userId: v.id("users"),
        usage: vUsage,
        providerMetadata: vProviderMetadata,
      })
    ),
  },
  handler: async (ctx, args) => {
    // Assume we're billing within a week of the previous billing period
    const weekAgo = Date.now() - 7 * 24 * HOUR_IN_MS;
    const billingPeriod = args.billingPeriod ?? getBillingPeriod(weekAgo);

    const result = await ctx.db
      .query("rawUsage")
      .withIndex("billingPeriod_userId", (q) =>
        q.eq("billingPeriod", billingPeriod)
      )
      .paginate({
        cursor: args.cursor ?? null,
        numItems: 100,
      });
    let currentInvoice = args.inProgress;
    for (const { userId, usage, providerMetadata } of result.page) {
      if (!currentInvoice) {
        currentInvoice = {
          userId,
          usage,
          providerMetadata,
        };
      } else if (userId !== currentInvoice.userId) {
        await createInvoice(ctx, currentInvoice, billingPeriod);
        currentInvoice = {
          userId,
          usage,
          providerMetadata,
        };
      } else {
        currentInvoice.usage.promptTokens += usage.promptTokens;
        currentInvoice.usage.completionTokens += usage.completionTokens;
        currentInvoice.usage.totalTokens += usage.totalTokens;
        if (!providerMetadata?.openai) {
          // Do nothing
        } else if (!currentInvoice.providerMetadata?.openai) {
          currentInvoice.providerMetadata = providerMetadata;
        } else {
          currentInvoice.providerMetadata.openai.cachedPromptTokens =
            (currentInvoice.providerMetadata.openai.cachedPromptTokens ?? 0) +
            (providerMetadata.openai.cachedPromptTokens ?? 0);
        }
      }
    }
    if (result.isDone) {
      if (currentInvoice) {
        await createInvoice(ctx, currentInvoice, billingPeriod);
      }
    } else {
      await ctx.runMutation(internal.usage.generateInvoices, {
        billingPeriod,
        cursor: result.continueCursor,
        inProgress: currentInvoice,
      });
    }
  },
});

const MILLION = 1000000;

const PRICING = {
  openai: {
    "gpt-4o-mini": {
      inputPrice: 0.3,
      cachedInputPrice: 0.15,
      outputPrice: 1.2,
    },
  },
};

async function createInvoice(
  ctx: MutationCtx,
  invoice: {
    userId: Id<"users">;
    usage: Usage;
    providerMetadata?: ProviderMetadata;
  },
  billingPeriod: string
) {
  const { inputPrice, cachedInputPrice, outputPrice } =
    PRICING.openai["gpt-4o-mini"];
  const cachedPromptTokens =
    invoice.providerMetadata?.openai?.cachedPromptTokens ?? 0;
  const amount =
    ((invoice.usage.promptTokens - cachedPromptTokens) / MILLION) * inputPrice +
    (cachedPromptTokens / MILLION) * cachedInputPrice +
    (invoice.usage.completionTokens / MILLION) * outputPrice;
  await ctx.db.insert("invoices", {
    userId: invoice.userId,
    amount,
    billingPeriod,
    status: "pending",
  });
}
