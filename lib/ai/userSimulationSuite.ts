/**
 * User simulation suite — 100 real-world-style prompts.
 *
 * Purpose
 * -------
 * Tests behavior under human inputs, not correctness under clean inputs.
 * This suite validates intent resolution, constraint handling, routing
 * robustness, and recipe plausibility for the kinds of prompts real users
 * actually type.
 *
 * This is NOT a pass/fail correctness suite. Track:
 *   1. Intent resolution success — did it pick a reasonable family?
 *   2. Constraint respect — were obvious constraints honored?
 *   3. Recipe plausibility — does the output feel like a real dish?
 *   4. Failure mode — wrong family, ignoring constraints, weird combos, etc.
 *
 * Do not add these to RECIPE_BENCHMARK_CASES or BENCHMARK_SUITE_CASE_IDS.
 * Run via scripts/run-simulation.ts (separate runner).
 */

export type SimIntentType =
  | "pantry"
  | "goal"
  | "constraint"
  | "ambiguous"
  | "multi_intent"
  | "emotional";

export type SimDifficulty = "easy" | "medium" | "hard";

export type UserSimCase = {
  id: string;
  prompt: string;
  intentType: SimIntentType;
  difficulty: SimDifficulty;
  notes?: string;
  /**
   * When true, an unresolved family for this case is classified as
   * "acceptable unresolved" — the prompt needs conversational clarification
   * or a future recommendation mode, not a resolver fix.
   * Does not count toward true_routing_failure_count in scorecard.
   */
  acceptableUnresolved?: boolean;
};

