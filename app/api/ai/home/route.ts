import { NextResponse } from "next/server";
import { z } from "zod";
import { chefChat } from "@/lib/ai/chefChat";
import { generateHomeIdeasWithCache, generateHomeRecipe } from "@/lib/ai/homeHub";
import type { AIMessage, RecipeContext } from "@/lib/ai/chatPromptBuilder";
import { requireAuthenticatedAiAccess } from "@/lib/ai/routeSecurity";
import { trackServerEvent } from "@/lib/trackServerEvent";
import { buildUserTasteSummary } from "@/lib/ai/userTasteProfile";
import { storeConversationTurns } from "@/lib/ai/conversationStore";
import { COOKING_SCOPE_MESSAGE, guardCookingTopic } from "@/lib/ai/topicGuard";

const aiMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
});

const recipeContextSchema = z
  .object({
    title: z.string().optional(),
    ingredients: z.array(z.string()).optional(),
    steps: z.array(z.string()).optional(),
  })
  .nullable()
  .optional();

const homeAiRequestSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("chef_chat"),
    userMessage: z.string().trim().min(1).max(4000),
    recipeContext: recipeContextSchema,
    conversationHistory: z.array(aiMessageSchema).optional(),
    conversationKey: z.string().optional(),
  }),
  z.object({
    mode: z.literal("mood_ideas"),
    prompt: z.string().trim().min(1),
    ingredients: z.array(z.string()).optional(),
    exclude_titles: z.array(z.string()).optional(),
    batch_index: z.number().optional(),
    conversationHistory: z.array(aiMessageSchema).optional(),
    requested_count: z.number().optional(),
  }),
  z.object({
    mode: z.literal("ingredients_ideas"),
    prompt: z.string().optional(),
    ingredients: z.array(z.string()).min(1),
    exclude_titles: z.array(z.string()).optional(),
    batch_index: z.number().optional(),
    conversationHistory: z.array(aiMessageSchema).optional(),
    requested_count: z.number().optional(),
  }),
  z.object({
    mode: z.literal("filtered_ideas"),
    filters: z
      .object({
        cuisine: z.string().optional(),
        protein: z.string().optional(),
        mealType: z.string().optional(),
        cookingTime: z.string().optional(),
      })
      .optional(),
    requested_count: z.number().optional(),
  }),
  z.object({
    mode: z.literal("idea_recipe"),
    ideaTitle: z.string().trim().min(1),
    prompt: z.string().optional(),
    ingredients: z.array(z.string()).optional(),
    conversationHistory: z.array(aiMessageSchema).optional(),
  }),
]);

