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

  // --- Baked goods (check before bread to avoid false positives) ---
  if (includesAny(normalized, ["cookie", "cookies", "biscotti", "brownie", "brownies", "blondie", "blondies", "muffin", "muffins", "scone", "scones", "macaroon", "macarons"])) {
    return "cookies";
  }
  if (includesAny(normalized, ["cupcake", "cupcakes", "cheesecake", "pound cake", "bundt cake", "layer cake", "coffee cake", "upside-down cake", "sponge cake", "carrot cake", "red velvet", "angel food"])) {
    return "cake";
  }
  // Generic "cake" after more specific cake terms
  if (includesAny(normalized, [" cake "])) {
    return "cake";
  }
  if (includesAny(normalized, ["banana bread", "zucchini bread", "pumpkin bread", "cornbread", "corn bread", "sandwich bread", "sourdough bread", "whole wheat bread", "bread loaf", "bread roll", "dinner roll", "quick bread", "brioche", "challah", "baguette", "ciabatta", "focaccia bread", "naan bread", "pita bread"])) {
    return "bread";
  }

  // --- Pizza / flatbreads ---
  if (includesAny(normalized, ["pizza", "focaccia", "flatbread", "calzone", "stromboli"])) {
    return "pizza";
  }

  // --- Pasta / noodles ---
  if (includesAny(normalized, ["pasta", "linguine", "fettuccine", "spaghetti", "penne", "rigatoni", "fusilli", "farfalle", "tortellini", "pappardelle", "tagliatelle", "orzo", "gnocchi", "macaroni", "mac and cheese", "lasagna", "lasagne", "cannelloni", "bucatini", "udon", "soba", "lo mein", "chow mein", "pad thai", "noodle", "noodles"])) {
    return "pasta";
  }

  // --- Mexican / Tex-Mex ---
  if (includesAny(normalized, ["taco", "tacos", "tostada", "tostadas", "burrito", "burritos", "quesadilla", "quesadillas", "enchilada", "enchiladas", "fajita", "fajitas", "tamale", "tamales", "nachos", "nacho", "empanada", "empanadas", "chimichanga", "chimichangas", "chalupa", "chalupas", "huevos rancheros"])) {
    return "tacos";
  }

  // --- Soup / stew / chili ---
  if (includesAny(normalized, ["soup", "stew", "chowder", "bisque", "gazpacho", "minestrone", "pozole", "bouillabaisse", "gumbo", "laksa", "pho", "ramen", "udon soup", "congee", "moqueca", "chili", "chilli", "dal soup", "broth-based", "hot pot", "hotpot", "shabu shabu", "sukiyaki"])) {
    return "soup";
  }

  // --- Curry / dal ---
  if (includesAny(normalized, ["curry", "curries", "tikka masala", "butter chicken", "korma", "vindaloo", "saag", "palak paneer", "paneer curry", "coconut curry", "thai curry", "green curry", "red curry", "yellow curry", "massaman", "japanese curry", " dal", " dhal", "lentil curry", "chana masala", "aloo gobi", "bhindi masala"])) {
    return "curry";
  }

  // --- Rice dishes (not bowls or soup) ---
  if (includesAny(normalized, ["risotto", "paella", "biryani", "pilaf", "fried rice", "jollof rice", "arroz con", "nasi goreng", "congee"])) {
    return "rice";
  }

  // --- Salad ---
  if (includesAny(normalized, ["salad", "slaw", "coleslaw", "tabbouleh", "fattoush", "caprese", "niçoise", "nicoise", "caesar salad", "greek salad", "cobb salad", "waldorf"])) {
    return "salad";
  }

  // --- Dips / spreads ---
  if (includesAny(normalized, ["dip", "spread", "hummus", "guacamole", "tzatziki", "baba ghanoush", "baba ganoush", "salsa", "pesto", "aioli", "tapenade", "muhammara", "romesco", "whipped feta", "salata de vinete", "salată de vinete"])) {
    return "dip";
  }

  // --- Breakfast ---
  if (includesAny(normalized, ["pancake", "pancakes", "waffle", "waffles", "french toast", "omelette", "omelet", "frittata", "eggs benedict", "breakfast burrito", "breakfast sandwich", "breakfast hash", "hash browns", "granola", "overnight oats", "porridge", "crepe", "crepes", "dutch baby"])) {
    return "breakfast";
  }

  // --- Burgers / sliders ---
  if (includesAny(normalized, ["burger", "burgers", "slider", "sliders", "veggie burger", "turkey burger", "lamb burger", "smash burger"])) {
    return "burger";
  }

  // --- Sandwiches / wraps ---
  if (includesAny(normalized, ["sandwich", "sandwiches", "grilled cheese", "panini", "hoagie", "sub sandwich", "club sandwich", "banh mi", "bánh mì", "torta", "pita sandwich", "gyro", "shawarma", "falafel wrap", "wrap sandwich"])) {
    return "sandwich";
  }

  // --- Stir-fry ---
  if (includesAny(normalized, ["stir-fry", "stir fry", "stir-fried", "stir fried"])) {
    return "stir_fry";
  }

  // --- Dumplings / filled dough ---
  if (includesAny(normalized, ["dumpling", "dumplings", "gyoza", "pierogi", "pierogies", "potsticker", "potstickers", "wonton", "wontons", "dim sum", "bao", "baozi", "manti", "momos", "xiao long bao", "har gow", "shumai"])) {
    return "dumplings";
  }

  // --- Skillet ---
  if (includesAny(normalized, ["skillet"])) {
    return "skillet";
  }

  // --- Casserole / bake / gratin / tagine ---
  if (includesAny(normalized, ["casserole", "gratin", "dauphinoise", "moussaka", "pot pie", "shepherd's pie", "cottage pie", "baked ziti", "tuna bake", "chicken bake", "pasta bake", "tagine", "tajine"])) {
    return "casserole";
  }

  // --- Grilled / BBQ / smoked / wings ---
  if (includesAny(normalized, ["steak", "steaks", "pork chop", "pork chops", "lamb chop", "lamb chops", "kebab", "kebabs", "skewer", "skewers", "bbq ribs", "spare ribs", "baby back ribs", "rack of lamb", "brisket", "pulled pork", "smoked chicken", "chicken wing", "chicken wings", "buffalo wing", "buffalo wings", "satay", "yakitori", "lamb shank", "smoked brisket", "smoked salmon"])) {
    return "grilled";
  }

  // --- Fried / breaded / battered ---
  if (includesAny(normalized, ["fried chicken", "chicken tenders", "chicken tenders", "chicken nugget", "chicken nuggets", "fish and chips", "fish fry", "fried fish", "fried shrimp", "tempura", "katsu", "schnitzel", "tonkatsu", "wiener schnitzel", "calamari", "fried calamari", "onion ring", "onion rings", "corn dog", "hush puppy", "hush puppies", "battered fish", "deep fried", "deep-fried", "beer battered", "panko chicken", "breaded chicken", "donut", "donuts", "doughnut", "doughnuts", "beignet", "beignets", "churro", "churros", "falafel"])) {
    return "fried";
  }

  // --- Meatballs / meatloaf / ground meat patties ---
  if (includesAny(normalized, ["meatball", "meatballs", "meatloaf", "meat loaf", "kofta", "köfte", "kofte", "swedish meatball", "italian meatball", "turkey meatball", "lamb meatball", "meatball sub", "bolognese", "ragu", "ragù", "meat sauce", "sloppy joe"])) {
    return "meatballs";
  }

  // --- Stuffed / filled vegetables and proteins ---
  if (includesAny(normalized, ["stuffed pepper", "stuffed peppers", "stuffed mushroom", "stuffed mushrooms", "stuffed squash", "stuffed zucchini", "stuffed chicken", "stuffed eggplant", "stuffed tomato", "stuffed tomatoes", "dolma", "dolmas", "dolmades", "grape leaf", "grape leaves", "cabbage roll", "cabbage rolls", "golabki", "stuffed cabbage", "chile relleno", "chiles rellenos", "twice baked potato", "twice-baked potato", "stuffed potato", "hasselback"])) {
    return "stuffed";
  }

  // --- Braised / slow-cooked ---
  if (includesAny(normalized, ["pot roast", "braised", "braise", "osso buco", "ossobuco", "coq au vin", "beef bourguignon", "boeuf bourguignon", "short rib", "short ribs", "braised short ribs", "carnitas", "birria", "adobo", "chicken adobo", "pork adobo", "slow cooker", "slow-cooker", "crockpot", "crock pot", "confit", "duck confit"])) {
    return "braised";
  }

  // --- Sushi / raw fish ---
  if (includesAny(normalized, ["sushi", "sashimi", "maki roll", "maki rolls", "hand roll", "temaki", "onigiri", "nigiri", "sushi roll", "sushi rice"])) {
    return "sushi";
  }

  // --- Fritters / latkes / savory pancakes ---
  if (includesAny(normalized, ["fritter", "fritters", "latke", "latkes", "potato pancake", "zucchini fritter", "corn fritter", "vegetable fritter", "pakora", "pakoras", "bhaji", "bhajis", "okonomiyaki fritter"])) {
    return "fritters";
  }
  if (includesAny(normalized, ["roasted", "sheet pan"])) {
    return "roasted";
  }

  // --- Pie / tart / quiche ---
  if (includesAny(normalized, ["pot pie", "shepherd's pie", "cottage pie", "chicken pie", "quiche", "galette", "savory tart", "fruit tart", "tarte tatin", "apple pie", "cherry pie", "pumpkin pie", "pecan pie", "key lime pie", "lemon meringue", "cream pie"])) {
    return "pie";
  }

  // --- Desserts (non-cookie / non-cake / non-pie) ---
  if (includesAny(normalized, ["pudding", "mousse", "custard", "panna cotta", "crème brûlée", "creme brulee", "tiramisu", "baklava", "ice cream", "gelato", "sorbet", "sherbet", "frozen yogurt", "parfait", "trifle", "flan", "crumble", "crisp", "cobbler", "eton mess", "affogato", "churros"])) {
    return "dessert";
  }

  // --- Bowl ---
  if (includesAny(normalized, ["rice bowl", "grain bowl", "poke bowl", "burrito bowl", "acai bowl", "smoothie bowl", "bowl"])) {
    return "bowl";
  }

  return null;
}

