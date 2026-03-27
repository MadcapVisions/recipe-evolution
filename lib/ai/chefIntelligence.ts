export type ChefRuleType = "mandatory" | "recommended" | "warning";

export type ChefRecipeContext = {
  title?: string | null;
  ingredients: string[];
  steps: string[];
  notes?: string | null;
};

export type ChefInsight = {
  id: string;
  ruleType: ChefRuleType;
  text: string;
  stepIndex?: number | null;
  checklistItem?: string | null;
};

export type ChefEditAction =
  | {
      type: "add_step";
      content: string;
      rationale: string;
      stepPosition?: "before_baking" | "after_baking" | "before_serving" | "end";
      stepIndex?: number | null;
    }
  | {
      type: "modify_step";
      content: string;
      rationale: string;
      stepIndex: number;
    }
  | {
      type: "insert_doneness_cue";
      content: string;
      rationale: string;
      stepIndex?: number | null;
    }
  | {
      type: "insert_rest_time" | "insert_storage_tip" | "insert_make_ahead_tip";
      content: string;
      rationale: string;
      stepIndex?: number | null;
    }
  | {
      type: "add_note" | "add_chef_insight" | "add_checklist_item";
      content: string;
      rationale: string;
    };

export type ChefIntelligence = {
  insights: ChefInsight[];
  notes: string[];
  checklistItems: string[];
  stepTips: Array<{ stepIndex: number; text: string }>;
  riskFlags: string[];
  analysis: {
    isBaking: boolean;
    isCookies: boolean;
    isSourdough: boolean;
    isNonDairy: boolean;
    hasBakeStep: boolean;
  };
};

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : ""))
        .filter((value) => value.length > 0)
    )
  );
}

function findStepIndex(steps: string[], pattern: RegExp) {
  return steps.findIndex((step) => pattern.test(step));
}

function appendSentence(base: string, addition: string) {
  const normalizedBase = base.trim();
  const normalizedAddition = addition.trim().replace(/^[.:\-\s]+/, "");
  if (!normalizedBase) {
    return normalizedAddition;
  }
  if (normalizedBase.toLowerCase().includes(normalizedAddition.toLowerCase())) {
    return normalizedBase;
  }
  const suffix = /[.!?]$/.test(normalizedBase) ? "" : ".";
  return `${normalizedBase}${suffix} ${normalizedAddition}`;
}

