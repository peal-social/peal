// The kinds of block the owner asked for, in their words and order, which
// the showcase's index follows so a review reads as the request did. Each
// block names the ones it answers; a kind no block answers yet says which
// phase brings it.
export const categories = [
  "Announcements",
  "Pixel arts",
  "Backgrounds",
  "Borders",
  "CTA",
  "Clients",
  "Comparisons",
  "Docks",
  "FAQ",
  "Features",
  "Footers",
  "Galleries",
  "Gradients",
  "Heroes",
  "Hooks",
  "Images",
  "Maps",
  "Marquees",
  "Navigation menus",
  "Pricing sections",
  "Scroll areas",
  "Shaders",
  "Stats and KPIs",
  "Steppers",
  "Team sections",
  "Testimonials",
  "Texts",
  "Timelines",
  "Videos",
] as const;

export type Category = (typeof categories)[number];

/** Where the plan builds the blocks of a kind the showcase has none of yet. */
export const plannedPhase: Readonly<Partial<Record<Category, string>>> = {
  Announcements: "P2 and P5",
  CTA: "P2",
  Clients: "P2 and P6",
  Comparisons: "P4",
  Docks: "P3",
  FAQ: "P3",
  Features: "P2 and P3",
  Galleries: "P6",
  Heroes: "P2",
  Images: "P6",
  Maps: "P8, on the owner's word",
  Marquees: "P3",
  "Pixel arts": "P1",
  "Pricing sections": "P4",
  "Scroll areas": "P3",
  Shaders: "P1",
  "Stats and KPIs": "P2",
  Steppers: "P2",
  "Team sections": "P6",
  Testimonials: "P6",
  Timelines: "P5",
  Videos: "P6",
};

/**
 * What the plan decided for a kind that has no block of its own, said on
 * the index in place of a link.
 */
export const decided: Readonly<Partial<Record<Category, string>>> = {
  Footers: "The site's footer, already in peal-ui; no second variant.",
  Gradients:
    "The brand field is the one gradient: see Pixel arts and Backgrounds.",
  Hooks:
    "None exported: shared behaviour is a ui-sdk primitive, such as the art stage.",
  "Navigation menus":
    "The site's header and its mega menus, already in peal-ui.",
};