export const USER_SIMULATION_SUITE: UserSimCase[] = [

  // ── 1. Pantry-style: basic ────────────────────────────────────────────────

  {
    id: "sim_pantry_01",
    prompt: "I have eggs milk and cheese what can I make",
    intentType: "pantry",
    difficulty: "easy",
  },
  {
    id: "sim_pantry_02",
    prompt: "got chicken rice and broccoli ideas",
    intentType: "pantry",
    difficulty: "easy",
  },
  {
    id: "sim_pantry_03",
    prompt: "just pasta and tomatoes in my kitchen",
    intentType: "pantry",
    difficulty: "easy",
  },
  {
    id: "sim_pantry_04",
    prompt: "only have bread eggs and butter",
    intentType: "pantry",
    difficulty: "easy",
  },
  {
    id: "sim_pantry_05",
    prompt: "rice beans and spices what can I cook",
    intentType: "pantry",
    difficulty: "easy",
  },
  {
    id: "sim_pantry_06",
    prompt: "I have ground beef onions and garlic",
    intentType: "pantry",
    difficulty: "easy",
  },
  {
    id: "sim_pantry_07",
    prompt: "potatoes carrots and some random spices",
    intentType: "pantry",
    difficulty: "easy",
  },
  {
    id: "sim_pantry_08",
    prompt: "tuna mayo and bread any ideas",
    intentType: "pantry",
    difficulty: "easy",
  },
  {
    id: "sim_pantry_09",
    prompt: "leftover chicken and some veggies",
    intentType: "pantry",
    difficulty: "easy",
  },
  {
    id: "sim_pantry_10",
    prompt: "eggs flour sugar and milk what can I make",
    intentType: "pantry",
    difficulty: "easy",
  },

  // ── 2. Pantry-style: messy phrasing ──────────────────────────────────────

  {
    id: "sim_pantry_11",
    prompt: "got eggs flour sugar milk and idk what else",
    intentType: "pantry",
    difficulty: "medium",
    notes: "Trailing uncertainty — resolver must not choke on 'idk what else'",
  },
  {
    id: "sim_pantry_12",
    prompt: "just bananas milk yogurt and vibes",
    intentType: "pantry",
    difficulty: "medium",
    notes: "'vibes' is noise — resolver should ignore and route on real ingredients",
  },
  {
    id: "sim_pantry_13",
    prompt: "random stuff in fridge need food",
    intentType: "pantry",
    difficulty: "hard",
    notes: "No ingredients at all — open-ended fallback expected",
  },
  {
    id: "sim_pantry_14",
    prompt: "I have some things but not much maybe eggs and cheese",
    intentType: "pantry",
    difficulty: "medium",
    notes: "Hedged phrasing — 'maybe' and 'some things' must not prevent routing",
  },
  {
    id: "sim_pantry_15",
    prompt: "what can I cook with whatever I have lol",
    intentType: "pantry",
    difficulty: "hard",
    notes: "No usable ingredients — pure fallback",
  },

  // ── 3. Pantry-style: sparse / incomplete ─────────────────────────────────

  {
    id: "sim_pantry_16",
    prompt: "I have chicken",
    intentType: "pantry",
    difficulty: "easy",
    notes: "Single ingredient — system should still produce a viable family",
  },
  {
    id: "sim_pantry_17",
    prompt: "just eggs",
    intentType: "pantry",
    difficulty: "easy",
  },
  {
    id: "sim_pantry_18",
    prompt: "got pasta",
    intentType: "pantry",
    difficulty: "easy",
  },
  {
    id: "sim_pantry_19",
    prompt: "I only have vegetables",
    intentType: "pantry",
    difficulty: "easy",
  },
  {
    id: "sim_pantry_20",
    prompt: "I have nothing but pantry basics",
    intentType: "pantry",
    difficulty: "medium",
    notes: "Abstract — should fall back to generic pantry families",
  },

  // ── 4. Goal-oriented: health / speed ─────────────────────────────────────

  {
    id: "sim_goal_01",
    prompt: "I want something healthy but still tasty",
    intentType: "goal",
    difficulty: "easy",
  },
  {
    id: "sim_goal_02",
    prompt: "high protein meal ideas please",
    intentType: "goal",
    difficulty: "easy",
  },
  {
    id: "sim_goal_03",
    prompt: "something low calorie but filling",
    intentType: "goal",
    difficulty: "medium",
    notes: "Mild tension — low cal + filling",
  },
  {
    id: "sim_goal_04",
    prompt: "I want to eat clean tonight",
    intentType: "goal",
    difficulty: "easy",
  },
  {
    id: "sim_goal_05",
    prompt: "healthy dinner but not boring",
    intentType: "goal",
    difficulty: "easy",
  },
  {
    id: "sim_goal_06",
    prompt: "something quick I'm starving",
    intentType: "goal",
    difficulty: "easy",
  },
  {
    id: "sim_goal_07",
    prompt: "super easy dinner idea",
    intentType: "goal",
    difficulty: "easy",
  },
  {
    id: "sim_goal_08",
    prompt: "lazy meal I don't want to cook much",
    intentType: "goal",
    difficulty: "easy",
  },
  {
    id: "sim_goal_09",
    prompt: "10 minute meal idea",
    intentType: "goal",
    difficulty: "easy",
  },
  {
    id: "sim_goal_10",
    prompt: "something simple but good",
    intentType: "goal",
    difficulty: "easy",
  },

  // ── 5. Goal-oriented: experience-based ───────────────────────────────────

  {
    id: "sim_goal_11",
    prompt: "something comforting and warm",
    intentType: "goal",
    difficulty: "easy",
  },
  {
    id: "sim_goal_12",
    prompt: "I want a cozy meal",
    intentType: "goal",
    difficulty: "easy",
  },
  {
    id: "sim_goal_13",
    prompt: "something refreshing",
    intentType: "goal",
    difficulty: "easy",
  },
  {
    id: "sim_goal_14",
    prompt: "something indulgent",
    intentType: "goal",
    difficulty: "easy",
  },
  {
    id: "sim_goal_15",
    prompt: "something light for lunch",
    intentType: "goal",
    difficulty: "easy",
  },

  // ── 6. Constraint-heavy: dietary ─────────────────────────────────────────

  {
    id: "sim_constraint_01",
    prompt: "vegan dinner idea with high protein",
    intentType: "constraint",
    difficulty: "medium",
  },
  {
    id: "sim_constraint_02",
    prompt: "gluten free breakfast ideas",
    intentType: "constraint",
    difficulty: "easy",
  },
  {
    id: "sim_constraint_03",
    prompt: "dairy free but still creamy somehow",
    intentType: "constraint",
    difficulty: "medium",
    notes: "'still creamy' is a soft tension — achievable with plant-based alternatives",
  },
  {
    id: "sim_constraint_04",
    prompt: "nut free snack ideas",
    intentType: "constraint",
    difficulty: "easy",
  },
  {
    id: "sim_constraint_05",
    prompt: "vegetarian but filling meal",
    intentType: "constraint",
    difficulty: "easy",
  },

  // ── 7. Constraint-heavy: macro / fitness ─────────────────────────────────

  {
    id: "sim_constraint_06",
    prompt: "high protein under 500 calories",
    intentType: "constraint",
    difficulty: "medium",
  },
  {
    id: "sim_constraint_07",
    prompt: "low carb dinner ideas",
    intentType: "constraint",
    difficulty: "easy",
  },
  {
    id: "sim_constraint_08",
    prompt: "high protein low fat meal",
    intentType: "constraint",
    difficulty: "medium",
  },
  {
    id: "sim_constraint_09",
    prompt: "under 400 calories but filling",
    intentType: "constraint",
    difficulty: "medium",
  },
  {
    id: "sim_constraint_10",
    prompt: "high protein breakfast without eggs",
    intentType: "constraint",
    difficulty: "medium",
    notes: "Restricts the most common protein breakfast source",
  },

  // ── 8. Constraint-heavy: conflicting but solvable ─────────────────────────

  {
    id: "sim_constraint_11",
    prompt: "low calorie but also satisfying and not tiny",
    intentType: "constraint",
    difficulty: "medium",
  },
  {
    id: "sim_constraint_12",
    prompt: "high protein but not heavy",
    intentType: "constraint",
    difficulty: "medium",
  },
  {
    id: "sim_constraint_13",
    prompt: "healthy but still feels like comfort food",
    intentType: "constraint",
    difficulty: "medium",
  },
  {
    id: "sim_constraint_14",
    prompt: "quick but still kinda fancy",
    intentType: "constraint",
    difficulty: "medium",
  },
  {
    id: "sim_constraint_15",
    prompt: "cheap but still tastes good",
    intentType: "constraint",
    difficulty: "easy",
  },

  // ── 9. Ambiguous intent (routing stress test) ─────────────────────────────

  {
    id: "sim_ambiguous_01",
    prompt: "what should I eat",
    intentType: "ambiguous",
    difficulty: "hard",
    notes: "Maximally vague — pure open-ended fallback",
  },
  {
    id: "sim_ambiguous_02",
    prompt: "I need food",
    intentType: "ambiguous",
    difficulty: "hard",
  },
  {
    id: "sim_ambiguous_03",
    prompt: "dinner ideas",
    intentType: "ambiguous",
    difficulty: "easy",
  },
  {
    id: "sim_ambiguous_04",
    prompt: "something good to eat",
    intentType: "ambiguous",
    difficulty: "medium",
  },
  {
    id: "sim_ambiguous_05",
    prompt: "what can I make",
    intentType: "ambiguous",
    difficulty: "medium",
  },
  {
    id: "sim_ambiguous_06",
    prompt: "give me a recipe",
    intentType: "ambiguous",
    difficulty: "easy",
  },
  {
    id: "sim_ambiguous_07",
    prompt: "I'm hungry",
    intentType: "ambiguous",
    difficulty: "hard",
    notes: "Absolute minimum input — tests graceful fallback",
  },
  {
    id: "sim_ambiguous_08",
    prompt: "make me something",
    intentType: "ambiguous",
    difficulty: "medium",
  },
  {
    id: "sim_ambiguous_09",
    prompt: "food idea please",
    intentType: "ambiguous",
    difficulty: "medium",
  },
  {
    id: "sim_ambiguous_10",
    prompt: "I need a meal",
    intentType: "ambiguous",
    difficulty: "medium",
  },

  // ── 10. Multi-intent: pantry + constraint ─────────────────────────────────

  {
    id: "sim_multi_01",
    prompt: "I have chicken rice and broccoli want something healthy",
    intentType: "multi_intent",
    difficulty: "medium",
  },
  {
    id: "sim_multi_02",
    prompt: "eggs and cheese but I want low calorie",
    intentType: "multi_intent",
    difficulty: "medium",
  },
  {
    id: "sim_multi_03",
    prompt: "pasta but I want it high protein",
    intentType: "multi_intent",
    difficulty: "medium",
  },
  {
    id: "sim_multi_04",
    prompt: "I have beans and rice make it vegan but tasty",
    intentType: "multi_intent",
    difficulty: "medium",
  },
  {
    id: "sim_multi_05",
    prompt: "chicken and veggies but I want low carb",
    intentType: "multi_intent",
    difficulty: "medium",
  },

  // ── 11. Multi-intent: goal + constraint + emotion ─────────────────────────

  {
    id: "sim_multi_06",
    prompt: "I want something comforting but also healthy",
    intentType: "multi_intent",
    difficulty: "medium",
  },
  {
    id: "sim_multi_07",
    prompt: "quick dinner but high protein",
    intentType: "multi_intent",
    difficulty: "medium",
  },
  {
    id: "sim_multi_08",
    prompt: "indulgent but not too many calories",
    intentType: "multi_intent",
    difficulty: "hard",
    notes: "Soft tension — achievable but requires good macro routing",
  },
  {
    id: "sim_multi_09",
    prompt: "healthy but still feels like a cheat meal",
    intentType: "multi_intent",
    difficulty: "hard",
  },
  {
    id: "sim_multi_10",
    prompt: "something light but still filling and satisfying",
    intentType: "multi_intent",
    difficulty: "medium",
  },

  // ── 12. Emotional / human tone ────────────────────────────────────────────

  {
    id: "sim_emotional_01",
    prompt: "I'm tired just tell me something easy",
    intentType: "emotional",
    difficulty: "easy",
  },
  {
    id: "sim_emotional_02",
    prompt: "I don't feel like cooking what can I do",
    intentType: "emotional",
    difficulty: "easy",
  },
  {
    id: "sim_emotional_03",
    prompt: "I want something really good today",
    intentType: "emotional",
    difficulty: "easy",
    acceptableUnresolved: true,
    notes: "No food-intent signal survives normalization. Needs conversational clarification or recommendation mode.",
  },
  {
    id: "sim_emotional_04",
    prompt: "I need comfort food",
    intentType: "emotional",
    difficulty: "easy",
  },
  {
    id: "sim_emotional_05",
    prompt: "I'm trying to eat better but I still want flavor",
    intentType: "emotional",
    difficulty: "medium",
  },
  {
    id: "sim_emotional_06",
    prompt: "I'm broke what can I cook",
    intentType: "emotional",
    difficulty: "easy",
  },
  {
    id: "sim_emotional_07",
    prompt: "I have no energy but I'm hungry",
    intentType: "emotional",
    difficulty: "easy",
  },
  {
    id: "sim_emotional_08",
    prompt: "I want something impressive but not hard",
    intentType: "emotional",
    difficulty: "medium",
    acceptableUnresolved: true,
    notes: "No food-intent signal survives normalization. Needs conversational clarification or recommendation mode.",
  },
  {
    id: "sim_emotional_09",
    prompt: "I just want something good",
    intentType: "emotional",
    difficulty: "easy",
  },
  {
    id: "sim_emotional_10",
    prompt: "surprise me with something nice",
    intentType: "emotional",
    difficulty: "easy",
  },

  // ── 13. Edge: missing assumptions ────────────────────────────────────────

  {
    id: "sim_edge_01",
    prompt: "breakfast idea but I don't like eggs",
    intentType: "constraint",
    difficulty: "medium",
    notes: "Negative constraint on most common breakfast ingredient",
  },
  {
    id: "sim_edge_02",
    prompt: "dinner without using oil",
    intentType: "constraint",
    difficulty: "medium",
  },
  {
    id: "sim_edge_03",
    prompt: "no cooking required meal",
    intentType: "constraint",
    difficulty: "medium",
    notes: "Raw/no-cook recipes — tests if system handles non-standard prep",
  },
  {
    id: "sim_edge_04",
    prompt: "something I can eat cold",
    intentType: "constraint",
    difficulty: "easy",
  },
  {
    id: "sim_edge_05",
    prompt: "one pan meal only",
    intentType: "constraint",
    difficulty: "easy",
  },

  // ── 14. Edge: impossible / near-impossible ───────────────────────────────

  {
    id: "sim_edge_06",
    prompt: "high protein under 200 calories dinner",
    intentType: "constraint",
    difficulty: "hard",
    notes: "Structurally infeasible for a full dinner — expect reject or graceful degradation",
  },
  {
    id: "sim_edge_07",
    prompt: "dessert with no sugar but very sweet",
    intentType: "constraint",
    difficulty: "hard",
    notes: "Solvable with sugar-free sweeteners — should not be rejected",
  },
  {
    id: "sim_edge_08",
    prompt: "zero carb pasta idea",
    intentType: "constraint",
    difficulty: "hard",
    notes: "Contradictory — pasta is carbs. Should reject or reroute to low-carb alternative",
  },
  {
    id: "sim_edge_09",
    prompt: "super high protein smoothie without protein powder",
    intentType: "constraint",
    difficulty: "hard",
    notes: "Difficult but achievable with Greek yogurt, cottage cheese, seeds",
  },
  {
    id: "sim_edge_10",
    prompt: "creamy dish with no fat",
    intentType: "constraint",
    difficulty: "hard",
    notes: "Very difficult — almost all creaminess sources are fat-based",
  },

  // ── 15. Edge: cultural / style hints ────────────────────────────────────

  {
    id: "sim_edge_11",
    prompt: "something Italian but simple",
    intentType: "goal",
    difficulty: "easy",
  },
  {
    id: "sim_edge_12",
    prompt: "Asian style quick meal",
    intentType: "goal",
    difficulty: "easy",
  },
  {
    id: "sim_edge_13",
    prompt: "Mexican inspired healthy dinner",
    intentType: "goal",
    difficulty: "easy",
  },
  {
    id: "sim_edge_14",
    prompt: "something like takeout but healthier",
    intentType: "goal",
    difficulty: "medium",
  },
  {
    id: "sim_edge_15",
    prompt: "restaurant style dish at home",
    intentType: "goal",
    difficulty: "medium",
    acceptableUnresolved: true,
    notes: "No food-intent signal survives normalization. Needs conversational clarification or recommendation mode.",
  },

  // ── 16. Long messy prompts (real LLM killers) ────────────────────────────

  {
    id: "sim_long_01",
    prompt:
      "I have some chicken and rice and maybe some vegetables I think broccoli and carrots and I want something kinda healthy but also not boring and not too complicated",
    intentType: "multi_intent",
    difficulty: "hard",
    notes:
      "Multi-ingredient pantry + health goal + simplicity constraint in one run-on sentence",
  },
  {
    id: "sim_long_02",
    prompt:
      "I'm trying to eat better but I don't want like boring diet food and I don't have that many ingredients just basic stuff and I don't want to cook for too long",
    intentType: "multi_intent",
    difficulty: "hard",
    notes:
      "Health goal + vague pantry + time constraint — 'basic stuff' provides no real signal",
  },
  {
    id: "sim_long_03",
    prompt:
      "I have eggs milk cheese and some random pantry stuff and I want breakfast but something different not just eggs again",
    intentType: "multi_intent",
    difficulty: "hard",
    notes:
      "Pantry-led + negative preference ('not eggs again') — ironically has eggs as main available ingredient",
  },
  {
    id: "sim_long_04",
    prompt:
      "I want dinner that feels like comfort food but I'm also trying to lose weight and I don't want to spend a lot of time cooking",
    intentType: "multi_intent",
    difficulty: "hard",
    notes:
      "Classic tension: comfort food + weight loss + quick. Tests priority weighting.",
  },
  {
    id: "sim_long_05",
    prompt:
      "I'm hungry I have random stuff I don't know what to make just give me something good and not complicated",
    intentType: "multi_intent",
    difficulty: "hard",
    notes:
      "Maximally vague with no usable ingredients — should fall back to open-ended suggestions",
  },
];

/** Group cases by intentType for targeted simulation runs. */
export function getSimCasesByIntent(intentType: SimIntentType): UserSimCase[] {
  return USER_SIMULATION_SUITE.filter((c) => c.intentType === intentType);
}

/** Group cases by difficulty for progressive testing. */
export function getSimCasesByDifficulty(difficulty: SimDifficulty): UserSimCase[] {
  return USER_SIMULATION_SUITE.filter((c) => c.difficulty === difficulty);
}
