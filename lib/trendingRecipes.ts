export type TrendingRecipe = {
  title: string;
  description: string;
  cookTime: string;
  tags: string[];
};

export const trendingRecipes: TrendingRecipe[] = [
  {
    title: "Spicy Chicken Rice Bowl",
    description:
      "A high-protein rice bowl with garlic-scallion rice, chili-glazed chicken, and cool crunchy vegetables. The contrast between savory heat, fresh herbs, and a bright finish makes it feel more layered than a standard meal-prep bowl.",
    cookTime: "25 min",
    tags: ["protein", "spicy", "bowl"],
  },
  {
    title: "Creamy Lemon Chicken Pasta",
    description:
      "Rich pasta with a silky lemon-garlic cream sauce, tender chicken, and a bright parmesan finish. It stands out because the citrus keeps the dish lively instead of heavy, so it feels cozy and polished at the same time.",
    cookTime: "30 min",
    tags: ["pasta", "comfort"],
  },
  {
    title: "Mediterranean Chickpea Skillet",
    description:
      "A tomato-herb chickpea skillet with briny feta, soft onions, and plenty of fresh herbs. It tastes distinct because it balances warm savory depth with lemony brightness and a salty finish.",
    cookTime: "20 min",
    tags: ["healthy", "vegetarian"],
  },
  {
    title: "Chipotle Chicken Taco Bowl",
    description:
      "A smoky chipotle chicken bowl with lime rice, charred corn, and taco-style toppings. What makes it unique is the combination of fire-roasted depth, fresh acidity, and creamy elements in every bite.",
    cookTime: "25 min",
    tags: ["mexican", "protein"],
  },
  {
    title: "Garlic Shrimp Stir Fry",
    description:
      "Quick shrimp stir-fry with crisp vegetables and a glossy soy-garlic sauce that clings to everything. It feels sharper and more restaurant-like because of the ginger, sesame, and fast high-heat finish.",
    cookTime: "15 min",
    tags: ["asian", "quick"],
  },
  {
    title: "Crispy Gochujang Noodles",
    description:
      "Sweet-spicy Korean noodles with caramelized gochujang edges, crisp vegetables, and a savory sesame finish. The standout flavor is the mix of sticky heat, gentle sweetness, and crunchy texture.",
    cookTime: "20 min",
    tags: ["korean", "spicy"],
  },
];
