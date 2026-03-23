import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { chefChat } from "@/lib/ai/chefChat";
import { generateHomeIdeasWithCache } from "@/lib/ai/homeHub";
import type { AIMessage } from "@/lib/ai/chatPromptBuilder";
import { requireAuthenticatedAiAccess } from "@/lib/ai/routeSecurity";
import { trackServerEvent } from "@/lib/trackServerEvent";
import { getCachedUserTasteSummary } from "@/lib/ai/userTasteProfile";
import { storeConversationTurns } from "@/lib/ai/conversationStore";
import { getConversationTurns } from "@/lib/ai/conversationStore";
import { COOKING_SCOPE_MESSAGE, guardCookingTopic } from "@/lib/ai/topicGuard";
import { resolveAiTaskSettings } from "@/lib/ai/taskSettings";
import { compileCookingBrief } from "@/lib/ai/briefCompiler";
import { getCookingBrief, upsertCookingBrief } from "@/lib/ai/briefStore";
import { appendLockedSessionRefinementDelta, buildLockedBrief } from "@/lib/ai/lockedSession";
import { deleteLockedDirectionSession, getLockedDirectionSession, upsertLockedDirectionSession } from "@/lib/ai/lockedSessionStore";
import type { LockedDirectionSession } from "@/lib/ai/contracts/lockedDirectionSession";
import { normalizeChefChatEnvelope } from "@/lib/ai/chefOptions";
import { looksLikePivotRequest } from "@/lib/ai/briefStateMachine";
import { extractRefinementDeltaWithFallback } from "@/lib/ai/refinementExtraction.server";
import { initAiUsageContext } from "@/lib/ai/usageLogger";

const aiMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
});

const lockedSessionSchema = z.object({
  conversation_key: z.string(),
  state: z.enum(["exploring", "direction_locked", "ready_to_build", "building", "built"]),
  selected_direction: z
    .object({
      id: z.string(),
      title: z.string(),
      summary: z.string(),
      tags: z.array(z.string()),
    })
    .nullable(),
  refinements: z.array(
    z.object({
      user_text: z.string(),
      assistant_text: z.string().nullable(),
      confidence: z.number(),
      ambiguity_reason: z.string().nullable(),
      extracted_changes: z.object({
        required_ingredients: z.array(z.string()),
        preferred_ingredients: z.array(z.string()),
        forbidden_ingredients: z.array(z.string()),
        style_tags: z.array(z.string()),
        notes: z.array(z.string()),
      }),
      field_state: z.object({
        ingredients: z.enum(["locked", "inferred", "unknown"]),
        style: z.enum(["locked", "inferred", "unknown"]),
        notes: z.enum(["locked", "inferred", "unknown"]),
      }),
    })
  ),
  brief_snapshot: z.any().nullable(),
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
    lockedSession: lockedSessionSchema.optional(),
    reset_session: z.boolean().optional(),
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
    initAiUsageContext({ supabase: access.supabase as SupabaseClient, userId: access.userId, route: "home-hub" });
    const tasteSummaryPromise = getCachedUserTasteSummary(access.supabase as SupabaseClient, access.userId);

    let body;
    try {
      body = homeAiRequestSchema.parse(await request.json());
    } catch {
      return NextResponse.json({ error: true, message: "Unsupported AI mode." }, { status: 400 });
    }

    const userTasteSummary = await tasteSummaryPromise;

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
        return NextResponse.json({ mode: "refine", reply: COOKING_SCOPE_MESSAGE, options: [], recommended_option_id: null });
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

      const taskSetting = await resolveAiTaskSettings("chef_chat");
      if (!taskSetting.enabled) {
        return NextResponse.json({ error: true, message: "Chef chat is currently disabled." }, { status: 503 });
      }

      const result = await chefChat(
        userMessage,
        body.recipeContext ?? null,
        conversationHistory,
        userTasteSummary,
        taskSetting
      );

      const envelope = result.envelope;
      const conversationKey = typeof body.conversationKey === "string" && body.conversationKey.trim().length > 0
        ? body.conversationKey.trim()
        : null;
      const isSessionReset = body.reset_session === true;
      if (isSessionReset && conversationKey) {
        void deleteLockedDirectionSession(access.supabase as SupabaseClient, {
          ownerId: access.userId,
          conversationKey,
          scope: "home_hub",
        }).catch((e) => console.error("deleteLockedDirectionSession failed", e));
      }
      const persistedSession = conversationKey && !isSessionReset
        ? await getLockedDirectionSession(access.supabase as SupabaseClient, {
            ownerId: access.userId,
            conversationKey,
            scope: "home_hub",
          })
        : null;
      const currentSession: LockedDirectionSession | null = isSessionReset ? null : (body.lockedSession ?? persistedSession?.session_json ?? null);
      const pivotedAwayFromLockedSession =
        Boolean(currentSession?.selected_direction) && looksLikePivotRequest(userMessage);
      const refinedDelta =
        currentSession?.selected_direction && !pivotedAwayFromLockedSession
          ? await extractRefinementDeltaWithFallback({
              userText: userMessage,
              assistantText: envelope.reply,
              selectedDirection: currentSession.selected_direction,
              taskSetting,
            })
          : null;
      const refinedSession =
        currentSession?.selected_direction && refinedDelta
          ? appendLockedSessionRefinementDelta(currentSession, refinedDelta)
          : null;
      const compiledBrief =
        refinedSession != null
          ? buildLockedBrief({
              session: refinedSession,
              conversationHistory: [
                ...conversationHistory,
                { role: "user", content: userMessage },
                { role: "assistant", content: envelope.reply },
              ],
            })
          : compileCookingBrief({
              userMessage,
              assistantReply: envelope.reply,
              conversationHistory,
              recipeContext: body.recipeContext ?? null,
              lockedSessionState: currentSession?.state ?? null,
              latestAssistantMode: envelope.mode,
            });

      if (conversationKey) {
        void storeConversationTurns(access.supabase as SupabaseClient, {
          ownerId: access.userId,
          conversationKey,
          scope: "home_hub",
          turns: [
            {
              role: "user",
              message: userMessage,
            },
            {
              role: "assistant",
              message: envelope.reply,
              metadata_json: envelope.options.length > 0 ? envelope : null,
            },
          ],
        }).catch((e) => console.error("storeConversationTurns failed", e));
        if (refinedSession) {
          void upsertLockedDirectionSession(access.supabase as SupabaseClient, {
            ownerId: access.userId,
            conversationKey,
            scope: "home_hub",
            session: refinedSession,
          }).catch((e) => console.error("upsertLockedDirectionSession failed", e));
        } else if (pivotedAwayFromLockedSession) {
          void deleteLockedDirectionSession(access.supabase as SupabaseClient, {
            ownerId: access.userId,
            conversationKey,
            scope: "home_hub",
          }).catch((e) => console.error("deleteLockedDirectionSession failed", e));
        }
        void upsertCookingBrief(access.supabase as SupabaseClient, {
          ownerId: access.userId,
          conversationKey,
          scope: "home_hub",
          brief: compiledBrief,
        }).catch((e) => console.error("upsertCookingBrief failed", e));
      }

      if (result.repaired) {
        void trackServerEvent(access.supabase, access.userId, "chef_chat_repaired", {
          route: "home-hub",
          provider: result.provider,
          finish_reason: result.finishReason ?? null,
          user_message_length: userMessage.length,
          initial_reply_length: result.initialReply.trim().length,
          final_reply_length: envelope.reply.trim().length,
          conversation_turns: conversationHistory.length,
        });
      }

      return NextResponse.json({
        ...envelope,
        session_action: pivotedAwayFromLockedSession ? "clear_locked_direction" : null,
        lockedSession: refinedSession,
      });
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
        supabase: access.supabase as SupabaseClient,
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
        supabase: access.supabase as SupabaseClient,
        userId: access.userId,
      });
      return NextResponse.json({ ideas });
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

