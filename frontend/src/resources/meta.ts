// Shared (server + client) metadata for each grid. Adding a grid: see README "Adding a grid".

export const RESOURCE_SLUGS = ["pokemon", "move", "ability", "item", "type"] as const;

export type ResourceSlug = (typeof RESOURCE_SLUGS)[number];

interface ResourceMeta {
  /** Plural URL segment, for both our pages (/moves) and the Rails API (/api/moves). */
  path: string;
  label: string;
  description: string;
}

/** Keyed by PokeAPI resource name (singular), e.g. "move". */
export const RESOURCE_META: Record<ResourceSlug, ResourceMeta> = {
  pokemon: {
    path: "pokemon", // its own plural
    label: "Pokémon",
    description: "Every Pokémon and form: types, abilities, size and base stats.",
  },
  move: {
    path: "moves",
    label: "Moves",
    description: "Every move: type, damage class, power, accuracy, PP and effect.",
  },
  ability: {
    path: "abilities",
    label: "Abilities",
    description: "Every ability: generation, effect and how many Pokémon have it.",
  },
  item: {
    path: "items",
    label: "Items",
    description: "Every item: category, buy/sell price, fling data, attributes and effect.",
  },
  type: {
    path: "types",
    label: "Types",
    description: "Every type with its full damage-relation matchups.",
  },
};
