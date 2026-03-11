import { NextResponse } from "next/server";
import { chefChat } from "@/lib/ai/chefChat";
import type { AIMessage, RecipeContext } from "@/lib/ai/chatPromptBuilder";
import { requireAuthenticatedAiAccess } from "@/lib/ai/routeSecurity";

export async function POST(request: Request) {
  try {
    const access = await requireAuthenticatedAiAccess({
      route: "chef-chat",
      maxRequests: 20,
      windowMs: 5 * 60 * 1000,
    });

    if (access.errorResponse) {
      return access.errorResponse;
    }

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

    const reply = await chefChat(userMessage, body.recipeContext ?? null, conversationHistory);
    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Chef chat route failed", error);
    return NextResponse.json(
      {
        error: true,
        message: "Chef chat failed. Please try again.",
      },
      { status: 500 }
    );
  }
}
