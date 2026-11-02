import type { Projection } from "@/lib/api";
import {
  clean,
  english,
  localSprite,
  names,
  type NamedAPIResource,
  type VerboseEffect,
} from "@/lib/pokeapi-types";

export const itemProjection: Projection = {
  fields: [
    "id", "name", "prices", "fling_power", "fling_effect", "category",
    "attributes", "sprites.default", "effect_entries", "flavor_text_entries",
  ],
  counts: ["held_by_pokemon"],
  english: ["effect_entries", "flavor_text_entries"],
};

interface ItemDetail {
  id: number;
  name: string;
  prices?: {
    purchase_price: number | null;
    sell_price: number | null;
    currency: NamedAPIResource;
    version_group: NamedAPIResource;
  }[];
  fling_power: number | null;
  fling_effect: NamedAPIResource | null;
  category: NamedAPIResource;
  attributes: NamedAPIResource[];
  sprites: { default: string | null };
  effect_entries: VerboseEffect[];
  flavor_text_entries: { text: string; language: NamedAPIResource }[];
  held_by_pokemon_count: number;
}

export interface ItemRow {
  id: number;
  name: string;
  sprite: string | null;
  category: string;
  buy_price: number | null;
  sell_price: number | null;
  price_version: string;
  fling_power: number | null;
  fling_effect: string;
  attributes: string;
  held_by_count: number;
  effect: string;
}

export function toItemRow(i: ItemDetail): ItemRow {
  // Prices are listed per version group, oldest first; show the most recent
  // entry that actually has a price (newer games sometimes list nulls).
  const price = i.prices?.findLast(
    (p) => p.purchase_price != null || p.sell_price != null,
  );
  return {
    id: i.id,
    name: i.name,
    sprite: localSprite(i.sprites?.default),
    category: i.category?.name ?? "",
    buy_price: price?.purchase_price ?? null,
    sell_price: price?.sell_price ?? null,
    price_version: price?.version_group.name ?? "",
    fling_power: i.fling_power,
    fling_effect: i.fling_effect?.name ?? "",
    attributes: names(i.attributes),
    held_by_count: i.held_by_pokemon_count ?? 0,
    effect: clean(
      english(i.effect_entries)?.short_effect ?? english(i.flavor_text_entries)?.text,
    ),
  };
}
