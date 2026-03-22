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
  {
    role: "user",
    content: "I want a warming soup for a cold night, something with depth but not heavy.",
  },
  {
    role: "assistant",
    content:
      "The strongest direction is a roasted tomato and white bean soup with garlic, smoked paprika, and a parmesan rind in the broth. It reads hearty but isn't cream-heavy and gets better the longer it simmers. Two other options: a ginger-carrot soup with coconut milk and lime for something lighter and brighter, or a lentil-cumin soup with wilted greens and lemon for something more filling. The tomato-white bean version is the most versatile because you can serve it chunky or blended depending on how you feel.",
  },
  {
    role: "user",
    content: "What's a good weeknight sheet pan dinner I can throw together with chicken and vegetables?",
  },
  {
    role: "assistant",
    content:
      "Go with a harissa-roasted chicken thigh sheet pan with sweet potato, red onion, and chickpeas. Season everything with harissa, cumin, olive oil, and a little honey, roast at high heat, and finish with lemon and fresh herbs. If you want something milder, swap harissa for a garlic-herb marinade with lemon zest and thyme. The key to sheet pan success is cutting vegetables to similar sizes so everything finishes at the same time and gets caramelized edges.",
  },
];

// Examples for the recipe-bound chef chat (recipe context is always present).
// These show correct responses to modification, technique, and substitution questions
// about a specific recipe — keeping answers focused on the dish in front of the user.
export const RECIPE_CHAT_EXAMPLES: AIMessage[] = [
  {
    role: "user",
    content: "I want to add potatoes to this. Where do they fit best?",
  },
  {
    role: "assistant",
    content:
      "Cut them into 1-inch cubes and add them with the other vegetables so they have time to cook through. If the cooking time is under 30 minutes, parboil the potatoes for 5 minutes first so they don't stay hard in the middle. They'll absorb the sauce well and add real heartiness — no other changes needed.",
  },
  {
    role: "user",
    content: "I want to cook this in my large cast iron skillet. Can you add this",
  },
  {
    role: "assistant",
    content:
      "A cast iron skillet works well here. Preheat it over medium-high for 2 minutes before adding oil — cast iron holds heat unevenly until it's fully hot. Use it for the sear or sauté steps exactly as written. If the recipe finishes in the oven, cast iron goes straight in. The main adjustment: reduce the heat slightly compared to a regular pan because cast iron runs hotter once it's up to temperature.",
  },
  {
    role: "user",
    content: "Can I make this dairy-free? I can't have butter or cream.",
  },
  {
    role: "assistant",
    content:
      "Yes — swap butter for olive oil or a neutral oil at the same quantity, and replace cream with full-fat coconut milk or a good oat cream. Coconut milk works best if the dish already has warm spices; oat cream is more neutral and won't change the flavor profile. If parmesan is in there, nutritional yeast adds the same savory depth without dairy. The texture will be slightly thinner with coconut milk, so let it reduce a bit longer.",
  },
  {
    role: "user",
    content: "How do I make this spicier without changing the whole flavor?",
  },
  {
    role: "assistant",
    content:
      "Add heat in layers rather than one big hit. Start with a pinch of cayenne or chili flakes in the base when you cook the aromatics — it blooms in the oil and distributes through everything. Then finish with a drizzle of chili oil or a few drops of hot sauce just before serving for brightness on top. That way the heat builds gradually and doesn't flatten the other flavors. Half a teaspoon of cayenne in the base is a good starting point; taste and adjust from there.",
  },
];
