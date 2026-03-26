/**
 * Pattern-based ingredient class detection.
 *
 * Works directly on the ingredient name strings that the model generates
 * (e.g. "2 large eggs, beaten", "1 cup whole milk", "3 cloves garlic, minced").
 * No catalog lookup needed — regex patterns are conservative enough to avoid
 * false positives on the forbidden/required checks that matter most.
 */

const CLASS_PATTERNS: Record<string, RegExp> = {
  sweetener:
    /\b(sugar|honey|maple syrup|maple|agave|molasses|confectioners|powdered sugar|brown sugar|granulated sugar|stevia|corn syrup|simple syrup|caramel|caramelized sugar|sweetened condensed milk)\b/i,

  egg: /\b(eggs?|egg yolks?|egg whites?|yolks?)\b/i,

  fat_oil:
    /\b(butter|olive oil|vegetable oil|canola oil|coconut oil|avocado oil|lard|shortening|ghee|margarine|sesame oil|peanut oil|cooking spray)\b/i,

  // Negative lookbehinds prevent plant-based milks/creams from matching as dairy.
  // e.g. "coconut milk", "oat milk", "almond milk", "coconut cream" must NOT be dairy.
  dairy:
    /\b(?:whole milk|skim milk|2% milk|low-fat milk|condensed milk|evaporated milk|sweetened condensed milk|buttermilk|heavy cream|whipping cream|double cream|sour cream|half.and.half|half and half|cream cheese|crème fraîche|creme fraiche|mozzarella|parmesan|cheddar|ricotta|mascarpone|gruyere|gouda|brie|feta|greek yogurt|skyr|kefir|yogurt|cheese|(?<!\b(?:coconut|almond|oat|soy|rice|plant|cashew|oat-based)\s)cream|(?<!\b(?:coconut|almond|oat|soy|rice|plant)\s)milk)\b/i,

  liquid_base:
    /\b(milk|cream|broth|stock|water|juice|beer|wine|coconut milk|coconut cream|oat milk|almond milk|soy milk|rice milk|plant milk|buttermilk|vegetable broth|chicken broth|beef broth|fish stock)\b/i,

  flour_grain:
    /\b(flour|all-purpose flour|cake flour|bread flour|whole wheat flour|almond flour|oat flour|rice flour|cornmeal|semolina|oats|rolled oats|panko|breadcrumbs|biscuit mix|bread|sandwich bread|whole wheat bread|sourdough|ciabatta|baguette|tortilla|flour tortilla|corn tortilla|pita|naan|flatbread|bagel|english muffin|burger bun|hot dog bun|hamburger bun|dinner roll|bread roll|sub roll|hoagie roll|wrap|lavash|roti|chapati|injera)\b/i,

  starch:
    /\b(rice|arborio|risotto rice|pasta|spaghetti|penne|fettuccine|linguine|noodles|orzo|couscous|quinoa|polenta|cornstarch|potato starch|arrowroot)\b/i,

  cocoa_or_chocolate:
    /\b(cocoa powder|cocoa|cacao|chocolate chips?|dark chocolate|bittersweet chocolate|semisweet chocolate|milk chocolate|white chocolate|unsweetened chocolate)\b/i,

  protein_meat:
    /\b(chicken|beef|pork|lamb|turkey|duck|veal|sausage|bacon|ham|prosciutto|pancetta|ground beef|ground turkey|ground pork|steak|brisket|short ribs?|tenderloin|thighs?|breast|drumsticks?)\b/i,

  protein_fish:
    /\b(salmon|tuna|shrimp|prawns?|cod|halibut|tilapia|crab|lobster|scallops?|squid|anchovies|clams?|mussels?|fish fillets?|seafood|sardines?|trout|sea bass|mahi)\b/i,

  protein_plant:
    /\b(tofu|tempeh|seitan|lentils?|chickpeas?|black beans?|white beans?|kidney beans?|edamame|split peas?|cannellini|navy beans?)\b/i,

  allium:
    /\b(onion|garlic|shallots?|leeks?|chives?|scallions?|green onions?|yellow onion|red onion|white onion)\b/i,

  hot_sauce_or_spicy:
    /\b(hot sauce|sriracha|jalapeño|jalapeno|chili peppers?|habanero|cayenne|red pepper flakes?|tabasco|chipotle|ghost pepper|serrano)\b/i,

  savory_herb:
    /\b(thyme|rosemary|sage|oregano|bay leaves?|marjoram|tarragon|dill|herbes de provence)\b/i,

  acid:
    /\b(white wine vinegar|red wine vinegar|apple cider vinegar|balsamic vinegar|vinegar|lemon juice|lime juice|orange juice)\b/i,

  leavening:
    /\b(baking powder|baking soda|active dry yeast|instant yeast|rapid rise yeast|self-rising)\b/i,

  tomato_product:
    /\b(tomato paste|tomato sauce|crushed tomatoes?|diced tomatoes?|marinara|tomato purée|tomato puree|san marzano|fresh tomatoes?|cherry tomatoes?|roma tomatoes?|sun-dried tomatoes?)\b/i,

  soy_sauce:
    /\b(soy sauce|tamari|fish sauce|worcestershire sauce|oyster sauce|miso paste|miso)\b/i,

  // ── Extended classes for dish-family validation ─────────────────────────

  broth:
    /\b(chicken broth|beef broth|vegetable broth|bone broth|chicken stock|beef stock|fish stock|dashi|stock)\b/i,

  leafy_green:
    /\b(spinach|kale|arugula|lettuce|chard|romaine|baby greens|mixed greens|collard greens?|watercress|bok choy|endive|escarole|radicchio|swiss chard|mustard greens?)\b/i,

  vegetable:
    /\b(carrot|zucchini|broccoli|cauliflower|mushroom|bell pepper|eggplant|celery|cucumber|asparagus|green beans?|corn|cabbage|butternut squash|acorn squash|squash|sweet potato|parsnip|turnip|beet|fennel|artichoke)\b/i,

  sauce_base:
    /\b(hoisin sauce|hoisin|teriyaki sauce|teriyaki|ponzu|coconut aminos|sweet chili sauce|black bean sauce|gochujang|chili garlic sauce|sambal|peanut sauce|tahini sauce|pasta sauce)\b/i,

  fruit:
    /\b(apple|banana|mango|strawberr|blueberr|raspberr|blackberr|peach|plum|cherr|pear|watermelon|pineapple|grape|fig|date|apricot|cranberr|melon|papaya|kiwi|lychee|passion fruit|pomegranate)\b/i,

  spice_warm:
    /\b(cinnamon|nutmeg|cardamom|allspice|cloves?|star anise|vanilla bean|pumpkin spice|ground ginger)\b/i,

  spice_savory:
    /\b(cumin|coriander|turmeric|paprika|smoked paprika|curry powder|garam masala|chili powder|five spice|za.atar|baharat|sumac|ras el hanout|berbere|harissa)\b/i,

  nut:
    /\b(almonds?|walnuts?|pecans?|cashews?|pistachios?|hazelnuts?|peanuts?|macadamia|pine nuts?|chestnuts?|brazil nuts?|nut butter|almond butter|peanut butter|tahini)\b/i,

  herb:
    /\b(basil|cilantro|parsley|chives?|mint|tarragon|chervil|fennel fronds?|fresh herbs?)\b/i,

  legume:
    /\b(black beans?|white beans?|kidney beans?|pinto beans?|chickpeas?|lentils?|split peas?|edamame|cannellini|navy beans?|lima beans?|fava beans?|black-eyed peas?|soybeans?)\b/i,

  flavoring_extract:
    /\b(vanilla extract|almond extract|peppermint extract|lemon extract|orange extract|rose water|orange blossom water|orange flower water)\b/i,

  seed:
    /\b(sesame seeds?|pumpkin seeds?|sunflower seeds?|chia seeds?|flax seeds?|poppy seeds?|hemp seeds?)\b/i,

  icing:
    /\b(frosting|buttercream|cream cheese frosting|fondant|ganache)\b/i,

  custard_base:
    /\b(custard powder|instant pudding|pudding mix|vanilla pudding mix)\b/i,

  umami_component:
    /\b(dried mushrooms?|shiitake|porcini|kombu|bonito flakes?|nutritional yeast|dried porcini)\b/i,

  cooked_grain:
    /\b(cooked rice|day.old rice|leftover rice|cooked quinoa|cooked farro|cooked barley|cooked millet)\b/i,
};

export type IngredientClass = keyof typeof CLASS_PATTERNS;

/** Returns all classes detected for a single ingredient name string. */
export function classifyIngredient(ingredientName: string): string[] {
  const detected: string[] = [];
  for (const [cls, pattern] of Object.entries(CLASS_PATTERNS)) {
    if (pattern.test(ingredientName)) {
      detected.push(cls);
    }
  }
  return detected;
}

/** Returns true if any ingredient in the list belongs to the given class. */
export function hasIngredientClass(
  ingredients: Array<{ name: string }>,
  cls: string
): boolean {
  return ingredients.some((ing) => classifyIngredient(ing.name).includes(cls));
}

/** Returns the names of all ingredients belonging to the given class. */
export function getIngredientsByClass(
  ingredients: Array<{ name: string }>,
  cls: string
): string[] {
  return ingredients
    .filter((ing) => classifyIngredient(ing.name).includes(cls))
    .map((ing) => ing.name);
}

/**
 * Returns true if at least one ingredient satisfies ANY class in the group.
 * Used for OR-style required class checks.
 */
export function hasAnyClassInGroup(
  ingredients: Array<{ name: string }>,
  classGroup: string[]
): boolean {
  return classGroup.some((cls) => hasIngredientClass(ingredients, cls));
}
