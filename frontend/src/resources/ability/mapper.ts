import type { Projection } from "@/lib/api";
import {
  clean,
  english,
  type NamedAPIResource,
  type VerboseEffect,
} from "@/lib/pokeapi-types";

export const abilityProjection: Projection = {
  fields: [
    "id", "name", "is_main_series", "generation", "effect_entries",
    "flavor_text_entries", "pokemon",
  ],
  english: ["effect_entries", "flavor_text_entries"],
};

interface AbilityDetail {
  id: number;
  name: string;
  is_main_series: boolean;
  generation: NamedAPIResource;
  effect_entries: VerboseEffect[];
  flavor_text_entries: { flavor_text: string; language: NamedAPIResource }[];
  pokemon: { is_hidden: boolean; pokemon: NamedAPIResource }[];
}

export interface AbilityRow {
  id: number;
  name: string;
  generation: string;
  is_main_series: boolean;
  effect: string;
  pokemon_count: number;
  hidden_count: number;
}

export function toAbilityRow(a: AbilityDetail): AbilityRow {
  const pokemon = a.pokemon ?? [];
  return {
    id: a.id,
    name: a.name,
    generation: a.generation?.name ?? "",
    is_main_series: a.is_main_series,
    effect: clean(
      english(a.effect_entries)?.short_effect ??
        english(a.flavor_text_entries)?.flavor_text,
    ),
    pokemon_count: pokemon.length,
    hidden_count: pokemon.filter((p) => p.is_hidden).length,
  };
}