export function buildChefIntelligence(input: ChefRecipeContext): ChefIntelligence {
  const title = (input.title ?? "").toLowerCase();
  const ingredients = input.ingredients.map((item) => item.toLowerCase());
  const steps = input.steps.map((item) => item.toLowerCase());
  const recipeText = [title, ...ingredients, ...steps].join(" ");

  const isBaking = /\b(bake|oven|cookie|brownie|cake|muffin|biscuit|scone)\b/.test(recipeText);
  const isCookies = /\bcookies?\b/.test(recipeText);
  const isSourdough = ingredients.some((item) => /\bsourdough\s+discard\b/.test(item));
  const hasBakeStep = steps.some((step) => /\b(bake|oven)\b/.test(step));
  const hasDoughChillStep = steps.some((step) => /\b(chill|refrigerat|rest)\b/.test(step) && /\bdough\b/.test(step));
  const mentionsParchment = steps.some((step) => /\bparchment\b/.test(step));
  const hasRaisins = ingredients.some((item) => /\braisins?\b/.test(item));
  const nonDairySignals = [
    /\bvegan butter\b/,
    /\bplant butter\b/,
    /\bcoconut oil\b/,
    /\boat milk\b/,
    /\balmond milk\b/,
    /\bsoy milk\b/,
    /\bnon-dairy\b/,
    /\bdairy-free\b/,
  ];
  const dairySignals = [/\bbutter\b/, /\bmilk\b/, /\bcream\b/, /\byogurt\b/, /\bcheese\b/];
  const isNonDairy =
    ingredients.some((item) => nonDairySignals.some((pattern) => pattern.test(item))) ||
    (recipeText.includes("non dairy") || recipeText.includes("non-dairy") || recipeText.includes("dairy free") || recipeText.includes("dairy-free")) ||
    !ingredients.some((item) => dairySignals.some((pattern) => pattern.test(item)));

  const bakeStepIndex = findStepIndex(steps, /\b(bake|oven)\b/);
  const coolStepIndex = findStepIndex(steps, /\b(cool|rest|set)\b/);
  const insights: ChefInsight[] = [];
  const stepTips: Array<{ stepIndex: number; text: string }> = [];
  const checklistItems: string[] = [];
  const riskFlags: string[] = [];

  if (isCookies && !hasDoughChillStep) {
    const chillText =
      isNonDairy || isSourdough
        ? "Chill the dough for 30 to 60 minutes before baking so the cookies hold their shape and bake thicker."
        : "Chill the dough for 30 minutes before baking for thicker cookies and less spread.";
    insights.push({
      id: "cookie_chill_step_missing",
      ruleType: isNonDairy || isSourdough ? "mandatory" : "recommended",
      text: chillText,
      stepIndex: bakeStepIndex >= 0 ? bakeStepIndex : null,
      checklistItem: "Chill the dough before baking.",
    });
    checklistItems.push("Chill the dough for 30 to 60 minutes before baking.");
    riskFlags.push("Spread risk");
    if (bakeStepIndex >= 0) {
      stepTips.push({
        stepIndex: bakeStepIndex,
        text: "Chill the dough first for thicker cookies and more even texture.",
      });
    }
  }

  if (isSourdough) {
    insights.push({
      id: "sourdough_balance",
      ruleType: "recommended",
      text: "Sourdough discard adds tang. Balance it with warm spices, vanilla, or a slight sweetness bump if the dough tastes sharp.",
      checklistItem: "Taste the dough base for tang before scooping.",
    });
    checklistItems.push("Balance sourdough tang with vanilla, spice, or a touch more sweetness if needed.");
  }

  if (isCookies && isNonDairy) {
    insights.push({
      id: "non_dairy_spread",
      ruleType: "warning",
      text: "Non-dairy fats soften faster than butter. Bake from cold dough and use parchment to keep spread under control.",
      stepIndex: bakeStepIndex >= 0 ? bakeStepIndex : null,
      checklistItem: "Bake the cookies from cold dough on a parchment-lined tray.",
    });
    checklistItems.push("Use parchment and keep the tray cold if the dough starts to soften.");
    riskFlags.push("Non-dairy fat melts quickly");
    if (bakeStepIndex >= 0) {
      stepTips.push({
        stepIndex: bakeStepIndex,
        text: "If the dough warms up while scooping, return it to the fridge before the tray goes into the oven.",
      });
    }
  }

  if (isBaking && !mentionsParchment) {
    insights.push({
      id: "parchment_consistency",
      ruleType: "recommended",
      text: "Line the pan with parchment for easier release and more even browning.",
      checklistItem: "Line the pan or tray with parchment.",
    });
  }

  if (isCookies && hasRaisins) {
    insights.push({
      id: "raisin_texture",
      ruleType: "recommended",
      text: "Hydrating raisins in warm water for 10 minutes keeps them plump and prevents dry pockets in the finished cookies.",
      checklistItem: "Hydrate raisins briefly if they feel dry.",
    });
  }

  if (isCookies && bakeStepIndex >= 0) {
    stepTips.push({
      stepIndex: bakeStepIndex,
      text: "Pull the tray when the edges are set and lightly golden but the centers still look slightly soft.",
    });
  }

  if (isBaking && coolStepIndex < 0) {
    insights.push({
      id: "cooling_step_missing",
      ruleType: "recommended",
      text: "Give baked goods a cooling window so structure finishes setting before you move or store them.",
      checklistItem: "Cool the baked goods on the tray for a few minutes before moving them.",
    });
  }

  const dedupedNotes = uniqueStrings([
    ...(input.notes?.split("\n") ?? []),
    ...insights.map((insight) => insight.text),
  ]);

  return {
    insights,
    notes: dedupedNotes.slice(0, 6),
    checklistItems: uniqueStrings(checklistItems).slice(0, 6),
    stepTips: stepTips
      .filter((tip, index, list) => list.findIndex((candidate) => candidate.stepIndex === tip.stepIndex && candidate.text === tip.text) === index)
      .slice(0, 6),
    riskFlags: uniqueStrings(riskFlags).slice(0, 4),
    analysis: {
      isBaking,
      isCookies,
      isSourdough,
      isNonDairy,
      hasBakeStep,
    },
  };
}

