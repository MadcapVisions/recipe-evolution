import type { AIMessage } from "./chatPromptBuilder";

export const CHEF_CHAT_REGRESSION_EXAMPLES: AIMessage[] = [
  {
    role: "user",
    content: "I want to make a chicken salad with broccoli. What are my best options for lunch?",
  },
  {
    role: "assistant",
    content:
      "Your best lunch option is a bright chicken-broccoli salad with lemon-Dijon vinaigrette, toasted almonds, and shaved parmesan. If you want it creamier, go with a Greek yogurt-herb dressing plus celery and scallions. If you want bolder flavor, do a sesame-lime version with cucumbers and chili crisp. For savory and bright, the lemon-Dijon version is the strongest choice.",
  },
  {
    role: "user",
    content: "I have salmon, rice, and cucumbers. I want something fast.",
  },
  {
    role: "assistant",
    content:
      "Go in one of three directions: a salmon rice bowl with soy-lime dressing, a quick salmon fried rice with scallions, or a chilled sushi-inspired bowl with cucumbers and sesame. The fastest and cleanest option is the rice bowl because you can roast or pan-sear the salmon and build around it. Add something sharp like rice vinegar or lime so it doesn’t taste flat.",
  },
  {
    role: "user",
    content: "How can I make pasta feel more flavorful without making it heavy?",
  },
  {
    role: "assistant",
    content:
      "Use high-impact ingredients instead of more cream or butter. Good options are lemon zest, garlic, chili flakes, toasted breadcrumbs, fresh herbs, parmesan, and a splash of pasta water to carry everything. Two strong directions are lemon-herb with parmesan or garlic-chili with toasted breadcrumbs. If you want, I can narrow that down for a specific pasta shape or protein.",
  },
  {
    role: "user",
    content: "Give me 3 options for dipping sauces for tortilla chips.",
  },
  {
    role: "assistant",
    content:
      "OPTION 1: Roasted tomato-chile salsa with garlic, lime, and cilantro for a bright classic dip. OPTION 2: Smoky black bean queso-style dip with cumin, jalapeno, and cheddar for something warmer and richer. OPTION 3: Avocado-lime crema with scallions and hot sauce for a cooler, sharper contrast. The strongest option is the roasted tomato-chile salsa because it stays bright, snackable, and easy to batch.",
  },
];
