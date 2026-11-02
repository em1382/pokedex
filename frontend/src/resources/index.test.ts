import { cacheLife } from "next/cache";
import { afterEach, describe, expect, it, vi } from "vitest";

import { abilityDoc, itemDoc, moveDoc, pokemonDoc, project, typeDoc } from "../../test/fixtures";
import { abilityProjection } from "./ability/mapper";
import { COLUMNS } from "./columns";
import { loadRows } from "./index";
import { itemProjection } from "./item/mapper";
import { RESOURCE_META, RESOURCE_SLUGS, type ResourceSlug } from "./meta";
import { moveProjection } from "./move/mapper";
import { pokemonProjection } from "./pokemon/mapper";
import { typeProjection } from "./type/mapper";

// Outside Next, "use cache" is a no-op string; cacheLife needs the Next runtime.
vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));

const PROJECTED: Record<ResourceSlug, Record<string, unknown>> = {
  pokemon: project(pokemonDoc, pokemonProjection),
  move: project(moveDoc, moveProjection),
  ability: project(abilityDoc, abilityProjection),
  item: project(itemDoc, itemProjection),
  type: project(typeDoc, typeProjection),
};

function serve() {
  const fetch = vi.fn(async (url: string) => {
    const path = new URL(url).pathname.split("/")[2];
    const slug = RESOURCE_SLUGS.find((s) => RESOURCE_META[s].path === path)!;
    return { ok: true, status: 200, json: async () => [PROJECTED[slug]] } as Response;
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => vi.unstubAllGlobals());

describe("loadRows", () => {
  it.each(RESOURCE_SLUGS)("loads %s from its plural API path", async (slug) => {
    const fetch = serve();
    const rows = await loadRows(slug);

    expect(new URL((fetch.mock.calls[0] as unknown as [string])[0]).pathname).toBe(
      `/api/${RESOURCE_META[slug].path}/all`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(PROJECTED[slug].id);
  });

  it("caches rows for hours (data only changes on re-import)", async () => {
    serve();
    await loadRows("type");
    expect(cacheLife).toHaveBeenCalledWith("hours");
  });

  it.each(RESOURCE_SLUGS)("produces every field the %s grid's columns display", async (slug) => {
    serve();
    const [row] = await loadRows(slug);
    for (const col of COLUMNS[slug]) expect(row).toHaveProperty(col.field);
  });
});

describe("column definitions", () => {
  it.each(RESOURCE_SLUGS)("%s columns have unique fields and an ID column first", (slug) => {
    const fields = COLUMNS[slug].map((c) => c.field);
    expect(new Set(fields).size).toBe(fields.length);
    expect(fields[0]).toBe("id");
  });
});
