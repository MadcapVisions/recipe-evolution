import { NextResponse } from "next/server";
import { chefChat } from "@/lib/ai/chefChat";
import type { AIMessage, RecipeContext } from "@/lib/ai/chatPromptBuilder";
import { requireAuthenticatedAiAccess } from "@/lib/ai/routeSecurity";
import { trackServerEvent } from "@/lib/trackServerEvent";

export async function POST(request: Request) {
  let trackedAccess:
    | {
        supabase: Awaited<ReturnType<typeof import("@/lib/supabaseServer").createSupabaseServerClient>>;
        userId: string;
      }
    | null = null;
  try {
    const access = await requireAuthenticatedAiAccess({
      route: "chef-chat",
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

    const body = (await request.json()) as {
      userMessage?: string;
      recipeContext?: RecipeContext;
      conversationHistory?: AIMessage[];
    };

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
        route: "chef-chat",
        provider: result.provider,
        finish_reason: result.finishReason ?? null,
        user_message_length: userMessage.length,
        initial_reply_length: result.initialReply.trim().length,
        final_reply_length: result.reply.trim().length,
        conversation_turns: conversationHistory.length,
      });
    }

    return NextResponse.json({ reply: result.reply });
  } catch (error) {
    console.error("Chef chat route failed", error);
    if (trackedAccess) {
      void trackServerEvent(trackedAccess.supabase, trackedAccess.userId, "ai_route_failed", {
        route: "chef-chat",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return NextResponse.json(
      {
        error: true,
        message: "Chef chat failed. Please try again.",
      },
      { status: 500 }
    );
  }
}
