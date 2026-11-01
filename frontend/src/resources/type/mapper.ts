import type { Projection } from "@/lib/api";
import { names, type NamedAPIResource } from "@/lib/pokeapi-types";

export const typeProjection: Projection = {
  fields: ["id", "name", "generation", "move_damage_class", "damage_relations"],
  counts: ["pokemon", "moves"],
};

interface TypeDetail {
  id: number;
  name: string;
  generation: NamedAPIResource;
  move_damage_class: NamedAPIResource | null;
  damage_relations: {
    double_damage_to: NamedAPIResource[];
    double_damage_from: NamedAPIResource[];
    half_damage_to: NamedAPIResource[];
    half_damage_from: NamedAPIResource[];
    no_damage_to: NamedAPIResource[];
    no_damage_from: NamedAPIResource[];
  };
  pokemon_count: number;
  moves_count: number;
}

export interface TypeRow {
  id: number;
  name: string;
  generation: string;
  damage_class: string;
  double_damage_to: string;
  double_damage_from: string;
  half_damage_to: string;
  half_damage_from: string;
  no_damage_to: string;
  no_damage_from: string;
  pokemon_count: number;
  move_count: number;
}

export function toTypeRow(t: TypeDetail): TypeRow {
  const r = t.damage_relations;
  return {
    id: t.id,
    name: t.name,
    generation: t.generation?.name ?? "",
    damage_class: t.move_damage_class?.name ?? "",
    double_damage_to: names(r?.double_damage_to),
    double_damage_from: names(r?.double_damage_from),
    half_damage_to: names(r?.half_damage_to),
    half_damage_from: names(r?.half_damage_from),
    no_damage_to: names(r?.no_damage_to),
    no_damage_from: names(r?.no_damage_from),
    pokemon_count: t.pokemon_count ?? 0,
    move_count: t.moves_count ?? 0,
  };
}
