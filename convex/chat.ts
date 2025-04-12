import { v } from "convex/values";
import { paginationOptsValidator, PaginationResult } from "convex/server";
import { action, httpAction, mutation, query } from "./_generated/server";
import { Agent } from "@convex-dev/agent";
import { components, internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { createOpenAI } from "@ai-sdk/openai";
import type { MessageDoc, ThreadDoc } from "@convex-dev/agent";

const openai = createOpenAI({
  baseURL: process.env.CONVEX_OPENAI_BASE_URL,
  apiKey: process.env.CONVEX_OPENAI_API_KEY,
});
const chatAgent = new Agent(components.agent, {
  chat: openai.chat("gpt-4o-mini"),
  instructions:
    "You are a helpful AI assistant. Respond concisely and accurately to user questions.",
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

  return result.toTextStreamResponse();
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
