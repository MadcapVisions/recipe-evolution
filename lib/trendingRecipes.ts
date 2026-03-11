export type TrendingRecipe = {
  title: string;
  description: string;
  cookTime: string;
  tags: string[];
};

export const trendingRecipes: TrendingRecipe[] = [
  {
    title: "Spicy Chicken Rice Bowl",
    description: "High protein comfort bowl with garlic rice and chili chicken",
    cookTime: "25 min",
    tags: ["protein", "spicy", "bowl"],
  },
  {
    title: "Creamy Lemon Chicken Pasta",
    description: "Rich pasta with lemon garlic cream sauce",
    cookTime: "30 min",
    tags: ["pasta", "comfort"],
  },
  {
    title: "Mediterranean Chickpea Skillet",
    description: "Healthy chickpeas with tomato, herbs and feta",
    cookTime: "20 min",
    tags: ["healthy", "vegetarian"],
  },
  {
    title: "Chipotle Chicken Taco Bowl",
    description: "Street taco inspired rice bowl with smoky chipotle chicken",
    cookTime: "25 min",
    tags: ["mexican", "protein"],
  },
  {
    title: "Garlic Shrimp Stir Fry",
    description: "Quick shrimp stir fry with vegetables and soy garlic sauce",
    cookTime: "15 min",
    tags: ["asian", "quick"],
  },
  {
    title: "Crispy Gochujang Noodles",
    description: "Sweet spicy Korean noodles with crispy vegetables",
    cookTime: "20 min",
    tags: ["korean", "spicy"],
  },
];
