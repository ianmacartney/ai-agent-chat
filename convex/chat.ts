import { v } from "convex/values";
import { paginationOptsValidator, PaginationResult } from "convex/server";
import { action, httpAction, mutation, query } from "./_generated/server";
import { Agent, createTool } from "@convex-dev/agent";
import { components, internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { openai } from "@ai-sdk/openai";
import type { MessageDoc, ThreadDoc } from "@convex-dev/agent";
import { z } from "zod";
import { Id } from "./_generated/dataModel";

export const updateThreadTitle = createTool({
  args: z.object({
    title: z.string().describe("The new title for the thread"),
  }),
  description:
    "Update the title of the current thread. It will respond with 'updated' if it succeeded",
  handler: async (ctx, args) => {
    if (!ctx.threadId) {
      console.warn("updateThreadTitle called without a threadId");
      return "skipped";
    }
    await ctx.runMutation(components.agent.messages.updateThread, {
      threadId: ctx.threadId,
      patch: { title: args.title },
    });
    return "updated";
  },
});

const chatAgent = new Agent(components.agent, {
  chat: openai.chat("gpt-4o-mini"),
  instructions:
    "You are a helpful AI assistant. Respond concisely and accurately to user questions.",
  tools: { updateThreadTitle },
  usageHandler: async (ctx, args) => {
    console.log({ args });
    await ctx.runMutation(internal.usage.insertRawUsage, {
      userId: args.userId as Id<"users">,
      agentName: args.agentName,
      model: args.model,
      provider: args.provider,
      usage: args.usage,
      providerMetadata: args.providerMetadata,
    });
  },
});

export const createThread = mutation({
  args: {},
  handler: async (ctx): Promise<{ threadId: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const { threadId } = await chatAgent.createThread(ctx, { userId });

    return { threadId };
  },
});

export const sendMessage = action({
  args: {
    prompt: v.string(),
    threadId: v.string(),
  },
  handler: async (ctx, { prompt, threadId }): Promise<string> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const { thread } = await chatAgent.continueThread(ctx, {
      threadId,
      userId,
    });
    const result = await thread.generateText({ prompt });
    await ctx.scheduler.runAfter(
      0,
      internal.threadTitles.maybeUpdateThreadTitle,
      {
        threadId,
      }
    );

    return result.text;
  },
});

export const sendMessageHttpStream = httpAction(async (ctx, request) => {
  const { prompt, threadId } = await request.json();
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");

  const { thread } = await chatAgent.continueThread(ctx, {
    threadId,
    userId,
  });

  const result = await thread.streamText({ prompt });
  await ctx.scheduler.runAfter(
    1000,
    internal.threadTitles.maybeUpdateThreadTitle,
    { threadId }
  );

  const response = result.toTextStreamResponse();
  response.headers.set("Message-Id", result.messageId!);
  return response;
});
export const getThreads = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (
    ctx,
    { paginationOpts }
  ): Promise<PaginationResult<ThreadDoc>> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const results = await ctx.runQuery(
      components.agent.messages.getThreadsByUserId,
      { userId, paginationOpts }
    );
    return results;
  },
});

export const getMessages = query({
  args: { threadId: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { threadId, paginationOpts }) => {
    return await ctx.runQuery(components.agent.messages.getThreadMessages, {
      threadId,
      paginationOpts,
      isTool: false,
    });
  },
});

export const getInProgressMessages = query({
  args: { threadId: v.string() },
  handler: async (ctx, { threadId }): Promise<MessageDoc[]> => {
    const results = await ctx.runQuery(
      components.agent.messages.getThreadMessages,
      {
        threadId,
        paginationOpts: { numItems: 10, cursor: null },
        statuses: ["pending"],
      }
    );
    return results.page;
  },
});
