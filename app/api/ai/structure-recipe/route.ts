import { NextResponse } from "next/server";
import { requireAuthenticatedAiAccess } from "@/lib/ai/routeSecurity";
import { structureRecipeFromRawText, StructureRecipeLimitError } from "@/lib/ai/structureRecipe";

type StructureRecipeRequest = {
  rawText?: string;
  preferredUnits?: "metric" | "imperial";
};

export async function POST(request: Request) {
  try {
    const access = await requireAuthenticatedAiAccess({
      route: "structure-recipe",
      maxRequests: 10,
      windowMs: 5 * 60 * 1000,
    });

    if (access.errorResponse) {
      return access.errorResponse;
    }

    const body = (await request.json()) as StructureRecipeRequest;
    const rawText = typeof body.rawText === "string" ? body.rawText.trim() : "";

    if (!rawText || rawText.length > 20_000) {
      return NextResponse.json(
        {
          error: true,
          message: "rawText is required.",
        },
        { status: 400 }
      );
    }

    const result = await structureRecipeFromRawText({
      supabase: access.supabase,
      userId: access.userId,
      rawText,
      preferredUnits: body.preferredUnits === "imperial" ? "imperial" : "metric",
    });

    return NextResponse.json(result);
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
    return NextResponse.json(
      {
        error: true,
        message: "Recipe parsing failed. Please edit manually.",
      },
      { status: 500 }
    );
  }
}