export async function POST(request: Request) {
  let trackedAccess:
    | {
        supabase: Awaited<ReturnType<typeof import("@/lib/supabaseServer").createSupabaseServerClient>>;
        userId: string;
      }
    | null = null;
  try {
    const access = await requireAuthenticatedAiAccess({
      route: "home-hub",
      maxRequests: 20,
      windowMs: 5 * 60 * 1000,
    });

    if (access.errorResponse) {
      return access.errorResponse;
    }

    trackedAccess = {
      supabase: access.supabase,
      userId: access.userId,
    };
    const userTasteSummary = await buildUserTasteSummary(access.supabase as any, access.userId);

    let body;
    try {
      body = homeAiRequestSchema.parse(await request.json());
    } catch {
      return NextResponse.json({ error: true, message: "Unsupported AI mode." }, { status: 400 });
    }

    if (body.mode === "chef_chat") {
      const userMessage = body.userMessage?.trim();
      if (!userMessage || userMessage.length > 4000) {
        return NextResponse.json({ error: true, message: "userMessage is required" }, { status: 400 });
      }

      const topicGuard = guardCookingTopic({
        message: userMessage,
        recipeContext: body.recipeContext ?? null,
      });

      if (!topicGuard.allowed) {
        void trackServerEvent(access.supabase, access.userId, "ai_topic_guard_blocked", {
          route: "home-hub",
          mode: body.mode,
          user_message_length: userMessage.length,
        });
        return NextResponse.json({ reply: COOKING_SCOPE_MESSAGE });
      }

      const conversationHistory = Array.isArray(body.conversationHistory)
        ? body.conversationHistory.filter(
            (message): message is AIMessage =>
              Boolean(message) &&
              (message.role === "user" || message.role === "assistant") &&
              typeof message.content === "string" &&
              message.content.trim().length > 0
          )
        : [];

      const result = await chefChat(userMessage, body.recipeContext ?? null, conversationHistory, userTasteSummary);

      if (typeof body.conversationKey === "string" && body.conversationKey.trim().length > 0) {
        void storeConversationTurns(access.supabase as any, {
          ownerId: access.userId,
          conversationKey: body.conversationKey.trim(),
          scope: "home_hub",
          turns: [
            {
              role: "user",
              message: userMessage,
            },
            {
              role: "assistant",
              message: result.reply,
            },
          ],
        });
      }

      if (result.repaired) {
        void trackServerEvent(access.supabase, access.userId, "chef_chat_repaired", {
          route: "home-hub",
          provider: result.provider,
          finish_reason: result.finishReason ?? null,
          user_message_length: userMessage.length,
          initial_reply_length: result.initialReply.trim().length,
          final_reply_length: result.reply.trim().length,
          conversation_turns: conversationHistory.length,
        });
      }

      return NextResponse.json({ reply: result.reply });
    }

    if (body.mode === "mood_ideas" || body.mode === "ingredients_ideas") {
      const prompt = typeof body.prompt === "string" ? body.prompt.trim() : undefined;
      const ingredients = Array.isArray(body.ingredients)
        ? body.ingredients.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
        : undefined;
      const conversationHistory = Array.isArray(body.conversationHistory)
        ? body.conversationHistory.filter(
            (message): message is AIMessage =>
              Boolean(message) &&
              (message.role === "user" || message.role === "assistant") &&
              typeof message.content === "string" &&
              message.content.trim().length > 0
          )
        : undefined;

      if (body.mode === "ingredients_ideas" && (!ingredients || ingredients.length === 0)) {
        return NextResponse.json({ error: true, message: "ingredients are required" }, { status: 400 });
      }

      if (body.mode === "mood_ideas" && !prompt) {
        return NextResponse.json({ error: true, message: "prompt is required" }, { status: 400 });
      }

      const ideas = await generateHomeIdeasWithCache({
        mode: body.mode,
        prompt,
        ingredients,
        excludeTitles: Array.isArray(body.exclude_titles) ? body.exclude_titles : [],
        batchIndex: typeof body.batch_index === "number" ? body.batch_index : 1,
        conversationHistory,
        requestedCount: typeof body.requested_count === "number" ? body.requested_count : undefined,
      }, userTasteSummary, {
        supabase: access.supabase as any,
        userId: access.userId,
      });

      return NextResponse.json({ ideas });
    }

    if (body.mode === "filtered_ideas") {
      const ideas = await generateHomeIdeasWithCache({
        mode: "filtered_ideas",
        filters: body.filters,
        requestedCount: typeof body.requested_count === "number" ? body.requested_count : undefined,
      }, userTasteSummary, {
        supabase: access.supabase as any,
        userId: access.userId,
      });
      return NextResponse.json({ ideas });
    }

    if (body.mode === "idea_recipe") {
      const ideaTitle = body.ideaTitle?.trim();
      if (!ideaTitle) {
        return NextResponse.json({ error: true, message: "ideaTitle is required" }, { status: 400 });
      }

      const result = await generateHomeRecipe({
        ideaTitle,
        prompt: typeof body.prompt === "string" ? body.prompt.trim() : undefined,
        ingredients: Array.isArray(body.ingredients)
          ? body.ingredients.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
          : undefined,
        conversationHistory: Array.isArray(body.conversationHistory)
          ? body.conversationHistory.filter(
              (message): message is AIMessage =>
                Boolean(message) &&
                (message.role === "user" || message.role === "assistant") &&
                typeof message.content === "string" &&
                message.content.trim().length > 0
            )
          : undefined,
      }, userTasteSummary, {
        supabase: access.supabase as any,
        userId: access.userId,
      });

      return NextResponse.json({ result });
    }

    return NextResponse.json({ error: true, message: "Unsupported AI mode." }, { status: 400 });
  } catch (error) {
    console.error("Home AI route failed", error);
    if (trackedAccess) {
      void trackServerEvent(trackedAccess.supabase, trackedAccess.userId, "ai_route_failed", {
        route: "home-hub",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return NextResponse.json(
      {
        error: true,
        message: "Home AI request failed. Please try again.",
      },
      { status: 500 }
    );
  }
}
