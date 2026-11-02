import { describe, expect, it } from "vitest";

import { abilityDoc, itemDoc, moveDoc, pokemonDoc, project, SPRITE_BASE, typeDoc } from "../../test/fixtures";
import { abilityProjection, toAbilityRow } from "./ability/mapper";
import { itemProjection, toItemRow } from "./item/mapper";
import { moveProjection, toMoveRow } from "./move/mapper";
import { pokemonProjection, toPokemonRow } from "./pokemon/mapper";
import { toTypeRow, typeProjection } from "./type/mapper";

// Every mapper runs on exactly what the backend's /all endpoint returns for its
// projection, so a field the mapper reads but the projection omits shows up here.
/* eslint-disable @typescript-eslint/no-explicit-any */
const projected = (doc: Record<string, unknown>, projection: Parameters<typeof project>[1]) =>
  project(doc, projection) as any;

describe("toPokemonRow", () => {
  const row = toPokemonRow(projected(pokemonDoc, pokemonProjection));

  it("flattens a Pokémon", () => {
    expect(row).toEqual({
      id: 25,
      name: "pikachu",
      sprite: "/sprites/pokemon/25.png",
      species: "pikachu",
      types: "electric, fairy",
      abilities: "static, lightning-rod (hidden)",
      height: 4,
      weight: 60,
      base_experience: 112,
      hp: 35,
      attack: 55,
      defense: 40,
      special_attack: 50,
      special_defense: 50,
      speed: 90,
      total: 320,
      move_count: 3,
      is_default: true,
    });
  });

  it("does not request the heavy move list, only its count", () => {
    expect(pokemonProjection.fields).not.toContain("moves");
    expect(pokemonProjection.counts).toContain("moves");
  });

  it("copes with missing stats and sprites", () => {
    const sparse = toPokemonRow(
      projected({ ...pokemonDoc, stats: [], sprites: { front_default: null }, base_experience: null }, pokemonProjection),
    );
    expect(sparse.hp).toBeNull();
    expect(sparse.total).toBe(0);
    expect(sparse.sprite).toBeNull();
    expect(sparse.base_experience).toBeNull();
  });
});

describe("toMoveRow", () => {
  it("flattens a move, using the English effect with $effect_chance filled in", () => {
    expect(toMoveRow(projected(moveDoc, moveProjection))).toEqual({
      id: 7,
      name: "fire-punch",
      type: "fire",
      damage_class: "physical",
      power: 75,
      accuracy: 100,
      pp: 15,
      priority: 0,
      effect_chance: 10,
      target: "selected-pokemon",
      generation: "generation-i",
      effect: "Has a 10% chance to burn the target.",
      learned_by_count: 2,
    });
  });

  it("falls back to English flavor text for moves without an effect entry", () => {
    const row = toMoveRow(projected({ ...moveDoc, effect_entries: [] }, moveProjection));
    expect(row.effect).toBe("The target is punched with a fiery fist.");
  });

  it("asks the backend for English-only effect and flavor text", () => {
    expect(moveProjection.english).toEqual(["effect_entries", "flavor_text_entries"]);
    expect(moveProjection.fields).toEqual(expect.arrayContaining(moveProjection.english!));
  });

  it("handles status moves without power, accuracy or damage class", () => {
    const row = toMoveRow(
      projected({ ...moveDoc, power: null, accuracy: null, damage_class: null, effect_chance: null }, moveProjection),
    );
    expect(row.power).toBeNull();
    expect(row.accuracy).toBeNull();
    expect(row.damage_class).toBe("");
    expect(row.effect).toBe("Has a % chance to burn the target.");
  });
});

describe("toAbilityRow", () => {
  it("flattens an ability, falling back to flavor text when there is no effect", () => {
    expect(toAbilityRow(projected(abilityDoc, abilityProjection))).toEqual({
      id: 9,
      name: "static",
      generation: "generation-iii",
      is_main_series: true,
      effect: "Contact may paralyze the foe.",
      pokemon_count: 3,
      hidden_count: 1,
    });
  });

  it("prefers the effect text when present", () => {
    const doc = {
      ...abilityDoc,
      effect_entries: [{ effect: "x", short_effect: "Paralyzes on contact.", language: { name: "en", url: "" } }],
    };
    expect(toAbilityRow(projected(doc, abilityProjection)).effect).toBe("Paralyzes on contact.");
  });
});

describe("toItemRow", () => {
  it("flattens an item, using the newest version group that has a price", () => {
    expect(toItemRow(projected(itemDoc, itemProjection))).toEqual({
      id: 1,
      name: "master-ball",
      sprite: "/sprites/items/master-ball.png",
      category: "standard-balls",
      buy_price: 1200,
      sell_price: 600,
      price_version: "x-y",
      fling_power: null,
      fling_effect: "",
      attributes: "countable, consumable",
      held_by_count: 0,
      effect: "Catches a wild Pokémon every time.",
    });
  });

  it("leaves prices empty when PokeAPI has none", () => {
    const row = toItemRow(projected({ ...itemDoc, prices: [] }, itemProjection));
    expect([row.buy_price, row.sell_price, row.price_version]).toEqual([null, null, ""]);
  });

  it("keeps non-PokeAPI sprite URLs as they are", () => {
    const row = toItemRow(projected({ ...itemDoc, sprites: { default: "https://example.com/x.png" } }, itemProjection));
    expect(row.sprite).toBe("https://example.com/x.png");
    expect(SPRITE_BASE).toContain("raw.githubusercontent.com");
  });
});

describe("toTypeRow", () => {
  it("flattens a type with its damage relations", () => {
    expect(toTypeRow(projected(typeDoc, typeProjection))).toEqual({
      id: 13,
      name: "electric",
      generation: "generation-i",
      damage_class: "special",
      double_damage_to: "flying, water",
      double_damage_from: "ground",
      half_damage_to: "electric, grass, dragon",
      half_damage_from: "flying, steel, electric",
      no_damage_to: "ground",
      no_damage_from: "",
      pokemon_count: 2,
      move_count: 4,
    });
  });

  it("handles types without a damage class (e.g. fairy, stellar)", () => {
    expect(toTypeRow(projected({ ...typeDoc, move_damage_class: null }, typeProjection)).damage_class).toBe("");
  });
});

describe("sparse records", () => {
  // Only id + name present: every mapper must still produce a row (no throws).
  const sparse = { id: 1, name: "x" };
  it.each([
    ["pokemon", () => toPokemonRow(projected(sparse, pokemonProjection))],
    ["move", () => toMoveRow(projected(sparse, moveProjection))],
    ["ability", () => toAbilityRow(projected(sparse, abilityProjection))],
    ["item", () => toItemRow(projected(sparse, itemProjection))],
    ["type", () => toTypeRow(projected(sparse, typeProjection))],
  ])("%s", (_, map) => {
    expect(() => map()).not.toThrow();
    expect(map()).toMatchObject({ id: 1, name: "x" });
  });
});
