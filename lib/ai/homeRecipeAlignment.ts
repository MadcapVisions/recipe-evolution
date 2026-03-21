type HomeRecipeLike = {
  title: string;
  description: string | null;
  ingredients: Array<{ name: string }>;
  steps: Array<{ text: string }>;
};

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

export function detectRequestedDishFamily(context: string) {
  const normalized = normalizeText(context);

  if (includesAny(normalized, ["focaccia pizza", "pizza", "focaccia", "flatbread"])) {
    return "pizza";
  }
  if (includesAny(normalized, ["pasta", "linguine", "fettuccine", "spaghetti", "penne", "rigatoni", "noodle", "noodles"])) {
    return "pasta";
  }
  if (includesAny(normalized, ["taco", "tacos", "tostada", "tostadas", "wrap"])) {
    return "tacos";
  }
  if (includesAny(normalized, ["soup", "stew", "congee", "moqueca"])) {
    return "soup";
  }
  if (includesAny(normalized, ["salad"])) {
    return "salad";
  }
  if (includesAny(normalized, ["dip", "spread", "salata de vinete", "salată de vinete"])) {
    return "dip";
  }
  if (includesAny(normalized, ["skillet"])) {
    return "skillet";
  }
  if (includesAny(normalized, ["roasted", "sheet pan"])) {
    return "roasted";
  }
  if (includesAny(normalized, ["rice bowl", "grain bowl", "bowl"])) {
    return "bowl";
  }

  return null;
}

function detectRequestedProtein(context: string) {
  const normalized = normalizeText(context);
  const proteins = ["chicken", "turkey", "shrimp", "salmon", "fish", "beef", "pork", "tofu", "beans", "chickpeas", "eggs"];
  return proteins.find((protein) => normalized.includes(protein)) ?? null;
}

function detectRequestedAnchorIngredient(context: string) {
  const normalized = normalizeText(context);
  const anchors = [
    "eggplant", "aubergine", "vinete",
    "zucchini", "courgette",
    "broccoli", "cauliflower",
    "tomato", "tomatoes",
    "mushroom", "mushrooms",
    "sweet potato", "squash", "butternut",
    "spinach", "kale",
    "corn", "asparagus", "leek", "leeks",
    "cabbage", "fennel", "beet", "beets",
  ];
  return anchors.find((item) => normalized.includes(item)) ?? null;
}

export function deriveIdeaTitleFromConversationContext(context: string) {
  const normalized = normalizeText(context);
  const family = detectRequestedDishFamily(normalized);
  const protein = detectRequestedProtein(normalized);
  const anchor = detectRequestedAnchorIngredient(normalized);
  const namedDishPatterns = [
    { terms: ["spaghetti carbonara", "carbonara"], title: "Spaghetti Carbonara" },
    { terms: ["chicken-filled ravioli", "fresh ravioli", "ravioli"], title: "Ravioli" },
    { terms: ["salata de vinete", "salată de vinete"], title: "Salata de Vinete" },
    { terms: ["flatbread-style pizza", "flatbread pizza"], title: "Flatbread Pizza" },
    { terms: ["crispy chicken tostadas with avocado crema", "chicken tostadas with avocado crema", "chicken tostadas", "tostadas"], title: "Chicken Tostadas" },
    { terms: ["chicken fajita bowls", "chicken fajita bowl", "fajita bowls", "fajita bowl"], title: "Chicken Fajita Bowl" },
    { terms: ["okonomiyaki"], title: "Okonomiyaki" },
    { terms: ["adjarian khachapuri", "khachapuri"], title: "Adjarian Khachapuri" },
    { terms: ["socca"], title: "Socca" },
    { terms: ["pupusas", "pupusa"], title: "Pupusas" },
    { terms: ["masala dosa", "dosa"], title: "Masala Dosa" },
    { terms: ["gozleme", "gözleme"], title: "Gozleme" },
    { terms: ["injera platter", "injera"], title: "Injera Platter" },
    { terms: ["century egg and pork congee", "century egg congee", "congee"], title: "Century Egg and Pork Congee" },
    { terms: ["turkish manti", "manti"], title: "Turkish Manti" },
    { terms: ["brazilian moqueca", "moqueca"], title: "Brazilian Moqueca" },
  ];

  for (const pattern of namedDishPatterns) {
    if (includesAny(normalized, pattern.terms)) {
      return pattern.title;
    }
  }

  if (family === "pizza") {
    if (normalized.includes("focaccia")) return "Focaccia Pizza";
    if (protein) return `${protein.charAt(0).toUpperCase() + protein.slice(1)} Pizza`;
    return "Pizza";
  }

  if (family === "pasta") {
    if (anchor === "eggplant" || anchor === "aubergine" || anchor === "vinete") return "Eggplant Pasta";
    if (protein) return `${protein.charAt(0).toUpperCase() + protein.slice(1)} Pasta`;
    return "Pasta";
  }

  if (family === "skillet") {
    if (protein) return `${protein.charAt(0).toUpperCase() + protein.slice(1)} Skillet`;
    return "Skillet Dinner";
  }

  if (family === "bowl") {
    if (protein) return `${protein.charAt(0).toUpperCase() + protein.slice(1)} Bowl`;
    return "Rice Bowl";
  }

  if (family === "salad") {
    if (protein) return `${protein.charAt(0).toUpperCase() + protein.slice(1)} Salad`;
    return "Salad";
  }

  if (family === "tacos") {
    if (protein) return `${protein.charAt(0).toUpperCase() + protein.slice(1)} Tacos`;
    return "Tacos";
  }

  if (family === "soup") {
    if (protein) return `${protein.charAt(0).toUpperCase() + protein.slice(1)} Soup`;
    return "Soup";
  }

  if (family === "dip") {
    if (anchor === "eggplant" || anchor === "aubergine" || anchor === "vinete") return "Eggplant Dip";
    return "Dip";
  }

  if (protein) {
    return `${protein.charAt(0).toUpperCase() + protein.slice(1)} Dish`;
  }

  if (anchor) {
    return `${anchor.charAt(0).toUpperCase() + anchor.slice(1)} Dish`;
  }

  return "Chef Conversation Recipe";
}

