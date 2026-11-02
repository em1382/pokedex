import type { Projection } from "@/lib/api";
import { localSprite, type NamedAPIResource } from "@/lib/pokeapi-types";

export const pokemonProjection: Projection = {
  fields: [
    "id",
    "name",
    "height",
    "weight",
    "base_experience",
    "is_default",
    "species",
    "sprites.front_default",
    "types",
    "abilities",
    "stats",
  ],
  counts: ["moves"],
};

interface PokemonDetail {
  id: number;
  name: string;
  height: number;
  weight: number;
  base_experience: number | null;
  is_default: boolean;
  species: NamedAPIResource;
  sprites: { front_default: string | null };
  types: { slot: number; type: NamedAPIResource }[];
  abilities: { is_hidden: boolean; slot: number; ability: NamedAPIResource }[];
  stats: { base_stat: number; stat: NamedAPIResource }[];
  moves_count: number;
}

export interface PokemonRow {
  id: number;
  name: string;
  sprite: string | null;
  species: string;
  types: string;
  abilities: string;
  height: number;
  weight: number;
  base_experience: number | null;
  hp: number | null;
  attack: number | null;
  defense: number | null;
  special_attack: number | null;
  special_defense: number | null;
  speed: number | null;
  total: number;
  move_count: number;
  is_default: boolean;
}

export function toPokemonRow(p: PokemonDetail): PokemonRow {
  const stats = p.stats ?? [];
  const stat = (name: string) => stats.find((s) => s.stat.name === name)?.base_stat ?? null;
  return {
    id: p.id,
    name: p.name,
    sprite: localSprite(p.sprites?.front_default),
    species: p.species?.name ?? "",
    types: [...(p.types ?? [])]
      .sort((a, b) => a.slot - b.slot)
      .map((t) => t.type.name)
      .join(", "),
    abilities: [...(p.abilities ?? [])]
      .sort((a, b) => a.slot - b.slot)
      .map((a) => (a.is_hidden ? `${a.ability.name} (hidden)` : a.ability.name))
      .join(", "),
    height: p.height,
    weight: p.weight,
    base_experience: p.base_experience,
    hp: stat("hp"),
    attack: stat("attack"),
    defense: stat("defense"),
    special_attack: stat("special-attack"),
    special_defense: stat("special-defense"),
    speed: stat("speed"),
    total: stats.reduce((sum, s) => sum + s.base_stat, 0),
    move_count: p.moves_count ?? 0,
    is_default: p.is_default,
  };
}
