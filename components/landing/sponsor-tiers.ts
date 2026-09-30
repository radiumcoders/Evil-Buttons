export type TierId = "mythic" | "legendary" | "sponsor";

/** Every perk on offer, most prominent first. */
export const perks = [
  { id: "hero", label: "Landing hero" },
  { id: "og", label: "Social preview image" },
  { id: "x", label: "Shout-outs on X" },
  { id: "section", label: "Sponsors section" },
  { id: "docs", label: "Docs" },
  { id: "readme", label: "GitHub README" },
] as const;

export type PerkId = (typeof perks)[number]["id"];

export type SponsorTier = {
  id: TierId;
  name: string;
  /** Heading above the tier's cards on the landing. */
  label: string;
  /** Rarity color for the tier's dot, game-loot style. */
  dot: string;
  spots: string;
  summary: string;
  /** What each perk means at this tier. A missing perk isn't included. */
  perks: Partial<Record<PerkId, string>>;
};

export const sponsorTiers: SponsorTier[] = [
  {
    id: "mythic",
    name: "Mythic",
    label: "Mythic sponsors",
    dot: "bg-brand",
    spots: "1 spot",
    summary: "Top billing everywhere Evil Buttons shows up.",
    perks: {
      hero: "Your logo in the Backed by chip on the first screen.",
      og: "Your logo on the preview card every time the site is shared.",
      x: "Thanked in launch and release posts whenever it fits.",
      section: "The full-width card at the top.",
      docs: "Your logo first on every docs page.",
      readme: "Top of the sponsors list.",
    },
  },
  {
    id: "legendary",
    name: "Legendary",
    label: "Legendary sponsors",
    dot: "bg-amber-500",
    spots: "2 spots",
    summary: "Front-page placement and a spot across the docs.",
    perks: {
      hero: "Your logo in the Backed by chip, after Mythic.",
      x: "A thank-you post when you come on board.",
      section: "A half-width card.",
      docs: "Your logo on every docs page.",
      readme: "Listed in the sponsors list.",
    },
  },
  {
    id: "sponsor",
    name: "Sponsor",
    label: "Sponsors",
    dot: "bg-muted-foreground/60",
    spots: "Open",
    summary: "Back the project and get listed where developers look.",
    perks: {
      section: "A compact card.",
      docs: "A smaller logo on every docs page.",
      readme: "Listed in the sponsors list.",
    },
  },
];
