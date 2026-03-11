export const TECHNIQUE_LIBRARY: Record<
  string,
  { name: string; description: string; chefTip: string }
> = {
  searing: {
    name: "Proper Searing",
    description: "Heat the pan until very hot before adding oil. Pat meat dry to ensure a good crust.",
    chefTip: "Do not move the meat until a crust forms.",
  },
  pastaWater: {
    name: "Salt Pasta Water",
    description: "Salt pasta water until it tastes like the sea.",
    chefTip: "This seasons pasta from the inside.",
  },
  garlicBloom: {
    name: "Bloom Garlic",
    description: "Cook garlic gently in oil for 30 seconds to release aroma.",
    chefTip: "Avoid browning garlic to prevent bitterness.",
  },
  toastSpices: {
    name: "Toast Spices",
    description: "Heat spices in oil before adding liquids.",
    chefTip: "This deepens flavor dramatically.",
  },
  deglaze: {
    name: "Deglaze the Pan",
    description: "Add wine, broth, or water to scrape browned bits.",
    chefTip: "Those bits are pure flavor.",
  },
};