export function deriveChefActions(input: {
  userMessage: string;
  assistantReply?: string | null;
  recipe: ChefRecipeContext;
}): ChefEditAction[] {
  const combined = `${input.userMessage} ${input.assistantReply ?? ""}`.toLowerCase();
  const intelligence = buildChefIntelligence(input.recipe);
  const actions: ChefEditAction[] = [];

  if (
    (/\b(chill|refrigerat|rest)\b/.test(combined) && /\bdough\b/.test(combined)) ||
    intelligence.insights.some((insight) => insight.id === "cookie_chill_step_missing" && /\b(yes|should|need|must|recommend)\b/.test(combined))
  ) {
    actions.push({
      type: "add_step",
      stepPosition: "before_baking",
      content:
        intelligence.analysis.isCookies || intelligence.analysis.isBaking
          ? "Refrigerate the dough for 30 to 60 minutes before baking."
          : "Rest the mixture for 15 to 30 minutes before cooking.",
      rationale: "This adds the missing rest step that improves structure and consistency.",
    });
    actions.push({
      type: "add_chef_insight",
      content:
        intelligence.analysis.isNonDairy || intelligence.analysis.isSourdough
          ? "Chilling matters here because non-dairy fat and sourdough discard both increase spread risk."
          : "Chilling helps the dough hold its shape and develop better texture.",
      rationale: "This captures the chef reason behind the change.",
    });
  }

  if (
    /\b(doneness|overbake|underdone|how do i know|how to tell when)\b/.test(combined) ||
    (/edges/.test(combined) && /soft/.test(combined))
  ) {
    actions.push({
      type: "insert_doneness_cue",
      content:
        intelligence.analysis.isCookies
          ? "Bake until the edges are set and lightly golden while the centers still look slightly soft."
          : "Cook until the color and texture match the target doneness before relying on time alone.",
      rationale: "This gives the user a sensory cue instead of a time-only instruction.",
    });
  }

  if (intelligence.analysis.isSourdough && /\b(sourdough|tang|acid)\b/.test(combined)) {
    actions.push({
      type: "add_note",
      content: "If your discard tastes especially tangy, round it out with a touch more vanilla or a slight sugar increase.",
      rationale: "This helps the user manage sourdough acidity across different starters.",
    });
  }

  if (intelligence.analysis.isNonDairy && /\b(non[- ]dairy|dairy[- ]free|vegan|spread)\b/.test(combined)) {
    actions.push({
      type: "add_note",
      content: "Non-dairy fats soften quickly, so keep the dough cold and bake on parchment for better structure.",
      rationale: "This warns the cook about the main texture risk in the formula.",
    });
  }

  return actions.filter(
    (action, index, list) =>
      list.findIndex((candidate) => candidate.type === action.type && candidate.content === action.content) === index
  );
}

export function applyChefActions(
  recipe: ChefRecipeContext,
  actions: ChefEditAction[]
): {
  ingredients: Array<{ name: string }>;
  steps: Array<{ text: string }>;
  notes: string | null;
  explanation: string | null;
} {
  const nextIngredients = recipe.ingredients.map((name) => ({ name }));
  const nextSteps = recipe.steps.map((text) => ({ text: text.trim() }));
  const noteLines = uniqueStrings(recipe.notes?.split("\n") ?? []);
  const rationaleLines: string[] = [];

  const bakeIndex = findStepIndex(recipe.steps, /\b(bake|oven)\b/i);
  const serveIndex = findStepIndex(recipe.steps, /\b(serve|plate)\b/i);

  for (const action of actions) {
    rationaleLines.push(action.rationale);

    if (action.type === "add_step") {
      const insertAt =
        typeof action.stepIndex === "number"
          ? Math.max(0, Math.min(action.stepIndex, nextSteps.length))
          : action.stepPosition === "before_baking" && bakeIndex >= 0
          ? bakeIndex
          : action.stepPosition === "after_baking" && bakeIndex >= 0
          ? bakeIndex + 1
          : action.stepPosition === "before_serving" && serveIndex >= 0
          ? serveIndex
          : nextSteps.length;
      if (!nextSteps.some((step) => step.text.toLowerCase() === action.content.toLowerCase())) {
        nextSteps.splice(insertAt, 0, { text: action.content });
      }
      continue;
    }

    if (action.type === "modify_step") {
      const existing = nextSteps[action.stepIndex];
      if (existing) {
        existing.text = appendSentence(existing.text, action.content);
      }
      continue;
    }

    if (action.type === "insert_doneness_cue" || action.type === "insert_rest_time") {
      const targetIndex = typeof action.stepIndex === "number" ? action.stepIndex : bakeIndex >= 0 ? bakeIndex : nextSteps.length - 1;
      const existing = nextSteps[targetIndex];
      if (existing) {
        existing.text = appendSentence(existing.text, action.content);
      }
      continue;
    }

    if (!noteLines.some((line) => line.toLowerCase() === action.content.toLowerCase())) {
      noteLines.push(action.content);
    }
  }

  const intelligence = buildChefIntelligence({
    ...recipe,
    notes: noteLines.join("\n"),
    steps: nextSteps.map((step) => step.text),
  });

  return {
    ingredients: nextIngredients,
    steps: nextSteps,
    notes: uniqueStrings([...noteLines, ...intelligence.notes]).join("\n") || null,
    explanation: uniqueStrings(rationaleLines).join(" ") || null,
  };
}
