import { describe, expect, it } from "vitest";

import { clean, english, localSprite, names } from "./pokeapi-types";

const lang = (name: string) => ({ name, url: `https://pokeapi.co/api/v2/language/${name}/` });

describe("english", () => {
  it("picks the English entry", () => {
    const entries = [{ text: "ja", language: lang("ja") }, { text: "en", language: lang("en") }];
    expect(english(entries)?.text).toBe("en");
  });

  it("falls back to the first entry when there is no English one", () => {
    expect(english([{ text: "fr", language: lang("fr") }])?.text).toBe("fr");
  });

  it("handles empty and missing lists", () => {
    expect(english([])).toBeUndefined();
    expect(english(undefined)).toBeUndefined();
    expect(english(null)).toBeUndefined();
  });
});

describe("names", () => {
  it("joins resource names", () => {
    expect(names([{ name: "a", url: "" }, { name: "b", url: "" }])).toBe("a, b");
  });

  it("is empty for missing lists", () => {
    expect(names(undefined)).toBe("");
    expect(names(null)).toBe("");
  });
});

describe("clean", () => {
  it("collapses whitespace and newlines PokeAPI leaves in text", () => {
    expect(clean("  Has a\nchance\f to   burn. ")).toBe("Has a chance to burn.");
  });

  it("is empty for missing text", () => {
    expect(clean(undefined)).toBe("");
    expect(clean(null)).toBe("");
  });
});

describe("localSprite", () => {
  const base = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/";

  it("rewrites PokeAPI sprite URLs to the backend-served /sprites path", () => {
    expect(localSprite(`${base}pokemon/25.png`)).toBe("/sprites/pokemon/25.png");
    expect(localSprite(`${base}items/master-ball.png`)).toBe("/sprites/items/master-ball.png");
  });

  it("leaves other URLs alone", () => {
    expect(localSprite("https://example.com/a.png")).toBe("https://example.com/a.png");
  });

  it("returns null for missing sprites", () => {
    expect(localSprite(null)).toBeNull();
    expect(localSprite(undefined)).toBeNull();
    expect(localSprite("")).toBeNull();
  });
});