function detectRequestedProtein(context: string) {
  const normalized = normalizeText(context);
  const proteins = ["chicken", "turkey", "shrimp", "salmon", "fish", "beef", "pork", "lamb", "duck", "tofu", "tempeh", "beans", "lentils", "chickpeas", "eggs", "tuna", "cod", "halibut", "tilapia", "crab", "lobster", "scallop", "scallops", "clams", "mussels", "bison", "venison"];
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
    "artichoke", "artichokes",
    "brussels sprouts", "bok choy",
    "butternut squash", "acorn squash",
    "parsnip", "parsnips", "turnip", "turnips",
    "celery root", "celeriac",
    "rhubarb", "plantain", "plantains",
  ];
  return anchors.find((item) => normalized.includes(item)) ?? null;
}

export function deriveIdeaTitleFromConversationContext(context: string) {
  const normalized = normalizeText(context);
  const family = detectRequestedDishFamily(normalized);
  const protein = detectRequestedProtein(normalized);
  const anchor = detectRequestedAnchorIngredient(normalized);

  // Named dish patterns — checked first (most specific)
  const namedDishPatterns = [
    // Cookies
    { terms: ["oatmeal raisin cookie", "oatmeal raisin cookies"], title: "Oatmeal Raisin Cookies" },
    { terms: ["chocolate chip cookie", "chocolate chip cookies"], title: "Chocolate Chip Cookies" },
    { terms: ["snickerdoodle"], title: "Snickerdoodle Cookies" },
    { terms: ["peanut butter cookie", "peanut butter cookies"], title: "Peanut Butter Cookies" },
    { terms: ["sugar cookie", "sugar cookies"], title: "Sugar Cookies" },
    { terms: ["shortbread"], title: "Shortbread Cookies" },
    { terms: ["biscotti"], title: "Biscotti" },
    { terms: ["macaron", "macarons", "macaroon", "macaroons"], title: "Macarons" },
    { terms: ["linzer cookie", "linzer cookies"], title: "Linzer Cookies" },
    { terms: ["gingerbread cookie", "gingerbread cookies", "gingerbread man"], title: "Gingerbread Cookies" },
    { terms: ["thumbprint cookie", "thumbprint cookies"], title: "Thumbprint Cookies" },
    // Brownies / bars
    { terms: ["brownie", "brownies"], title: "Brownies" },
    { terms: ["blondie", "blondies"], title: "Blondies" },
    { terms: ["lemon bar", "lemon bars"], title: "Lemon Bars" },
    // Muffins / scones
    { terms: ["blueberry muffin", "blueberry muffins"], title: "Blueberry Muffins" },
    { terms: ["banana muffin", "banana muffins"], title: "Banana Muffins" },
    { terms: ["blueberry scone", "blueberry scones"], title: "Blueberry Scones" },
    // Cakes
    { terms: ["carrot cake"], title: "Carrot Cake" },
    { terms: ["red velvet"], title: "Red Velvet Cake" },
    { terms: ["chocolate lava cake", "lava cake", "lava cakes", "molten chocolate"], title: "Chocolate Lava Cakes" },
    { terms: ["upside-down cake", "pineapple upside"], title: "Upside-Down Cake" },
    { terms: ["pound cake"], title: "Pound Cake" },
    { terms: ["coffee cake"], title: "Coffee Cake" },
    { terms: ["tiramisu"], title: "Tiramisu" },
    { terms: ["cheesecake"], title: "Cheesecake" },
    // Pies / tarts
    { terms: ["apple pie"], title: "Apple Pie" },
    { terms: ["cherry pie"], title: "Cherry Pie" },
    { terms: ["pumpkin pie"], title: "Pumpkin Pie" },
    { terms: ["pecan pie"], title: "Pecan Pie" },
    { terms: ["key lime pie"], title: "Key Lime Pie" },
    { terms: ["lemon meringue"], title: "Lemon Meringue Pie" },
    { terms: ["tarte tatin"], title: "Tarte Tatin" },
    { terms: ["galette"], title: "Galette" },
    { terms: ["quiche"], title: "Quiche" },
    { terms: ["shepherd's pie", "shepherds pie"], title: "Shepherd's Pie" },
    { terms: ["cottage pie"], title: "Cottage Pie" },
    { terms: ["pot pie", "chicken pot pie"], title: "Chicken Pot Pie" },
    // Breads
    { terms: ["banana bread"], title: "Banana Bread" },
    { terms: ["zucchini bread"], title: "Zucchini Bread" },
    { terms: ["pumpkin bread"], title: "Pumpkin Bread" },
    { terms: ["cornbread", "corn bread"], title: "Cornbread" },
    { terms: ["focaccia bread"], title: "Focaccia Bread" },
    { terms: ["brioche"], title: "Brioche" },
    { terms: ["challah"], title: "Challah" },
    { terms: ["sourdough bread"], title: "Sourdough Bread" },
    { terms: ["cinnamon roll", "cinnamon rolls", "cinnamon bun", "cinnamon buns"], title: "Cinnamon Rolls" },
    { terms: ["pretzel", "pretzels", "soft pretzel"], title: "Soft Pretzels" },
    // Breakfast
    { terms: ["eggs benedict"], title: "Eggs Benedict" },
    { terms: ["french toast"], title: "French Toast" },
    { terms: ["dutch baby"], title: "Dutch Baby Pancake" },
    { terms: ["shakshuka"], title: "Shakshuka" },
    { terms: ["frittata"], title: "Frittata" },
    { terms: ["granola"], title: "Homemade Granola" },
    { terms: ["overnight oats"], title: "Overnight Oats" },
    // Burgers
    { terms: ["smash burger", "smashburger"], title: "Smash Burger" },
    { terms: ["veggie burger", "black bean burger"], title: "Veggie Burger" },
    { terms: ["turkey burger"], title: "Turkey Burger" },
    { terms: ["lamb burger"], title: "Lamb Burger" },
    // Sandwiches
    { terms: ["grilled cheese"], title: "Grilled Cheese" },
    { terms: ["banh mi", "bánh mì"], title: "Bánh Mì" },
    { terms: ["gyro", "gyros"], title: "Gyros" },
    { terms: ["shawarma"], title: "Shawarma" },
    { terms: ["falafel"], title: "Falafel" },
    { terms: ["cubano", "cuban sandwich"], title: "Cubano Sandwich" },
    // Mexican / Tex-Mex
    { terms: ["birria taco", "birria tacos", "birria"], title: "Birria Tacos" },
    { terms: ["fish taco", "fish tacos"], title: "Fish Tacos" },
    { terms: ["chicken tostadas", "chicken tostada"], title: "Chicken Tostadas" },
    { terms: ["crispy chicken tostadas with avocado crema", "chicken tostadas with avocado crema"], title: "Chicken Tostadas" },
    { terms: ["chicken fajita bowls", "chicken fajita bowl", "fajita bowls", "fajita bowl"], title: "Chicken Fajita Bowl" },
    { terms: ["huevos rancheros"], title: "Huevos Rancheros" },
    // Curry
    { terms: ["tikka masala", "chicken tikka masala"], title: "Chicken Tikka Masala" },
    { terms: ["butter chicken"], title: "Butter Chicken" },
    { terms: ["palak paneer", "saag paneer"], title: "Palak Paneer" },
    { terms: ["chana masala"], title: "Chana Masala" },
    { terms: ["lamb korma", "chicken korma"], title: "Korma" },
    { terms: ["massaman curry"], title: "Massaman Curry" },
    { terms: ["green curry"], title: "Green Curry" },
    { terms: ["red curry"], title: "Red Curry" },
    { terms: ["japanese curry"], title: "Japanese Curry" },
    // Rice dishes
    { terms: ["paella"], title: "Paella" },
    { terms: ["biryani", "chicken biryani", "lamb biryani"], title: "Biryani" },
    { terms: ["jollof rice"], title: "Jollof Rice" },
    { terms: ["nasi goreng"], title: "Nasi Goreng" },
    { terms: ["arroz con pollo"], title: "Arroz con Pollo" },
    { terms: ["century egg and pork congee", "century egg congee"], title: "Century Egg and Pork Congee" },
    { terms: ["congee"], title: "Congee" },
    // Pasta
    { terms: ["spaghetti carbonara", "carbonara"], title: "Spaghetti Carbonara" },
    { terms: ["cacio e pepe"], title: "Cacio e Pepe" },
    { terms: ["amatriciana", "pasta amatriciana"], title: "Pasta all'Amatriciana" },
    { terms: ["chicken-filled ravioli", "fresh ravioli", "ravioli"], title: "Ravioli" },
    { terms: ["pad thai"], title: "Pad Thai" },
    { terms: ["pad see ew"], title: "Pad See Ew" },
    { terms: ["mac and cheese", "macaroni and cheese", "macaroni & cheese"], title: "Mac and Cheese" },
    { terms: ["lasagna", "lasagne"], title: "Lasagna" },
    { terms: ["pasta primavera"], title: "Pasta Primavera" },
    { terms: ["pesto pasta"], title: "Pesto Pasta" },
    // Soups / stews
    { terms: ["french onion soup"], title: "French Onion Soup" },
    { terms: ["tomato soup", "tomato bisque"], title: "Tomato Soup" },
    { terms: ["clam chowder"], title: "Clam Chowder" },
    { terms: ["corn chowder"], title: "Corn Chowder" },
    { terms: ["chicken noodle soup"], title: "Chicken Noodle Soup" },
    { terms: ["lentil soup"], title: "Lentil Soup" },
    { terms: ["minestrone"], title: "Minestrone" },
    { terms: ["pozole"], title: "Pozole" },
    { terms: ["gumbo"], title: "Gumbo" },
    { terms: ["bouillabaisse"], title: "Bouillabaisse" },
    { terms: ["gazpacho"], title: "Gazpacho" },
    { terms: ["laksa"], title: "Laksa" },
    { terms: ["tonkotsu ramen"], title: "Tonkotsu Ramen" },
    { terms: ["miso ramen"], title: "Miso Ramen" },
    { terms: ["ramen"], title: "Ramen" },
    { terms: ["pho"], title: "Pho" },
    { terms: ["mulligatawny"], title: "Mulligatawny Soup" },
    // Brazilian / Latin
    { terms: ["brazilian moqueca", "moqueca"], title: "Brazilian Moqueca" },
    { terms: ["feijoada"], title: "Feijoada" },
    // Dumplings
    { terms: ["xiao long bao", "soup dumpling"], title: "Xiao Long Bao" },
    { terms: ["gyoza"], title: "Gyoza" },
    { terms: ["pierogi", "pierogies"], title: "Pierogi" },
    { terms: ["potsticker", "potstickers"], title: "Potstickers" },
    { terms: ["wonton soup", "wonton"], title: "Wontons" },
    { terms: ["turkish manti", "manti"], title: "Turkish Manti" },
    { terms: ["momos", "momo"], title: "Momos" },
    // Grilled / BBQ / wings
    { terms: ["beef brisket", "smoked brisket"], title: "Beef Brisket" },
    { terms: ["pulled pork"], title: "Pulled Pork" },
    { terms: ["baby back ribs", "spare ribs", "bbq ribs"], title: "BBQ Ribs" },
    { terms: ["rack of lamb"], title: "Rack of Lamb" },
    { terms: ["honey garlic wings", "buffalo wing", "buffalo wings", "chicken wing", "chicken wings"], title: "Chicken Wings" },
    { terms: ["yakitori"], title: "Yakitori" },
    { terms: ["chicken satay", "beef satay", "pork satay", "satay"], title: "Satay" },
    { terms: ["lamb shank", "braised lamb shank"], title: "Braised Lamb Shank" },
    // Fried
    { terms: ["southern fried chicken", "buttermilk fried chicken"], title: "Southern Fried Chicken" },
    { terms: ["fried chicken"], title: "Fried Chicken" },
    { terms: ["chicken katsu", "chicken cutlet"], title: "Chicken Katsu" },
    { terms: ["tonkatsu", "pork katsu"], title: "Tonkatsu" },
    { terms: ["chicken schnitzel", "wiener schnitzel", "pork schnitzel", "schnitzel"], title: "Schnitzel" },
    { terms: ["fish and chips"], title: "Fish and Chips" },
    { terms: ["fried shrimp", "coconut shrimp"], title: "Fried Shrimp" },
    { terms: ["tempura"], title: "Tempura" },
    { terms: ["calamari", "fried calamari"], title: "Calamari" },
    { terms: ["onion rings"], title: "Onion Rings" },
    { terms: ["hush puppies", "hush puppy"], title: "Hush Puppies" },
    { terms: ["donut", "donuts", "doughnut", "doughnuts"], title: "Donuts" },
    { terms: ["beignet", "beignets"], title: "Beignets" },
    { terms: ["falafel"], title: "Falafel" },
    // Meatballs / meatloaf
    { terms: ["swedish meatball", "swedish meatballs"], title: "Swedish Meatballs" },
    { terms: ["italian meatball", "italian meatballs", "meatball in marinara", "meatballs in marinara"], title: "Italian Meatballs" },
    { terms: ["meatball sub", "meatball sandwich"], title: "Meatball Sub" },
    { terms: ["meatball", "meatballs"], title: "Meatballs" },
    { terms: ["meatloaf", "meat loaf"], title: "Meatloaf" },
    { terms: ["kofta", "köfte", "kofte"], title: "Kofta" },
    { terms: ["beef bolognese", "chicken bolognese", "bolognese"], title: "Bolognese" },
    { terms: ["sloppy joe", "sloppy joes"], title: "Sloppy Joes" },
    // Stuffed dishes
    { terms: ["stuffed bell pepper", "stuffed bell peppers", "stuffed pepper", "stuffed peppers"], title: "Stuffed Peppers" },
    { terms: ["stuffed mushroom", "stuffed mushrooms"], title: "Stuffed Mushrooms" },
    { terms: ["chile relleno", "chiles rellenos", "chile rellenos"], title: "Chiles Rellenos" },
    { terms: ["dolmas", "dolmades", "stuffed grape leaf", "stuffed grape leaves"], title: "Dolmas" },
    { terms: ["cabbage roll", "cabbage rolls", "golabki", "stuffed cabbage"], title: "Cabbage Rolls" },
    { terms: ["twice baked potato", "twice-baked potato"], title: "Twice-Baked Potatoes" },
    // Braised / slow-cooked
    { terms: ["pot roast", "sunday pot roast"], title: "Pot Roast" },
    { terms: ["osso buco", "ossobuco"], title: "Osso Buco" },
    { terms: ["coq au vin"], title: "Coq au Vin" },
    { terms: ["beef bourguignon", "boeuf bourguignon"], title: "Beef Bourguignon" },
    { terms: ["braised short ribs", "short ribs"], title: "Braised Short Ribs" },
    { terms: ["carnitas"], title: "Carnitas" },
    { terms: ["chicken adobo", "pork adobo", "adobo"], title: "Adobo" },
    { terms: ["duck confit"], title: "Duck Confit" },
    // Sushi
    { terms: ["spicy tuna roll", "spicy tuna"], title: "Spicy Tuna Roll" },
    { terms: ["california roll"], title: "California Roll" },
    { terms: ["dragon roll"], title: "Dragon Roll" },
    { terms: ["sashimi"], title: "Sashimi" },
    { terms: ["onigiri"], title: "Onigiri" },
    // Fritters / latkes
    { terms: ["potato latke", "potato latkes"], title: "Potato Latkes" },
    { terms: ["latke", "latkes"], title: "Latkes" },
    { terms: ["zucchini fritter", "zucchini fritters"], title: "Zucchini Fritters" },
    { terms: ["corn fritter", "corn fritters"], title: "Corn Fritters" },
    { terms: ["pakora", "pakoras"], title: "Pakoras" },
    // Tagine
    { terms: ["chicken tagine"], title: "Chicken Tagine" },
    { terms: ["lamb tagine"], title: "Lamb Tagine" },
    { terms: ["vegetable tagine"], title: "Vegetable Tagine" },
    { terms: ["tagine", "tajine"], title: "Tagine" },
    // Miscellaneous specifics
    { terms: ["ceviche"], title: "Ceviche" },
    { terms: ["polenta"], title: "Polenta" },
    { terms: ["shrimp and grits"], title: "Shrimp and Grits" },
    { terms: ["grits"], title: "Grits" },
    { terms: ["poutine"], title: "Poutine" },
    { terms: ["tater tot", "tater tots"], title: "Tater Tots" },
    { terms: ["loaded fries", "chili fries", "cheese fries", "french fries", "fries"], title: "Fries" },
    { terms: ["hash", "breakfast hash", "corned beef hash"], title: "Hash" },
    { terms: ["deviled egg", "deviled eggs"], title: "Deviled Eggs" },
    { terms: ["bruschetta"], title: "Bruschetta" },
    { terms: ["crostini"], title: "Crostini" },
    { terms: ["spring roll", "spring rolls", "egg roll", "egg rolls"], title: "Spring Rolls" },
    { terms: ["beef wellington"], title: "Beef Wellington" },
    { terms: ["lemon chicken", "piccata"], title: "Chicken Piccata" },
    { terms: ["chicken marsala"], title: "Chicken Marsala" },
    { terms: ["chicken parmesan", "chicken parmigiana", "eggplant parmesan", "eggplant parmigiana"], title: "Chicken Parmesan" },
    { terms: ["beef stroganoff"], title: "Beef Stroganoff" },
    { terms: ["salisbury steak"], title: "Salisbury Steak" },
    { terms: ["jambalaya"], title: "Jambalaya" },
    { terms: ["shakshuka"], title: "Shakshuka" },
    // Salads
    { terms: ["caesar salad"], title: "Caesar Salad" },
    { terms: ["greek salad"], title: "Greek Salad" },
    { terms: ["cobb salad"], title: "Cobb Salad" },
    { terms: ["nicoise", "niçoise"], title: "Niçoise Salad" },
    { terms: ["caprese"], title: "Caprese Salad" },
    { terms: ["tabbouleh"], title: "Tabbouleh" },
    { terms: ["fattoush"], title: "Fattoush" },
    // Dips
    { terms: ["hummus"], title: "Hummus" },
    { terms: ["guacamole"], title: "Guacamole" },
    { terms: ["tzatziki"], title: "Tzatziki" },
    { terms: ["baba ghanoush", "baba ganoush"], title: "Baba Ghanoush" },
    { terms: ["salata de vinete", "salată de vinete"], title: "Salata de Vinete" },
    { terms: ["romesco"], title: "Romesco Sauce" },
    { terms: ["muhammara"], title: "Muhammara" },
    // Pizza specials
    { terms: ["flatbread-style pizza", "flatbread pizza"], title: "Flatbread Pizza" },
    { terms: ["calzone"], title: "Calzone" },
    // Stir-fry
    { terms: ["kung pao chicken"], title: "Kung Pao Chicken" },
    { terms: ["general tso", "general tso's"], title: "General Tso's Chicken" },
    { terms: ["beef and broccoli"], title: "Beef and Broccoli" },
    { terms: ["mapo tofu"], title: "Mapo Tofu" },
    // Desserts
    { terms: ["panna cotta"], title: "Panna Cotta" },
    { terms: ["crème brûlée", "creme brulee"], title: "Crème Brûlée" },
    { terms: ["baklava"], title: "Baklava" },
    { terms: ["churros"], title: "Churros" },
    { terms: ["eton mess"], title: "Eton Mess" },
    { terms: ["trifle"], title: "Trifle" },
    { terms: ["bread pudding"], title: "Bread Pudding" },
    { terms: ["rice pudding"], title: "Rice Pudding" },
    { terms: ["chocolate mousse"], title: "Chocolate Mousse" },
    // Casseroles
    { terms: ["moussaka"], title: "Moussaka" },
    { terms: ["baked ziti"], title: "Baked Ziti" },
    { terms: ["green bean casserole"], title: "Green Bean Casserole" },
    { terms: ["tuna noodle casserole"], title: "Tuna Noodle Casserole" },
    // World / regional
    { terms: ["okonomiyaki"], title: "Okonomiyaki" },
    { terms: ["adjarian khachapuri", "khachapuri"], title: "Adjarian Khachapuri" },
    { terms: ["socca"], title: "Socca" },
    { terms: ["pupusas", "pupusa"], title: "Pupusas" },
    { terms: ["masala dosa", "dosa"], title: "Masala Dosa" },
    { terms: ["gozleme", "gözleme"], title: "Gozleme" },
    { terms: ["injera platter", "injera"], title: "Injera Platter" },
    { terms: ["mujaddara"], title: "Mujaddara" },
    { terms: ["borscht"], title: "Borscht" },
    { terms: ["bibimbap"], title: "Bibimbap" },
    { terms: ["bulgogi"], title: "Bulgogi" },
    { terms: ["japchae"], title: "Japchae" },
    { terms: ["kimchi fried rice"], title: "Kimchi Fried Rice" },
    { terms: ["thai basil", "pad krapow", "pad kra pao"], title: "Thai Basil Stir-Fry" },
    { terms: ["fried rice"], title: "Fried Rice" },
    { terms: ["dan dan noodles", "dan dan mian"], title: "Dan Dan Noodles" },
  ];

  for (const pattern of namedDishPatterns) {
    if (includesAny(normalized, pattern.terms)) {
      return pattern.title;
    }
  }

  // Family-based title derivation
  if (family === "pizza") {
    if (normalized.includes("focaccia")) return "Focaccia Pizza";
    if (normalized.includes("calzone")) return "Calzone";
    if (protein) return `${protein.charAt(0).toUpperCase() + protein.slice(1)} Pizza`;
    return "Pizza";
  }

  if (family === "pasta") {
    if (anchor === "eggplant" || anchor === "aubergine" || anchor === "vinete") return "Eggplant Pasta";
    if (normalized.includes("pesto")) return "Pesto Pasta";
    if (protein) return `${protein.charAt(0).toUpperCase() + protein.slice(1)} Pasta`;
    return "Pasta";
  }

  if (family === "tacos") {
    if (normalized.includes("burrito")) {
      if (protein) return `${protein.charAt(0).toUpperCase() + protein.slice(1)} Burrito`;
      return "Burrito";
    }
    if (normalized.includes("quesadilla")) {
      if (protein) return `${protein.charAt(0).toUpperCase() + protein.slice(1)} Quesadilla`;
      return "Quesadilla";
    }
    if (normalized.includes("enchilada")) {
      if (protein) return `${protein.charAt(0).toUpperCase() + protein.slice(1)} Enchiladas`;
      return "Enchiladas";
    }
    if (normalized.includes("fajita")) {
      if (protein) return `${protein.charAt(0).toUpperCase() + protein.slice(1)} Fajitas`;
      return "Fajitas";
    }
    if (normalized.includes("nacho")) return "Nachos";
    if (normalized.includes("tamale")) return "Tamales";
    if (normalized.includes("empanada")) return "Empanadas";
    if (protein) return `${protein.charAt(0).toUpperCase() + protein.slice(1)} Tacos`;
    return "Tacos";
  }

  if (family === "soup") {
    if (normalized.includes("chili") || normalized.includes("chilli")) {
      if (protein) return `${protein.charAt(0).toUpperCase() + protein.slice(1)} Chili`;
      return "Chili";
    }
    if (normalized.includes("chowder")) {
      if (protein) return `${protein.charAt(0).toUpperCase() + protein.slice(1)} Chowder`;
      return "Chowder";
    }
    if (protein) return `${protein.charAt(0).toUpperCase() + protein.slice(1)} Soup`;
    return "Soup";
  }

  if (family === "curry") {
    if (protein) return `${protein.charAt(0).toUpperCase() + protein.slice(1)} Curry`;
    if (anchor) return `${anchor.charAt(0).toUpperCase() + anchor.slice(1)} Curry`;
    return "Curry";
  }

  if (family === "rice") {
    if (normalized.includes("risotto")) {
      if (protein) return `${protein.charAt(0).toUpperCase() + protein.slice(1)} Risotto`;
      if (anchor) return `${anchor.charAt(0).toUpperCase() + anchor.slice(1)} Risotto`;
      return "Risotto";
    }
    if (normalized.includes("pilaf")) return protein ? `${protein.charAt(0).toUpperCase() + protein.slice(1)} Pilaf` : "Rice Pilaf";
    if (normalized.includes("fried rice")) return protein ? `${protein.charAt(0).toUpperCase() + protein.slice(1)} Fried Rice` : "Fried Rice";
    if (protein) return `${protein.charAt(0).toUpperCase() + protein.slice(1)} Rice`;
    return "Rice Dish";
  }

  if (family === "salad") {
    if (protein) return `${protein.charAt(0).toUpperCase() + protein.slice(1)} Salad`;
    if (anchor) return `${anchor.charAt(0).toUpperCase() + anchor.slice(1)} Salad`;
    return "Salad";
  }

  if (family === "dip") {
    if (anchor === "eggplant" || anchor === "aubergine" || anchor === "vinete") return "Eggplant Dip";
    return "Dip";
  }

  if (family === "breakfast") {
    if (normalized.includes("pancake")) {
      if (normalized.includes("blueberry")) return "Blueberry Pancakes";
      if (normalized.includes("banana")) return "Banana Pancakes";
      if (normalized.includes("buttermilk")) return "Buttermilk Pancakes";
      return "Pancakes";
    }
    if (normalized.includes("waffle")) {
      if (normalized.includes("belgian")) return "Belgian Waffles";
      return "Waffles";
    }
    if (normalized.includes("omelette") || normalized.includes("omelet")) {
      return protein ? `${protein.charAt(0).toUpperCase() + protein.slice(1)} Omelette` : "Omelette";
    }
    if (normalized.includes("frittata")) return "Frittata";
    if (normalized.includes("crepe") || normalized.includes("crêpe")) return "Crepes";
    if (normalized.includes("porridge")) return "Porridge";
    return "Breakfast";
  }

  if (family === "burger") {
    if (protein) return `${protein.charAt(0).toUpperCase() + protein.slice(1)} Burger`;
    return "Burger";
  }

  if (family === "sandwich") {
    if (protein) return `${protein.charAt(0).toUpperCase() + protein.slice(1)} Sandwich`;
    return "Sandwich";
  }

  if (family === "stir_fry") {
    if (protein) return `${protein.charAt(0).toUpperCase() + protein.slice(1)} Stir-Fry`;
    if (anchor) return `${anchor.charAt(0).toUpperCase() + anchor.slice(1)} Stir-Fry`;
    return "Stir-Fry";
  }

  if (family === "dumplings") {
    return "Dumplings";
  }

  if (family === "casserole") {
    if (protein) return `${protein.charAt(0).toUpperCase() + protein.slice(1)} Casserole`;
    return "Casserole";
  }

  if (family === "grilled") {
    if (normalized.includes("wing")) return "Chicken Wings";
    if (normalized.includes("steak")) return protein ? `${protein.charAt(0).toUpperCase() + protein.slice(1)} Steak` : "Steak";
    if (normalized.includes("chop")) return protein ? `${protein.charAt(0).toUpperCase() + protein.slice(1)} Chops` : "Chops";
    if (normalized.includes("kebab") || normalized.includes("skewer")) return protein ? `${protein.charAt(0).toUpperCase() + protein.slice(1)} Kebabs` : "Kebabs";
    if (normalized.includes("rib")) return "Ribs";
    if (protein) return `Grilled ${protein.charAt(0).toUpperCase() + protein.slice(1)}`;
    return "Grilled Dish";
  }

  if (family === "fried") {
    if (normalized.includes("chicken")) return "Fried Chicken";
    if (normalized.includes("shrimp")) return "Fried Shrimp";
    if (normalized.includes("fish")) return "Fried Fish";
    if (normalized.includes("tempura")) return "Tempura";
    if (normalized.includes("katsu")) return protein ? `${protein.charAt(0).toUpperCase() + protein.slice(1)} Katsu` : "Katsu";
    if (normalized.includes("schnitzel")) return "Schnitzel";
    if (normalized.includes("falafel")) return "Falafel";
    if (normalized.includes("donut") || normalized.includes("doughnut")) return "Donuts";
    if (normalized.includes("beignet")) return "Beignets";
    return protein ? `Fried ${protein.charAt(0).toUpperCase() + protein.slice(1)}` : "Fried Dish";
  }

  if (family === "meatballs") {
    if (normalized.includes("meatloaf") || normalized.includes("meat loaf")) return "Meatloaf";
    if (normalized.includes("kofta") || normalized.includes("köfte") || normalized.includes("kofte")) return "Kofta";
    if (normalized.includes("bolognese") || normalized.includes("ragù") || normalized.includes("ragu")) {
      return protein ? `${protein.charAt(0).toUpperCase() + protein.slice(1)} Bolognese` : "Bolognese";
    }
    if (normalized.includes("sloppy joe")) return "Sloppy Joes";
    if (protein) return `${protein.charAt(0).toUpperCase() + protein.slice(1)} Meatballs`;
    return "Meatballs";
  }

  if (family === "stuffed") {
    if (normalized.includes("pepper")) return "Stuffed Peppers";
    if (normalized.includes("mushroom")) return "Stuffed Mushrooms";
    if (normalized.includes("squash") || normalized.includes("zucchini")) return "Stuffed Squash";
    if (normalized.includes("cabbage")) return "Cabbage Rolls";
    if (normalized.includes("dolma") || normalized.includes("grape leaf")) return "Dolmas";
    if (normalized.includes("potato")) return "Stuffed Potatoes";
    if (protein) return `Stuffed ${protein.charAt(0).toUpperCase() + protein.slice(1)}`;
    return "Stuffed Vegetables";
  }

  if (family === "braised") {
    if (normalized.includes("pot roast")) return "Pot Roast";
    if (normalized.includes("short rib")) return "Braised Short Ribs";
    if (normalized.includes("carnitas")) return "Carnitas";
    if (normalized.includes("adobo")) return protein ? `${protein.charAt(0).toUpperCase() + protein.slice(1)} Adobo` : "Adobo";
    if (normalized.includes("confit")) return protein ? `${protein.charAt(0).toUpperCase() + protein.slice(1)} Confit` : "Confit";
    if (protein) return `Braised ${protein.charAt(0).toUpperCase() + protein.slice(1)}`;
    return "Braised Dish";
  }

  if (family === "sushi") {
    if (protein) return `${protein.charAt(0).toUpperCase() + protein.slice(1)} Sushi`;
    return "Sushi";
  }

  if (family === "fritters") {
    if (normalized.includes("latke") || normalized.includes("potato pancake")) return "Latkes";
    if (normalized.includes("zucchini")) return "Zucchini Fritters";
    if (normalized.includes("corn")) return "Corn Fritters";
    if (normalized.includes("pakora") || normalized.includes("bhaji")) return "Pakoras";
    if (anchor) return `${anchor.charAt(0).toUpperCase() + anchor.slice(1)} Fritters`;
    return "Fritters";
  }

  if (family === "roasted") {
    if (protein) return `Roasted ${protein.charAt(0).toUpperCase() + protein.slice(1)}`;
    if (anchor) return `Roasted ${anchor.charAt(0).toUpperCase() + anchor.slice(1)}`;
    return "Sheet Pan Dinner";
  }

  if (family === "pie") {
    if (normalized.includes("quiche")) return "Quiche";
    if (normalized.includes("galette")) return "Galette";
    if (protein) return `${protein.charAt(0).toUpperCase() + protein.slice(1)} Pie`;
    return "Pie";
  }

  if (family === "dessert") {
    if (normalized.includes("ice cream")) return protein ? `${protein.charAt(0).toUpperCase() + protein.slice(1)} Ice Cream` : "Ice Cream";
    if (normalized.includes("mousse")) return "Mousse";
    if (normalized.includes("pudding")) return "Pudding";
    if (normalized.includes("sorbet")) return "Sorbet";
    if (normalized.includes("gelato")) return "Gelato";
    if (normalized.includes("crumble") || normalized.includes("crisp")) return "Fruit Crumble";
    if (normalized.includes("cobbler")) return "Cobbler";
    return "Dessert";
  }

  if (family === "cookies") {
    if (normalized.includes("oatmeal")) return "Oatmeal Cookies";
    if (normalized.includes("peanut butter")) return "Peanut Butter Cookies";
    if (normalized.includes("chocolate")) return "Chocolate Cookies";
    if (normalized.includes("muffin") || normalized.includes("muffins")) {
      if (normalized.includes("blueberry")) return "Blueberry Muffins";
      if (normalized.includes("banana")) return "Banana Muffins";
      return "Muffins";
    }
    if (normalized.includes("scone") || normalized.includes("scones")) return "Scones";
    if (normalized.includes("brownie") || normalized.includes("brownies")) return "Brownies";
    if (normalized.includes("blondie") || normalized.includes("blondies")) return "Blondies";
    return "Homemade Cookies";
  }

  if (family === "cake") {
    if (normalized.includes("cupcake") || normalized.includes("cupcakes")) return "Cupcakes";
    if (protein) return `${protein.charAt(0).toUpperCase() + protein.slice(1)} Cake`;
    return "Cake";
  }

  if (family === "bread") {
    if (normalized.includes("cinnamon roll") || normalized.includes("cinnamon bun")) return "Cinnamon Rolls";
    if (normalized.includes("pretzel")) return "Soft Pretzels";
    if (normalized.includes("naan")) return "Naan";
    if (normalized.includes("pita")) return "Pita Bread";
    return "Bread";
  }

  if (family === "skillet") {
    if (protein) return `${protein.charAt(0).toUpperCase() + protein.slice(1)} Skillet`;
    return "Skillet Dinner";
  }

  if (family === "bowl") {
    if (normalized.includes("poke")) return protein ? `${protein.charAt(0).toUpperCase() + protein.slice(1)} Poke Bowl` : "Poke Bowl";
    if (normalized.includes("burrito bowl")) return protein ? `${protein.charAt(0).toUpperCase() + protein.slice(1)} Burrito Bowl` : "Burrito Bowl";
    if (protein) return `${protein.charAt(0).toUpperCase() + protein.slice(1)} Bowl`;
    return "Grain Bowl";
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
    !includesAny(recipeText, ["pizza", "focaccia", "flatbread", "calzone", "dough", "crust", "mozzarella", "bake until the crust", "bake until golden"])
  ) {
    return false;
  }

  if (requestedFamily === "pasta" && !includesAny(recipeText, ["pasta", "linguine", "fettuccine", "spaghetti", "penne", "rigatoni", "noodle", "noodles", "gnocchi", "orzo", "macaroni", "lasagna"])) {
    return false;
  }

  if (requestedFamily === "tacos" && !includesAny(recipeText, ["taco", "tortilla", "burrito", "quesadilla", "enchilada", "fajita", "tamale", "empanada", "nacho", "wrap"])) {
    return false;
  }

  if (requestedFamily === "soup" && !includesAny(recipeText, ["soup", "stew", "broth", "simmer", "chili", "chowder", "bisque", "ramen", "pho"])) {
    return false;
  }

  if (requestedFamily === "curry" && !includesAny(recipeText, ["curry", "spice", "simmer", "coconut", "sauce", "turmeric", "cumin", "garam masala", "curry powder", "curry paste"])) {
    return false;
  }

  if (requestedFamily === "rice" && !includesAny(recipeText, ["rice", "risotto", "paella", "biryani", "pilaf", "arborio", "grain"])) {
    return false;
  }

  if (requestedFamily === "salad" && !includesAny(recipeText, ["salad", "greens", "vinaigrette", "dressing", "toss", "lettuce", "arugula", "spinach"])) {
    return false;
  }

  if (requestedFamily === "dip" && !includesAny(recipeText, ["dip", "spread", "serve", "blend", "puree", "purée"])) {
    return false;
  }

  if (requestedFamily === "breakfast" && !includesAny(recipeText, ["egg", "pancake", "waffle", "batter", "oat", "toast", "bacon", "sausage", "maple", "syrup", "breakfast", "crepe", "frittata"])) {
    return false;
  }

  if (requestedFamily === "burger" && !includesAny(recipeText, ["burger", "patty", "bun", "ground", "beef", "lettuce", "tomato", "cheese", "grill", "griddle"])) {
    return false;
  }

  if (requestedFamily === "sandwich" && !includesAny(recipeText, ["sandwich", "bread", "bun", "toast", "spread", "slice", "layer", "filling"])) {
    return false;
  }

  if (requestedFamily === "stir_fry" && !includesAny(recipeText, ["wok", "stir", "fry", "toss", "high heat", "sauce", "soy"])) {
    return false;
  }

  if (requestedFamily === "dumplings" && !includesAny(recipeText, ["dough", "wrap", "filling", "fold", "steam", "boil", "dumpling", "gyoza", "pierogi"])) {
    return false;
  }

  if (requestedFamily === "casserole" && !includesAny(recipeText, ["bake", "oven", "casserole", "layer", "baking dish", "gratin", "bubbly"])) {
    return false;
  }

  if (requestedFamily === "grilled" && !includesAny(recipeText, ["grill", "sear", "broil", "pan", "steak", "chop", "rib", "kebab", "bbq", "barbeque", "smoke", "char"])) {
    return false;
  }

  if (requestedFamily === "pie" && !includesAny(recipeText, ["pastry", "crust", "pie", "tart", "bake", "shell", "filling", "quiche"])) {
    return false;
  }

  if (requestedFamily === "dessert" && !includesAny(recipeText, ["sugar", "sweet", "vanilla", "cream", "chocolate", "chill", "freeze", "pudding", "mousse"])) {
    return false;
  }

  if (requestedFamily === "cookies" && !includesAny(recipeText, ["cookie", "cookies", "brownie", "brownies", "muffin", "muffins", "scone", "scones", "blondie", "biscotti", "bake", "dough", "flour", "butter", "sugar"])) {
    return false;
  }

  if (requestedFamily === "cake" && !includesAny(recipeText, ["cake", "cupcake", "cheesecake", "bake", "batter", "flour", "frosting", "icing"])) {
    return false;
  }

  if (requestedFamily === "bread" && !includesAny(recipeText, ["bread", "loaf", "bake", "flour", "dough", "yeast", "knead", "rise", "roll"])) {
    return false;
  }

  if (requestedFamily === "roasted" && !includesAny(recipeText, ["roast", "oven", "bake", "sheet pan", "pan", "caramelize", "golden"])) {
    return false;
  }

  if (requestedFamily === "bowl" && !includesAny(recipeText, ["bowl", "rice", "grain", "quinoa", "farro", "serve over", "served over", "topped with", "over rice", "base"])) {
    return false;
  }

  if (requestedFamily === "skillet" && !includesAny(recipeText, ["skillet", "pan"])) {
    return false;
  }
  if (requestedFamily === "fried" && !includesAny(recipeText, ["fry", "frying", "oil", "batter", "breaded", "bread crumb", "panko", "crispy", "golden", "deep", "flour", "coat"])) {
    return false;
  }
  if (requestedFamily === "meatballs" && !includesAny(recipeText, ["meatball", "ground", "meat", "roll", "form", "mix", "breadcrumb", "sauce", "bolognese", "ragu", "meatloaf", "kofta"])) {
    return false;
  }
  if (requestedFamily === "stuffed" && !includesAny(recipeText, ["stuff", "fill", "hollow", "spoon", "scoop", "filling", "inside", "cavity"])) {
    return false;
  }
  if (requestedFamily === "braised" && !includesAny(recipeText, ["braise", "simmer", "low", "slow", "tender", "oven", "broth", "wine", "liquid", "cover", "lid"])) {
    return false;
  }
  if (requestedFamily === "sushi" && !includesAny(recipeText, ["rice", "sushi", "nori", "seaweed", "roll", "raw", "sashimi", "vinegar"])) {
    return false;
  }
  if (requestedFamily === "fritters" && !includesAny(recipeText, ["fry", "batter", "grate", "shred", "oil", "crispy", "golden", "fritter", "latke", "pancake"])) {
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
