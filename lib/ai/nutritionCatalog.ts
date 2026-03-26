/**
 * Nutrition catalog
 *
 * Per-100g macro values for common ingredients.
 * Conservative coverage is intentional — bad data is worse than missing data.
 * Values are kitchen-working approximations, not USDA precision.
 */

import type { NutritionCatalogEntry } from "./nutritionTypes";

export const NUTRITION_CATALOG: NutritionCatalogEntry[] = [
  // ── Proteins ──────────────────────────────────────────────────────────────
  {
    key: "chicken_breast",
    displayName: "Chicken Breast",
    aliases: ["chicken breast", "chicken", "boneless chicken", "chicken fillet", "grilled chicken"],
    per100g: { calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6, sodium_mg: 74 },
  },
  {
    key: "ground_beef",
    displayName: "Ground Beef (80/20)",
    aliases: ["ground beef", "beef mince", "minced beef", "hamburger meat"],
    per100g: { calories: 254, protein_g: 17, carbs_g: 0, fat_g: 20, sodium_mg: 75 },
  },
  {
    key: "salmon",
    displayName: "Salmon",
    aliases: ["salmon", "salmon fillet", "atlantic salmon"],
    per100g: { calories: 208, protein_g: 20, carbs_g: 0, fat_g: 13, sodium_mg: 59 },
  },
  {
    key: "eggs",
    displayName: "Eggs",
    aliases: ["egg", "eggs", "whole egg", "large egg"],
    per100g: { calories: 155, protein_g: 13, carbs_g: 1.1, fat_g: 11, sodium_mg: 124 },
  },
  {
    key: "tofu",
    displayName: "Tofu (firm)",
    aliases: ["tofu", "firm tofu", "extra firm tofu"],
    per100g: { calories: 76, protein_g: 8, carbs_g: 1.9, fat_g: 4.8, sodium_mg: 7 },
  },

  // ── Dairy ─────────────────────────────────────────────────────────────────
  {
    key: "whole_milk",
    displayName: "Whole Milk",
    aliases: ["milk", "whole milk", "full fat milk"],
    per100g: { calories: 61, protein_g: 3.2, carbs_g: 4.8, fat_g: 3.3, sodium_mg: 43 },
  },
  {
    key: "heavy_cream",
    displayName: "Heavy Cream",
    aliases: ["heavy cream", "heavy whipping cream", "whipping cream", "double cream"],
    per100g: { calories: 345, protein_g: 2.1, carbs_g: 2.8, fat_g: 37, sodium_mg: 38 },
  },
  {
    key: "butter",
    displayName: "Butter",
    aliases: ["butter", "unsalted butter", "salted butter"],
    per100g: { calories: 717, protein_g: 0.9, carbs_g: 0.1, fat_g: 81, sodium_mg: 11 },
  },
  {
    key: "cream_cheese",
    displayName: "Cream Cheese",
    aliases: ["cream cheese", "full fat cream cheese"],
    per100g: { calories: 342, protein_g: 6, carbs_g: 4.1, fat_g: 34, sodium_mg: 321 },
  },
  {
    key: "parmesan",
    displayName: "Parmesan Cheese",
    aliases: ["parmesan", "parmesan cheese", "grated parmesan", "parmigiano"],
    per100g: { calories: 431, protein_g: 38, carbs_g: 4.1, fat_g: 29, sodium_mg: 1529 },
  },
  {
    key: "greek_yogurt",
    displayName: "Greek Yogurt",
    aliases: ["greek yogurt", "plain greek yogurt", "strained yogurt"],
    per100g: { calories: 97, protein_g: 9, carbs_g: 3.6, fat_g: 5, sodium_mg: 36 },
  },

  // ── Grains & Starches ─────────────────────────────────────────────────────
  {
    key: "all_purpose_flour",
    displayName: "All-Purpose Flour",
    aliases: ["all purpose flour", "all-purpose flour", "flour", "plain flour", "white flour"],
    per100g: { calories: 364, protein_g: 10, carbs_g: 76, fat_g: 1, fiber_g: 2.7, sodium_mg: 2 },
  },
  {
    key: "white_rice",
    displayName: "White Rice (cooked)",
    aliases: ["white rice", "rice", "cooked rice", "long grain rice"],
    per100g: { calories: 130, protein_g: 2.7, carbs_g: 28, fat_g: 0.3, sodium_mg: 1 },
  },
  {
    key: "pasta",
    displayName: "Pasta (cooked)",
    aliases: ["pasta", "spaghetti", "penne", "fettuccine", "linguine", "rigatoni", "cooked pasta"],
    per100g: { calories: 131, protein_g: 5, carbs_g: 25, fat_g: 1.1, fiber_g: 1.8, sodium_mg: 1 },
  },
  {
    key: "bread",
    displayName: "White Bread",
    aliases: ["bread", "white bread", "sandwich bread", "bread slice"],
    per100g: { calories: 265, protein_g: 9, carbs_g: 49, fat_g: 3.2, fiber_g: 2.7, sodium_mg: 491 },
  },
  {
    key: "oats",
    displayName: "Rolled Oats",
    aliases: ["oats", "rolled oats", "oatmeal", "quick oats"],
    per100g: { calories: 389, protein_g: 17, carbs_g: 66, fat_g: 7, fiber_g: 11, sodium_mg: 2 },
  },

  // ── Sweeteners ────────────────────────────────────────────────────────────
  {
    key: "sugar",
    displayName: "Granulated Sugar",
    aliases: ["sugar", "granulated sugar", "white sugar", "cane sugar"],
    per100g: { calories: 387, protein_g: 0, carbs_g: 100, fat_g: 0, sodium_mg: 1 },
  },
  {
    key: "brown_sugar",
    displayName: "Brown Sugar",
    aliases: ["brown sugar", "light brown sugar", "dark brown sugar"],
    per100g: { calories: 380, protein_g: 0, carbs_g: 98, fat_g: 0, sodium_mg: 28 },
  },
  {
    key: "honey",
    displayName: "Honey",
    aliases: ["honey", "raw honey"],
    per100g: { calories: 304, protein_g: 0.3, carbs_g: 82, fat_g: 0, sodium_mg: 4 },
  },

  // ── Fats & Oils ───────────────────────────────────────────────────────────
  {
    key: "olive_oil",
    displayName: "Olive Oil",
    aliases: ["olive oil", "extra virgin olive oil", "evoo"],
    per100g: { calories: 884, protein_g: 0, carbs_g: 0, fat_g: 100, sodium_mg: 2 },
  },
  {
    key: "vegetable_oil",
    displayName: "Vegetable Oil",
    aliases: ["vegetable oil", "canola oil", "sunflower oil", "neutral oil"],
    per100g: { calories: 884, protein_g: 0, carbs_g: 0, fat_g: 100, sodium_mg: 0 },
  },

  // ── Vegetables ────────────────────────────────────────────────────────────
  {
    key: "onion",
    displayName: "Onion",
    aliases: ["onion", "yellow onion", "white onion", "onions"],
    per100g: { calories: 40, protein_g: 1.1, carbs_g: 9.3, fat_g: 0.1, fiber_g: 1.7, sodium_mg: 4 },
  },
  {
    key: "garlic",
    displayName: "Garlic",
    aliases: ["garlic", "garlic cloves", "garlic clove"],
    per100g: { calories: 149, protein_g: 6.4, carbs_g: 33, fat_g: 0.5, fiber_g: 2.1, sodium_mg: 17 },
  },
  {
    key: "tomato",
    displayName: "Tomato",
    aliases: ["tomato", "tomatoes", "roma tomato", "cherry tomatoes", "fresh tomatoes"],
    per100g: { calories: 18, protein_g: 0.9, carbs_g: 3.9, fat_g: 0.2, fiber_g: 1.2, sodium_mg: 5 },
  },
  {
    key: "spinach",
    displayName: "Spinach",
    aliases: ["spinach", "fresh spinach", "baby spinach"],
    per100g: { calories: 23, protein_g: 2.9, carbs_g: 3.6, fat_g: 0.4, fiber_g: 2.2, sodium_mg: 79 },
  },
  {
    key: "broccoli",
    displayName: "Broccoli",
    aliases: ["broccoli", "broccoli florets"],
    per100g: { calories: 34, protein_g: 2.8, carbs_g: 7, fat_g: 0.4, fiber_g: 2.6, sodium_mg: 33 },
  },
  {
    key: "bell_pepper",
    displayName: "Bell Pepper",
    aliases: ["bell pepper", "red bell pepper", "green bell pepper", "yellow bell pepper", "capsicum"],
    per100g: { calories: 31, protein_g: 1, carbs_g: 6, fat_g: 0.3, fiber_g: 2.1, sodium_mg: 4 },
  },
  {
    key: "carrot",
    displayName: "Carrot",
    aliases: ["carrot", "carrots"],
    per100g: { calories: 41, protein_g: 0.9, carbs_g: 10, fat_g: 0.2, fiber_g: 2.8, sodium_mg: 69 },
  },
  {
    key: "potato",
    displayName: "Potato",
    aliases: ["potato", "potatoes", "russet potato", "yukon gold potato"],
    per100g: { calories: 77, protein_g: 2, carbs_g: 17, fat_g: 0.1, fiber_g: 2.2, sodium_mg: 6 },
  },

  // ── Legumes ───────────────────────────────────────────────────────────────
  {
    key: "black_beans",
    displayName: "Black Beans (cooked)",
    aliases: ["black beans", "cooked black beans", "canned black beans"],
    per100g: { calories: 132, protein_g: 8.9, carbs_g: 24, fat_g: 0.5, fiber_g: 8.7, sodium_mg: 1 },
  },
  {
    key: "chickpeas",
    displayName: "Chickpeas (cooked)",
    aliases: ["chickpeas", "garbanzo beans", "canned chickpeas", "cooked chickpeas"],
    per100g: { calories: 164, protein_g: 8.9, carbs_g: 27, fat_g: 2.6, fiber_g: 7.6, sodium_mg: 7 },
  },

  // ── Baking components ─────────────────────────────────────────────────────
  {
    key: "cocoa_powder",
    displayName: "Cocoa Powder",
    aliases: ["cocoa powder", "unsweetened cocoa powder", "dutch process cocoa"],
    per100g: { calories: 228, protein_g: 20, carbs_g: 58, fat_g: 14, fiber_g: 33, sodium_mg: 21 },
  },
  {
    key: "chocolate_chips",
    displayName: "Chocolate Chips",
    aliases: ["chocolate chips", "semi sweet chocolate chips", "dark chocolate chips", "chocolate"],
    per100g: { calories: 479, protein_g: 5.5, carbs_g: 64, fat_g: 27, fiber_g: 7, sodium_mg: 24 },
  },

  // ── Misc ──────────────────────────────────────────────────────────────────
  {
    key: "salt",
    displayName: "Salt",
    aliases: ["salt", "table salt", "kosher salt", "sea salt"],
    per100g: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, sodium_mg: 38758 },
  },
  {
    key: "soy_sauce",
    displayName: "Soy Sauce",
    aliases: ["soy sauce", "low sodium soy sauce", "tamari", "shoyu"],
    per100g: { calories: 53, protein_g: 8.1, carbs_g: 4.9, fat_g: 0.6, sodium_mg: 5493 },
  },
];
