import type { Projection } from "@/lib/api";
import {
  clean,
  english,
  type NamedAPIResource,
  type VerboseEffect,
} from "@/lib/pokeapi-types";

export const moveProjection: Projection = {
  fields: [
    "id", "name", "accuracy", "power", "pp", "priority", "effect_chance",
    "type", "damage_class", "target", "generation", "effect_entries",
  ],
  counts: ["learned_by_pokemon"],
};

interface MoveDetail {
  id: number;
  name: string;
  accuracy: number | null;
  power: number | null;
  pp: number | null;
  priority: number;
  effect_chance: number | null;
  type: NamedAPIResource;
  damage_class: NamedAPIResource | null;
  target: NamedAPIResource;
  generation: NamedAPIResource;
  effect_entries: VerboseEffect[];
  learned_by_pokemon_count: number;
}

export interface MoveRow {
  id: number;
  name: string;
  type: string;
  damage_class: string;
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  priority: number;
  effect_chance: number | null;
  target: string;
  generation: string;
  effect: string;
  learned_by_count: number;
}

export function toMoveRow(m: MoveDetail): MoveRow {
  const effect = english(m.effect_entries);
  return {
    id: m.id,
    name: m.name,
    type: m.type?.name ?? "",
    damage_class: m.damage_class?.name ?? "",
    power: m.power,
    accuracy: m.accuracy,
    pp: m.pp,
    priority: m.priority,
    effect_chance: m.effect_chance,
    target: m.target?.name ?? "",
    generation: m.generation?.name ?? "",
    effect: clean(effect?.short_effect).replace(
      /\$effect_chance/g,
      String(m.effect_chance ?? ""),
    ),
    learned_by_count: m.learned_by_pokemon_count ?? 0,
  };
}
