export const RECIPE_TEMPLATES = {
  pasta: {
    structure: `
Recipe Type: Pasta

Steps Structure:

1. Boil salted water and cook pasta until al dente.
2. Cook protein or vegetables in olive oil.
3. Add aromatics such as garlic or onion.
4. Add sauce ingredients and simmer.
5. Toss pasta with sauce.
6. Finish with herbs and cheese.
`,
  },

  stir_fry: {
    structure: `
Recipe Type: Stir Fry

Steps Structure:

1. Heat oil in a wok or skillet.
2. Cook protein until browned.
3. Remove protein.
4. Stir fry vegetables quickly.
5. Add sauce ingredients.
6. Return protein and toss.
`,
  },

  sheet_pan: {
    structure: `
Recipe Type: Sheet Pan Dinner

Steps Structure:

1. Preheat oven to 400°F.
2. Toss protein and vegetables with oil and seasoning.
3. Spread evenly on sheet pan.
4. Roast until browned and cooked through.
`,
  },

  soup: {
    structure: `
Recipe Type: Soup

Steps Structure:

1. Saute aromatics in oil or butter.
2. Add vegetables and cook briefly.
3. Add broth or liquid.
4. Simmer until ingredients are tender.
5. Adjust seasoning and finish with herbs.
`,
  },

  sandwich: {
    structure: `
Recipe Type: Sandwich

Steps Structure:

1. Prepare bread or toast lightly.
2. Cook protein or main filling.
3. Prepare toppings and vegetables.
4. Assemble sandwich.
5. Add sauce or dressing.
`,
  },
} as const;

