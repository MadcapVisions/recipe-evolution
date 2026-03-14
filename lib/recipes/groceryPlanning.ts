import { combineMeasuredQuantities, normalizeMeasurementUnit } from "./measurements";

export type GroceryPlanningItem = {
  id: string;
  name: string;
  normalized_name: string;
  quantity: number | null;
  unit: string | null;
  prep: string | null;
  checked: boolean;
};

export type GroceryGroup = {
  aisle: string;
  items: GroceryPlanningItem[];
};

const DESCRIPTOR_WORDS = new Set([
  "fresh",
  "large",
  "small",
  "medium",
  "extra",
  "virgin",
  "boneless",
  "skinless",
  "ground",
  "lean",
  "packed",
  "optional",
]);

const AISLE_RULES: Array<{ aisle: string; keywords: string[] }> = [
  { aisle: "Produce", keywords: ["onion", "garlic", "tomato", "lettuce", "spinach", "basil", "cilantro", "lemon", "lime", "pepper", "carrot", "celery", "potato", "avocado", "apple", "banana", "eggplant", "aubergine", "fresh"] },
  { aisle: "Meat & Seafood", keywords: ["chicken", "beef", "pork", "turkey", "salmon", "shrimp", "tuna", "sausage", "bacon"] },
  { aisle: "Dairy & Eggs", keywords: ["milk", "butter", "cheese", "cream", "yogurt", "egg", "eggs", "parmesan", "mozzarella"] },
  { aisle: "Bakery & Bread", keywords: ["bread", "bun", "roll", "tortilla", "pita", "bagel"] },
  { aisle: "Canned & Jarred", keywords: ["beans", "broth", "stock", "tomato paste", "tomatoes", "can", "cans", "coconut milk"] },
  { aisle: "Dry Goods", keywords: ["rice", "pasta", "flour", "sugar", "oats", "quinoa", "lentils", "breadcrumbs"] },
  { aisle: "Spices & Oils", keywords: ["salt", "pepper", "paprika", "cumin", "oregano", "thyme", "oil", "vinegar", "soy sauce", "hot sauce", "honey", "mustard"] },
  { aisle: "Frozen", keywords: ["frozen", "peas", "corn"] },
];

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function singularize(token: string) {
  if (token.endsWith("ies") && token.length > 3) return `${token.slice(0, -3)}y`;
  if (token.endsWith("oes") && token.length > 3) return token.slice(0, -2);
  if (token.endsWith("s") && !token.endsWith("ss") && token.length > 3) return token.slice(0, -1);
  return token;
}

function normalizedIngredientKey(value: string) {
  return normalize(value)
    .replace(/[(),]/g, " ")
    .split(/\s+/)
    .map((token) => singularize(token))
    .filter((token) => token.length > 1 && !DESCRIPTOR_WORDS.has(token))
    .join(" ");
}

function sharedTokenCount(a: string, b: string) {
  const left = new Set(a.split(/\s+/).filter(Boolean));
  const right = new Set(b.split(/\s+/).filter(Boolean));
  let count = 0;
  for (const token of left) {
    if (right.has(token)) {
      count += 1;
    }
  }
  return count;
}

function matchesPantry(itemName: string, pantryStaples: string[]) {
  const item = normalizedIngredientKey(itemName);
  return pantryStaples.some((staple) => {
    const normalizedStaple = normalizedIngredientKey(staple);
    if (!normalizedStaple) {
      return false;
    }

    return (
      item === normalizedStaple ||
      item.includes(normalizedStaple) ||
      normalizedStaple.includes(item) ||
      sharedTokenCount(item, normalizedStaple) >= Math.min(2, normalizedStaple.split(/\s+/).length)
    );
  });
}

export function classifyGroceryAisle(itemName: string) {
  const normalized = normalizedIngredientKey(itemName);
  for (const rule of AISLE_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      return rule.aisle;
    }
  }
  return "Other";
}

export function buildGroceryPlan(items: GroceryPlanningItem[], pantryStaples: string[]) {
  const pantryItems: GroceryPlanningItem[] = [];
  const neededItems: GroceryPlanningItem[] = [];

  for (const item of items) {
    if (matchesPantry(item.name || item.normalized_name, pantryStaples)) {
      pantryItems.push(item);
    } else {
      neededItems.push(item);
    }
  }

  const consolidatedNeededItems = new Map<string, GroceryPlanningItem>();
  for (const item of neededItems) {
    const key = `${normalizedIngredientKey(item.name || item.normalized_name)}|${normalizeMeasurementUnit(item.unit) ?? ""}|${item.checked ? "checked" : "open"}`;
    const existing = consolidatedNeededItems.get(key);

    if (!existing) {
      consolidatedNeededItems.set(key, {
        ...item,
        unit: normalizeMeasurementUnit(item.unit),
      });
      continue;
    }

    const combined = combineMeasuredQuantities(
      { quantity: existing.quantity, unit: existing.unit },
      { quantity: item.quantity, unit: item.unit }
    );
    existing.quantity = combined.quantity;
    existing.unit = combined.unit;

    if (!existing.prep && item.prep) {
      existing.prep = item.prep;
    }
  }

  const flexibleItems = Array.from(consolidatedNeededItems.values())
    .filter((item) => item.quantity == null)
    .sort((a, b) => a.name.localeCompare(b.name));
  const measuredItems = Array.from(consolidatedNeededItems.values()).filter((item) => item.quantity != null);

  const groupMap = new Map<string, GroceryPlanningItem[]>();
  for (const item of measuredItems) {
    const aisle = classifyGroceryAisle(item.name || item.normalized_name);
    const current = groupMap.get(aisle) ?? [];
    current.push(item);
    groupMap.set(aisle, current);
  }

  const groupedItems: GroceryGroup[] = Array.from(groupMap.entries())
    .sort(([aisleA], [aisleB]) => aisleA.localeCompare(aisleB))
    .map(([aisle, grouped]) => ({
      aisle,
      items: grouped.sort((a, b) => a.name.localeCompare(b.name)),
    }));

  return {
    groupedItems,
    flexibleItems,
    pantryItems: pantryItems.sort((a, b) => a.name.localeCompare(b.name)),
    neededItems: Array.from(consolidatedNeededItems.values()),
  };
}
