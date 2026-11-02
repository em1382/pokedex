import { existsSync } from "node:fs";
import path from "node:path";

import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";

import GridPage from "@/components/GridPage";
import { RESOURCE_META, RESOURCE_SLUGS } from "@/resources/meta";

// Each grid is a static route at its plural path (so unknown paths are a plain
// 404 and every page shell is prerendered). Adding a grid means adding its page.
const pages = import.meta.glob<{
  default: () => ReactElement<{ slug: string }>;
  metadata: { title: string };
}>("./*/page.tsx", { eager: true });

describe("grid routes", () => {
  it.each(RESOURCE_SLUGS)("%s has a page at its plural path rendering its grid", (slug) => {
    const { path: urlPath, label } = RESOURCE_META[slug];
    const page = pages[`./${urlPath}/page.tsx`];
    expect(page, `missing src/app/(grids)/${urlPath}/page.tsx`).toBeDefined();

    const element = page.default();
    expect(element.type).toBe(GridPage);
    expect(element.props.slug).toBe(slug);
    expect(page.metadata).toEqual({ title: label });
  });

  it("has no pages for unknown grids", () => {
    const known = RESOURCE_SLUGS.map((s) => `./${RESOURCE_META[s].path}/page.tsx`).sort();
    expect(Object.keys(pages).sort()).toEqual(known);
  });

  it("no longer has a catch-all [resources] route", () => {
    expect(existsSync(path.join(__dirname, "..", "[resources]"))).toBe(false);
  });
});
