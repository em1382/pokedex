// PokeAPI-shaped records (trimmed, plus some fields the app ignores) and a
// helper that mirrors the backend's /all projection (PokeapiProjection).

import type { Projection } from "@/lib/api";

type Doc = Record<string, unknown>;

const res = (name: string, path = name) => ({ name, url: `https://pokeapi.co/api/v2/${path}/` });
const en = res("en", "language/9");
const ja = res("ja", "language/11");
export const SPRITE_BASE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/";

/**
 * Apply a projection like the backend does: keep dotted `fields` (nested
 * structure preserved, missing → null), turn `counts` arrays into `<key>_count`,
 * and reduce `english` arrays to their first English entry.
 */
export function project(doc: Doc, { fields, counts = [], english = [] }: Projection): Doc {
  const out: Doc = {};
  for (const path of fields) {
    const keys = path.split(".");
    let src: unknown = doc;
    for (const k of keys) src = src && typeof src === "object" ? (src as Doc)[k] : undefined;
    let dst = out;
    keys.slice(0, -1).forEach((k) => {
      dst[k] = (dst[k] as Doc) ?? {};
      dst = dst[k] as Doc;
    });
    dst[keys.at(-1)!] = src === undefined ? null : src;
  }
  for (const key of counts)
    out[`${key}_count`] = (doc[key] as unknown[] | undefined)?.length ?? null;
  for (const key of english) {
    const entries = (doc[key] as { language?: { name: string } }[] | undefined) ?? [];
    out[key] = entries.filter((e) => e.language?.name === "en").slice(0, 1);
  }
  return out;
}

export const pokemonDoc: Doc = {
  id: 25,
  name: "pikachu",
  height: 4,
  weight: 60,
  base_experience: 112,
  is_default: true,
  order: 35,
  species: res("pikachu", "pokemon-species/25"),
  sprites: {
    front_default: `${SPRITE_BASE}pokemon/25.png`,
    back_default: `${SPRITE_BASE}pokemon/back/25.png`,
  },
  // Deliberately out of slot order.
  types: [
    { slot: 2, type: res("fairy") },
    { slot: 1, type: res("electric") },
  ],
  abilities: [
    { slot: 3, is_hidden: true, ability: res("lightning-rod") },
    { slot: 1, is_hidden: false, ability: res("static") },
  ],
  stats: [
    { base_stat: 35, stat: res("hp") },
    { base_stat: 55, stat: res("attack") },
    { base_stat: 40, stat: res("defense") },
    { base_stat: 50, stat: res("special-attack") },
    { base_stat: 50, stat: res("special-defense") },
    { base_stat: 90, stat: res("speed") },
  ],
  moves: [{ move: res("thunder-shock") }, { move: res("quick-attack") }, { move: res("thunder") }],
  game_indices: [{ game_index: 84 }],
};

export const moveDoc: Doc = {
  id: 7,
  name: "fire-punch",
  accuracy: 100,
  power: 75,
  pp: 15,
  priority: 0,
  effect_chance: 10,
  type: res("fire"),
  damage_class: res("physical"),
  target: res("selected-pokemon"),
  generation: res("generation-i"),
  effect_entries: [
    { effect: "Long Japanese text", short_effect: "日本語", language: ja },
    {
      effect: "Has a $effect_chance% chance to burn the target.",
      short_effect: "Has a  $effect_chance%\nchance to burn the target.",
      language: en,
    },
  ],
  learned_by_pokemon: [res("charmander"), res("charizard")],
  flavor_text_entries: [
    { flavor_text: "Un coup de poing enflammé.", language: res("fr", "language/5") },
    { flavor_text: "The target is punched\nwith a fiery fist.", language: en },
  ],
};

export const abilityDoc: Doc = {
  id: 9,
  name: "static",
  is_main_series: true,
  generation: res("generation-iii"),
  effect_entries: [], // no effect text → falls back to flavor text
  flavor_text_entries: [
    {
      flavor_text: "Contact may\nparalyze the foe.",
      language: en,
      version_group: res("ruby-sapphire"),
    },
  ],
  pokemon: [
    { is_hidden: false, pokemon: res("pikachu") },
    { is_hidden: true, pokemon: res("electrode") },
    { is_hidden: false, pokemon: res("voltorb") },
  ],
  names: [{ name: "Static", language: en }],
};

export const itemDoc: Doc = {
  id: 1,
  name: "master-ball",
  fling_power: null,
  fling_effect: null,
  category: res("standard-balls"),
  attributes: [res("countable"), res("consumable")],
  sprites: { default: `${SPRITE_BASE}items/master-ball.png` },
  prices: [
    {
      purchase_price: 0,
      sell_price: 0,
      currency: res("poke-dollar"),
      version_group: res("red-blue"),
    },
    {
      purchase_price: 1200,
      sell_price: 600,
      currency: res("poke-dollar"),
      version_group: res("x-y"),
    },
    // Newest version group lists no price; the mapper should skip it.
    {
      purchase_price: null,
      sell_price: null,
      currency: res("poke-dollar"),
      version_group: res("scarlet-violet"),
    },
  ],
  effect_entries: [
    { effect: "Long.", short_effect: "Catches a wild Pokémon every time.", language: en },
  ],
  flavor_text_entries: [{ text: "ignored", language: en }],
  held_by_pokemon: [],
};

export const typeDoc: Doc = {
  id: 13,
  name: "electric",
  generation: res("generation-i"),
  move_damage_class: res("special"),
  damage_relations: {
    double_damage_to: [res("flying"), res("water")],
    double_damage_from: [res("ground")],
    half_damage_to: [res("electric"), res("grass"), res("dragon")],
    half_damage_from: [res("flying"), res("steel"), res("electric")],
    no_damage_to: [res("ground")],
    no_damage_from: [],
  },
  pokemon: [
    { slot: 1, pokemon: res("pikachu") },
    { slot: 1, pokemon: res("raichu") },
  ],
  moves: [res("thunder"), res("thunderbolt"), res("spark"), res("discharge")],
};
