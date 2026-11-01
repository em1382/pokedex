// Shared (server + client) metadata for each grid. Add an entry here, a folder
// under src/resources/<slug>/ with mapper.ts + columns.tsx, and register them in
// ./index.ts and ./columns.ts to add a new grid.

export const RESOURCE_SLUGS = ["pokemon", "move", "ability", "item", "type"] as const;

export type ResourceSlug = (typeof RESOURCE_SLUGS)[number];

export interface ResourceMeta {
  /** PokeAPI resource name (singular), e.g. "move". */
  slug: ResourceSlug;
  /** Plural URL segment, for both our pages (/moves) and the Rails API (/api/moves). */
  path: string;
  label: string;
  description: string;
}

export const RESOURCE_META: Record<ResourceSlug, ResourceMeta> = {
  pokemon: {
    slug: "pokemon",
    path: "pokemon", // its own plural
    label: "Pokémon",
    description: "Every Pokémon and form: types, abilities, size and base stats.",
  },
  move: {
    slug: "move",
    path: "moves",
    label: "Moves",
    description: "Every move: type, damage class, power, accuracy, PP and effect.",
  },
  ability: {
    slug: "ability",
    path: "abilities",
    label: "Abilities",
    description: "Every ability: generation, effect and how many Pokémon have it.",
  },
  item: {
    slug: "item",
    path: "items",
    label: "Items",
    description: "Every item: category, buy/sell price, fling data, attributes and effect.",
  },
  type: {
    slug: "type",
    path: "types",
    label: "Types",
    description: "Every type with its full damage-relation matchups.",
  },
};

/** Resource for a plural URL segment ("moves" → "move"), or undefined. */
export function slugForPath(path: string): ResourceSlug | undefined {
  return RESOURCE_SLUGS.find((slug) => RESOURCE_META[slug].path === path);
}
