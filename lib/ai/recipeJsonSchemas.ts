export const RECIPE_OUTLINE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "dish_family", "primary_ingredient", "ingredient_groups", "step_outline", "chef_tip_topics"],
  properties: {
    title: { type: "string" },
    summary: { type: ["string", "null"] },
    dish_family: { type: ["string", "null"] },
    primary_ingredient: { type: ["string", "null"] },
    ingredient_groups: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "items"],
        properties: {
          name: { type: "string" },
          items: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    },
    step_outline: {
      type: "array",
      items: { type: "string" },
    },
    chef_tip_topics: {
      type: "array",
      items: { type: "string" },
    },
  },
} as const;

export const HOME_RECIPE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "description", "servings", "prep_time_min", "cook_time_min", "difficulty", "ingredients", "steps", "chefTips"],
  properties: {
    title: { type: "string" },
    description: { type: ["string", "null"] },
    servings: { type: ["number", "null"] },
    prep_time_min: { type: ["number", "null"] },
    cook_time_min: { type: ["number", "null"] },
    difficulty: { type: ["string", "null"] },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "quantity", "unit", "prep"],
        properties: {
          name: { type: "string" },
          quantity: { type: ["number", "null"] },
          unit: { type: ["string", "null"] },
          prep: { type: ["string", "null"] },
        },
      },
    },
    steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "methodTag", "estimatedMinutes"],
        properties: {
          text: { type: "string" },
          methodTag: {
            type: ["string", "null"],
            enum: [
              "mix", "bake", "boil", "simmer", "saute", "grill", "fry",
              "blend", "assemble", "chill", "rest", "toast", "reduce",
              "steam", "whisk", "fold", "combine", "cook", "high_heat", null,
            ],
          },
          estimatedMinutes: { type: ["number", "null"] },
        },
      },
    },
    chefTips: {
      type: "array",
      items: { type: "string" },
    },
  },
} as const;

export const RECIPE_INGREDIENT_SECTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["servings", "prep_time_min", "cook_time_min", "difficulty", "ingredients"],
  properties: {
    servings: { type: ["number", "null"] },
    prep_time_min: { type: ["number", "null"] },
    cook_time_min: { type: ["number", "null"] },
    difficulty: { type: ["string", "null"] },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "quantity", "unit", "prep"],
        properties: {
          name: { type: "string" },
          quantity: { type: ["number", "null"] },
          unit: { type: ["string", "null"] },
          prep: { type: ["string", "null"] },
        },
      },
    },
  },
} as const;

export const RECIPE_INSTRUCTION_SECTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["description", "steps", "chefTips"],
  properties: {
    description: { type: ["string", "null"] },
    steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "methodTag", "estimatedMinutes"],
        properties: {
          text: { type: "string" },
          methodTag: {
            type: ["string", "null"],
            enum: [
              "mix", "bake", "boil", "simmer", "saute", "grill", "fry",
              "blend", "assemble", "chill", "rest", "toast", "reduce",
              "steam", "whisk", "fold", "combine", "cook", "high_heat", null,
            ],
          },
          estimatedMinutes: { type: ["number", "null"] },
        },
      },
    },
    chefTips: {
      type: "array",
      items: { type: "string" },
    },
  },
} as const;