export function recipeMatchesRequestedDirection(recipe: HomeRecipeLike, context: string) {
  const normalizedContext = normalizeText(context);
  const recipeText = normalizeText(
    `${recipe.title} ${recipe.description ?? ""} ${recipe.ingredients.map((item) => item.name).join(" ")} ${recipe.steps.map((item) => item.text).join(" ")}`
  );
  const titleAndDescription = normalizeText(`${recipe.title} ${recipe.description ?? ""}`);
  const requestedFamily = detectRequestedDishFamily(normalizedContext);
  const requestedProtein = detectRequestedProtein(normalizedContext);
  const requestedAnchor = detectRequestedAnchorIngredient(normalizedContext);

  if (
    requestedFamily === "pizza" &&
    !includesAny(recipeText, ["pizza", "focaccia", "flatbread", "dough", "crust", "mozzarella", "bake until the crust", "bake until golden"])
  ) {
    return false;
  }

  if (requestedFamily === "pasta" && !includesAny(recipeText, ["pasta", "linguine", "fettuccine", "spaghetti", "penne", "rigatoni", "noodle", "noodles"])) {
    return false;
  }
  if (requestedFamily === "bowl" && !includesAny(recipeText, ["bowl", "rice", "grain", "quinoa", "farro", "serve over", "served over", "topped with", "over rice", "over grains", "base"])) {
    return false;
  }
  if (requestedFamily === "salad" && !includesAny(recipeText, ["salad", "greens", "vinaigrette"])) {
    return false;
  }
  if (requestedFamily === "soup" && !includesAny(recipeText, ["soup", "stew", "broth", "simmer"])) {
    return false;
  }
  if (requestedFamily === "tacos" && !includesAny(recipeText, ["taco", "tortilla"])) {
    return false;
  }
  if (requestedFamily === "dip" && !includesAny(recipeText, ["dip", "spread", "serve cool", "room temperature"])) {
    return false;
  }
  if (requestedFamily === "skillet" && !includesAny(recipeText, ["skillet", "pan"])) {
    return false;
  }

  if (requestedFamily === "pasta" && includesAny(titleAndDescription, ["rice bowl", "grain bowl", " bowl"]) && !includesAny(titleAndDescription, ["pasta", "noodle"])) {
    return false;
  }

  if (requestedProtein && !recipeText.includes(requestedProtein)) {
    return false;
  }

  if (requestedAnchor) {
    const anchorAliases: Record<string, string[]> = {
      eggplant: ["eggplant", "aubergine", "vinete"],
      aubergine: ["eggplant", "aubergine", "vinete"],
      vinete: ["eggplant", "aubergine", "vinete"],
      courgette: ["zucchini", "courgette"],
      "sweet potato": ["sweet potato"],
      butternut: ["butternut", "squash"],
    };
    const aliases = anchorAliases[requestedAnchor] ?? [requestedAnchor];
    if (!includesAny(recipeText, aliases)) {
      return false;
    }
  }

  return true;
}