export async function GET(request: Request) {
  const access = await requireAuthenticatedAiAccess({
    route: "home-hub-session",
    maxRequests: 60,
    windowMs: 5 * 60 * 1000,
  });

  if (access.errorResponse) {
    return access.errorResponse;
  }

  const { searchParams } = new URL(request.url);
  const conversationKey = searchParams.get("conversationKey")?.trim();

  if (!conversationKey) {
    return NextResponse.json({ error: true, message: "conversationKey is required" }, { status: 400 });
  }

  try {
    const [turns, lockedSession, brief] = await Promise.all([
      getConversationTurns(access.supabase as SupabaseClient, {
        ownerId: access.userId,
        conversationKey,
        scope: "home_hub",
      }),
      getLockedDirectionSession(access.supabase as SupabaseClient, {
        ownerId: access.userId,
        conversationKey,
        scope: "home_hub",
      }),
      getCookingBrief(access.supabase as SupabaseClient, {
        ownerId: access.userId,
        conversationKey,
        scope: "home_hub",
      }),
    ]);

    const messages = turns.map((turn) => {
      const envelope = normalizeChefChatEnvelope(turn.metadata_json);
      return {
        role: turn.role === "assistant" ? "ai" : "user",
        text: turn.message,
        kind: "message" as const,
        options: envelope?.options ?? undefined,
        recommendedOptionId: envelope?.recommended_option_id ?? null,
      };
    });

    return NextResponse.json({
      conversationKey,
      messages,
      lockedSession: lockedSession?.session_json ?? null,
      brief: brief?.brief_json ?? null,
    });
  } catch (error) {
    console.error("Home session GET failed", error);
    return NextResponse.json(
      { error: true, message: "Failed to load session. Please try again." },
      { status: 500 }
    );
  }
}
