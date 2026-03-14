import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedAiAccess } from "@/lib/ai/routeSecurity";
import { structureRecipeFromRawText, StructureRecipeLimitError } from "@/lib/ai/structureRecipe";

const structureRecipeRequestSchema = z.object({
  rawText: z.string().trim().min(1).max(20_000),
  preferredUnits: z.enum(["metric", "imperial"]).optional(),
});

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

    const result = await structureRecipeFromRawText({
      supabase: access.supabase,
      userId: access.userId,
      rawText: body.rawText,
      preferredUnits: body.preferredUnits === "imperial" ? "imperial" : "metric",
    });

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
    return NextResponse.json(
      {
        error: true,
        message: "Recipe parsing failed. Please edit manually.",
      },
      { status: 500 }
    );
  }
}
