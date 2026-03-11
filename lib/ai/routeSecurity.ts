import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

type RateLimitOptions = {
  route: string;
  maxRequests: number;
  windowMs: number;
};

type AuthenticatedAiAccess =
  | {
      errorResponse: NextResponse;
      supabase?: never;
      userId?: never;
    }
  | {
      errorResponse: null;
      supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
      userId: string;
    };

export async function requireAuthenticatedAiAccess(options: RateLimitOptions): Promise<AuthenticatedAiAccess> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      errorResponse: NextResponse.json(
        {
          error: true,
          message: "Authentication required.",
        },
        { status: 401 }
      ),
    };
  }

  const { data: rateLimitRows, error: rateLimitError } = await supabase.rpc("check_ai_rate_limit", {
    p_route: options.route,
    p_limit: options.maxRequests,
    p_window_seconds: Math.max(1, Math.floor(options.windowMs / 1000)),
  });

  if (rateLimitError || !Array.isArray(rateLimitRows) || rateLimitRows.length === 0) {
    console.error("AI rate limit RPC failed", rateLimitError);
    return {
      errorResponse: NextResponse.json(
        {
          error: true,
          message: "AI service unavailable. Please try again.",
        },
        { status: 503 }
      ),
    };
  }

  const rateLimit = rateLimitRows[0] as {
    allowed?: boolean;
    retry_after_seconds?: number;
  };

  if (!rateLimit.allowed) {
    const retryAfterSeconds =
      typeof rateLimit.retry_after_seconds === "number" && rateLimit.retry_after_seconds > 0
        ? Math.ceil(rateLimit.retry_after_seconds)
        : 60;

    return {
      errorResponse: NextResponse.json(
        {
          error: true,
          message: "Too many AI requests. Please wait a moment and try again.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSeconds),
          },
        }
      ),
    };
  }

  return {
    errorResponse: null,
    supabase,
    userId: user.id,
  };
}
