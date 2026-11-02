import { describe, expect, it } from "vitest";

import { RESOURCE_META, RESOURCE_SLUGS } from "./meta";

describe("resource metadata", () => {
  it("has an entry for every slug, keyed consistently", () => {
    for (const slug of RESOURCE_SLUGS) {
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
