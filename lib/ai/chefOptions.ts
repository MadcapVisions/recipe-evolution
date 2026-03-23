export type ChefDirectionOption = {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  /** Dish family identifier provided by the model (Phase 3b). null/undefined for legacy options. */
  dish_family?: string | null;
  /** Primary anchor ingredient/protein/dish provided by the model. null/undefined for legacy options. */
  primary_anchor?: string | null;
  /** Type of the primary anchor. null/undefined for legacy options. */
  primary_anchor_type?: "dish" | "protein" | "ingredient" | "format" | null;
};

export function optionsTooSimilar(options: ChefDirectionOption[]): boolean {
  for (let i = 0; i < options.length; i++) {
    for (let j = i + 1; j < options.length; j++) {
      const wordsA = new Set(options[i].title.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2));
      const wordsB = new Set(options[j].title.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2));
      const shared = Array.from(wordsA).filter((w: string) => wordsB.has(w)).length;
      const maxSize = Math.max(wordsA.size, wordsB.size);
      if (maxSize > 0 && shared / maxSize > 0.6) return true;
    }
  }
  return false;
}

export type ChefChatEnvelope = {
  mode: "options" | "refine";
  reply: string;
  options: ChefDirectionOption[];
  recommended_option_id: string | null;
};

function cleanSentence(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function deriveTags(text: string) {
  const normalized = text.toLowerCase();
  const tags: string[] = [];
  const knownTags = [
    "pasta",
    "bowl",
    "salad",
    "skillet",
    "soup",
    "tacos",
    "roasted",
    "spicy",
    "bright",
    "creamy",
    "crispy",
    "30 min",
    "weeknight",
    "high protein",
    "vegetarian",
  ];

  for (const tag of knownTags) {
    if (normalized.includes(tag)) {
      tags.push(tag);
    }
  }

  return tags.slice(0, 4);
}

function deriveTitle(summary: string) {
  const normalized = cleanSentence(summary);
  const patterns = [
    { tokens: ["pasta", "linguine", "spaghetti", "penne", "rigatoni"], title: "Pasta Direction" },
    { tokens: ["bowl", "rice bowl", "grain bowl"], title: "Bowl Direction" },
    { tokens: ["skillet"], title: "Skillet Direction" },
    { tokens: ["salad"], title: "Salad Direction" },
    { tokens: ["soup", "stew"], title: "Soup Direction" },
    { tokens: ["taco", "tacos"], title: "Taco Direction" },
  ];

  for (const pattern of patterns) {
    if (pattern.tokens.some((token) => normalized.toLowerCase().includes(token))) {
      const words = normalized.split(/[.]/)[0]?.split(/\s+/).slice(0, 4).join(" ") ?? "";
      return titleCase(words || pattern.title);
    }
  }

  return titleCase(normalized.split(/[.]/)[0]?.split(/\s+/).slice(0, 5).join(" ") || "Chef Direction");
}

export function extractChefOptions(reply: string): ChefDirectionOption[] {
  const normalized = reply.replace(/\r/g, "").trim();
  if (!normalized) {
    return [];
  }

  const explicitMatches = Array.from(normalized.matchAll(/(?:^|\n)\s*(?:option\s*(\d+)|(\d+)[\).\]])\s*:\s*([\s\S]+?)(?=(?:\n\s*(?:option\s*\d+|\d+[\).\]])\s*:)|$)/gim));
  if (explicitMatches.length > 0) {
    return explicitMatches
      .map((match, index): ChefDirectionOption | null => {
        const summary = cleanSentence(match[3] ?? "");
        if (!summary) {
          return null;
        }
        return {
          id: `option-${index + 1}`,
          title: deriveTitle(summary),
          summary,
          tags: deriveTags(summary),
          dish_family: null,
          primary_anchor: null,
          primary_anchor_type: null,
        };
      })
      .filter((item): item is ChefDirectionOption => item !== null)
      .slice(0, 3);
  }

  return [];
}

export function extractRecommendedOptionId(reply: string, options: ChefDirectionOption[]) {
  if (options.length === 0) {
    return null;
  }

  const normalized = reply.toLowerCase();
  const bestPickMatch = normalized.match(/best\s+(?:pick|option|direction)\s*:\s*(.+)$/im);
  const strongestMatch = normalized.match(/strongest\s+option\s*(?:is|:)\s*(.+)$/im);
  const recommendationText = (bestPickMatch?.[1] ?? strongestMatch?.[1] ?? "").trim();

  if (recommendationText) {
    for (const option of options) {
      const title = option.title.toLowerCase();
      const summary = option.summary.toLowerCase();
      if (recommendationText.includes(title) || recommendationText.includes(summary.split(/[.,]/)[0] ?? "")) {
        return option.id;
      }
      if (title.split(/\s+/).some((word) => word.length > 3 && recommendationText.includes(word))) {
        return option.id;
      }
    }
  }

  return options[0]?.id ?? null;
}

export function buildChefChatEnvelope(reply: string): ChefChatEnvelope {
  const options = extractChefOptions(reply);
  return {
    mode: options.length > 0 ? "options" : "refine",
    reply,
    options,
    recommended_option_id: extractRecommendedOptionId(reply, options),
  };
}

export function normalizeChefChatEnvelope(value: unknown): ChefChatEnvelope | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const reply = typeof raw.reply === "string" ? raw.reply.trim() : "";
  if (!reply) {
    return null;
  }

  const options = Array.isArray(raw.options)
    ? raw.options
        .map((item, index): ChefDirectionOption | null => {
          if (!item || typeof item !== "object") {
            return null;
          }
          const option = item as Record<string, unknown>;
          const title = typeof option.title === "string" ? option.title.trim() : "";
          const summary = typeof option.summary === "string" ? option.summary.trim() : "";
          if (!title || !summary) {
            return null;
          }
          const rawAnchorType = typeof option.primary_anchor_type === "string" ? option.primary_anchor_type : null;
          const anchorType =
            rawAnchorType === "dish" || rawAnchorType === "protein" || rawAnchorType === "ingredient" || rawAnchorType === "format"
              ? rawAnchorType
              : null;
          return {
            id: typeof option.id === "string" && option.id.trim() ? option.id.trim() : `option-${index + 1}`,
            title,
            summary,
            tags: Array.isArray(option.tags)
              ? option.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0).map((tag) => tag.trim()).slice(0, 4)
              : [],
            dish_family: typeof option.dish_family === "string" && option.dish_family.trim() ? option.dish_family.trim() : null,
            primary_anchor: typeof option.primary_anchor === "string" && option.primary_anchor.trim() ? option.primary_anchor.trim() : null,
            primary_anchor_type: anchorType,
          };
        })
        .filter((item): item is ChefDirectionOption => item !== null)
        .slice(0, 3)
    : [];

  const recommendedOptionId =
    typeof raw.recommended_option_id === "string" && raw.recommended_option_id.trim().length > 0
      ? raw.recommended_option_id.trim()
      : null;

  const inferredMode = options.length > 0 ? "options" : "refine";
  const mode = raw.mode === "options" || raw.mode === "refine" ? raw.mode : inferredMode;

  return {
    mode: mode === "options" && options.length === 0 ? inferredMode : mode,
    reply,
    options,
    recommended_option_id: recommendedOptionId && options.some((option) => option.id === recommendedOptionId)
      ? recommendedOptionId
      : extractRecommendedOptionId(reply, options),
  };
}
