import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireAuthenticatedAiAccess } from "@/lib/ai/routeSecurity";
import { structureRecipeFromRawText, StructureRecipeLimitError } from "@/lib/ai/structureRecipe";
import { getConversationTurns } from "@/lib/ai/conversationStore";
import { getCookingBrief } from "@/lib/ai/briefStore";
import { getLockedDirectionSession } from "@/lib/ai/lockedSessionStore";
import { buildSessionMemoryBlock, mergeSessionConversationHistory, updateCanonicalSessionState } from "@/lib/ai/sessionContext";
import { getCanonicalSessionState, upsertCanonicalSessionState } from "@/lib/ai/sessionStateStore";
import { trackServerEvent } from "@/lib/trackServerEvent";
import { initAiUsageContext } from "@/lib/ai/usageLogger";

const structureRecipeRequestSchema = z.object({
  rawText: z.string().trim().min(1).max(20_000),
  preferredUnits: z.enum(["metric", "imperial"]).optional(),
  conversationKey: z.string().trim().min(1).optional(),
  scope: z.enum(["home_hub", "recipe_detail"]).optional(),
  recipeContext: z
    .object({
      title: z.string().optional(),
      ingredients: z.array(z.string()).optional(),
      steps: z.array(z.string()).optional(),
    })
    .nullable()
    .optional(),
});

export async function POST(request: Request) {
  let trackedAccess: Awaited<ReturnType<typeof requireAuthenticatedAiAccess>> | null = null;
  try {
    const access = await requireAuthenticatedAiAccess({
      route: "structure-recipe",
      maxRequests: 10,
      windowMs: 5 * 60 * 1000,
    });

    if (access.errorResponse) {
      return access.errorResponse;
    }
    trackedAccess = access;
    initAiUsageContext({ userId: access.userId, route: "structure-recipe" });

    let body;
    try {
      body = structureRecipeRequestSchema.parse(await request.json());
    } catch {
      return NextResponse.json(
        {
          error: true,
          message: "rawText is required.",
        },
        { status: 400 }
      );
    }

    const conversationKey = body.conversationKey?.trim() || null;
    const scope = body.scope ?? null;
    const [persistedBrief, persistedSession, persistedTurns, persistedSessionState] =
      conversationKey && scope
        ? await Promise.all([
            getCookingBrief(access.supabase as SupabaseClient, {
              ownerId: access.userId,
              conversationKey,
              scope,
            }),
            getLockedDirectionSession(access.supabase as SupabaseClient, {
              ownerId: access.userId,
              conversationKey,
              scope,
            }),
            getConversationTurns(access.supabase as SupabaseClient, {
              ownerId: access.userId,
              conversationKey,
              scope,
            }),
            getCanonicalSessionState(access.supabase as SupabaseClient, {
              ownerId: access.userId,
              conversationKey,
              scope,
            }),
          ])
        : [null, null, [], null];
    const conversationHistory = mergeSessionConversationHistory({
      persistedTurns,
      clientHistory: [],
      maxMessages: 16,
    });
    const sessionMemory = buildSessionMemoryBlock({
      sessionState: persistedSessionState?.state_json ?? null,
      brief: persistedBrief?.brief_json ?? null,
      lockedSession: persistedSession?.session_json ?? null,
      recipeContext: body.recipeContext ?? null,
      conversationHistory,
    });

    const result = await structureRecipeFromRawText({
      supabase: access.supabase,
      userId: access.userId,
      rawText: body.rawText,
      preferredUnits: body.preferredUnits === "imperial" ? "imperial" : "metric",
      conversationKey,
      conversationHistory,
      sessionMemory,
    });

    if (conversationKey && scope) {
      await upsertCanonicalSessionState(access.supabase as SupabaseClient, {
        ownerId: access.userId,
        conversationKey,
        scope,
        state: updateCanonicalSessionState({
          conversationKey,
          scope,
          brief: persistedBrief?.brief_json ?? null,
          lockedSession: persistedSession?.session_json ?? null,
          recipeContext: {
            title: result.recipe.title,
            ingredients: result.recipe.ingredients.map((item) => item.name),
            steps: result.recipe.steps.map((item) => item.text),
          },
          conversationHistory,
          previousState: persistedSessionState?.state_json ?? null,
          updatedBy: "recipe_structure",
        }),
      });
    }

    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof StructureRecipeLimitError) {
      return NextResponse.json(
        {
          error: true,
          message: error.message,
        },
        { status: 429 }
      );
    }

    console.error("Structure recipe route failed", error);
    if (trackedAccess) {
      await trackServerEvent(trackedAccess.supabase, trackedAccess.userId, "ai_route_failed", {
        route: "structure-recipe",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return NextResponse.json(
      {
        error: true,
        message: "Recipe parsing failed. Please edit manually.",
      },
      { status: 500 }
    );
  }
}
