import { expect, footer, names, openGrid, test } from "./fixtures";

// Totals and first rows come from the e2e fixture (backend/test/e2e/pokeapi.json).
const GRIDS = [
  { path: "/pokemon", title: "Pokémon", total: 60, first: ["bulbasaur", "ivysaur", "venusaur"] },
  { path: "/moves", title: "Moves", total: 60, first: ["pound", "karate-chop", "double-slap"] },
  {
    path: "/abilities",
    title: "Abilities",
    total: 30,
    first: ["stench", "drizzle", "speed-boost"],
  },
  { path: "/items", title: "Items", total: 60, first: ["master-ball", "ultra-ball", "great-ball"] },
  { path: "/types", title: "Types", total: 21, first: ["normal", "fighting", "flying"] },
];

for (const grid of GRIDS) {
  test(`${grid.title}: shows the first page of every record`, async ({ page }) => {
    await openGrid(page, grid.path);

    await expect(page.getByRole("heading", { level: 1, name: grid.title })).toBeVisible();
    const pageSize = Math.min(25, grid.total);
    await expect(footer(page)).toHaveText(`1–${pageSize} of ${grid.total}`);
    await expect(names(page).first()).toHaveText(grid.first[0]);
    await expect(names(page).nth(1)).toHaveText(grid.first[1]);
    await expect(names(page).nth(2)).toHaveText(grid.first[2]);
  });
}

for (const path of ["/pokemon", "/items"]) {
  test(`${path}: sprites load`, async ({ page }) => {
    await openGrid(page, path);
    const sprite = page.locator('[role="row"] [data-field="sprite"] img').first();
    await expect(sprite).toBeVisible();
    await expect
      .poll(() => sprite.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
  });
}

test("long text is cut off, with the full text in a tooltip", async ({ page }) => {
  await openGrid(page, "/items");
  const cells = page.locator('[role="row"] [data-field="effect"] span');
  const index = await cells.evaluateAll((spans) =>
    spans.findIndex((s) => s.scrollWidth > s.clientWidth),
  );
  expect(index, "a truncated Effect cell").toBeGreaterThanOrEqual(0);
  const cell = cells.nth(index);

  await cell.hover();
  await expect(page.getByRole("tooltip")).toHaveText((await cell.textContent()) ?? "");
});
