import { NextResponse } from "next/server";
import { chefChat } from "@/lib/ai/chefChat";
import { generateHomeIdeas, generateHomeRecipe } from "@/lib/ai/homeHub";
import type { AIMessage, RecipeContext } from "@/lib/ai/chatPromptBuilder";
import { requireAuthenticatedAiAccess } from "@/lib/ai/routeSecurity";
import { trackServerEvent } from "@/lib/trackServerEvent";

type HomeAiRequest =
  | {
      mode?: "chef_chat";
      userMessage?: string;
      recipeContext?: RecipeContext;
      conversationHistory?: AIMessage[];
    }
  | {
      mode?: "mood_ideas" | "ingredients_ideas";
      prompt?: string;
      ingredients?: string[];
      exclude_titles?: string[];
      batch_index?: number;
    }
  | {
      mode?: "filtered_ideas";
      filters?: {
        cuisine?: string;
        protein?: string;
        mealType?: string;
        cookingTime?: string;
      };
    }
  | {
      mode?: "idea_recipe";
      ideaTitle?: string;
      prompt?: string;
      ingredients?: string[];
    };

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

    const body = (await request.json()) as HomeAiRequest;

    if (body.mode === "chef_chat") {
      const userMessage = body.userMessage?.trim();
      if (!userMessage || userMessage.length > 4000) {
        return NextResponse.json({ error: true, message: "userMessage is required" }, { status: 400 });
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

      const result = await chefChat(userMessage, body.recipeContext ?? null, conversationHistory);

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

      if (body.mode === "ingredients_ideas" && (!ingredients || ingredients.length === 0)) {
        return NextResponse.json({ error: true, message: "ingredients are required" }, { status: 400 });
      }

      if (body.mode === "mood_ideas" && !prompt) {
        return NextResponse.json({ error: true, message: "prompt is required" }, { status: 400 });
      }

      const ideas = await generateHomeIdeas({
        mode: body.mode,
        prompt,
        ingredients,
        excludeTitles: Array.isArray(body.exclude_titles) ? body.exclude_titles : [],
        batchIndex: typeof body.batch_index === "number" ? body.batch_index : 1,
      });

      return NextResponse.json({ ideas });
    }

    if (body.mode === "filtered_ideas") {
      const ideas = await generateHomeIdeas({
        mode: "filtered_ideas",
        filters: body.filters,
      });
      return NextResponse.json({ ideas });
    }

    if (body.mode === "idea_recipe") {
      const ideaTitle = body.ideaTitle?.trim();
      if (!ideaTitle) {
        return NextResponse.json({ error: true, message: "ideaTitle is required" }, { status: 400 });
      }

      const recipe = await generateHomeRecipe({
        ideaTitle,
        prompt: typeof body.prompt === "string" ? body.prompt.trim() : undefined,
        ingredients: Array.isArray(body.ingredients)
          ? body.ingredients.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
          : undefined,
      });

      return NextResponse.json({ recipe });
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
