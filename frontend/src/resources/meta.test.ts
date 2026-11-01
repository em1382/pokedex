import { describe, expect, it } from "vitest";

import { RESOURCE_META, RESOURCE_SLUGS, slugForPath } from "./meta";

describe("resource metadata", () => {
  it("has an entry for every slug, keyed consistently", () => {
    for (const slug of RESOURCE_SLUGS) {
      expect(RESOURCE_META[slug].slug).toBe(slug);
      expect(RESOURCE_META[slug].label).toBeTruthy();
      expect(RESOURCE_META[slug].description).toBeTruthy();
    }
  });

  it("uses plural paths, with pokemon as its own plural", () => {
    expect(RESOURCE_SLUGS.map((s) => RESOURCE_META[s].path)).toEqual([
      "pokemon",
      "moves",
      "abilities",
      "items",
      "types",
    ]);
  });

  it("has unique paths", () => {
    const paths = RESOURCE_SLUGS.map((s) => RESOURCE_META[s].path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe("slugForPath", () => {
  it("maps plural paths to resource slugs", () => {
    expect(slugForPath("pokemon")).toBe("pokemon");
    expect(slugForPath("moves")).toBe("move");
    expect(slugForPath("abilities")).toBe("ability");
    expect(slugForPath("items")).toBe("item");
    expect(slugForPath("types")).toBe("type");
  });

  it("rejects singular and unknown paths", () => {
    expect(slugForPath("move")).toBeUndefined();
    expect(slugForPath("pokemons")).toBeUndefined();
    expect(slugForPath("berries")).toBeUndefined();
    expect(slugForPath("")).toBeUndefined();
  });
});
