import { expect, test } from "./fixtures";

const GRIDS = [
  ["Pokémon", "/pokemon"],
  ["Moves", "/moves"],
  ["Abilities", "/abilities"],
  ["Items", "/items"],
  ["Types", "/types"],
] as const;

test("the directory links to every grid", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Resource directory" })).toBeVisible();
  for (const [label, href] of GRIDS) {
    await expect(
      page.getByRole("main").getByRole("link", { name: new RegExp(`^${label}`) }),
    ).toHaveAttribute("href", href);
  }

  await page
    .getByRole("main")
    .getByRole("link", { name: /^Moves/ })
    .click();
  await expect(page).toHaveURL("/moves");
  await expect(page.getByRole("heading", { level: 1, name: "Moves" })).toBeVisible();
});

test("each grid page has its own title", async ({ page }) => {
  for (const [label, href] of GRIDS) {
    await page.goto(href);
    await expect(page).toHaveTitle(`${label} · PokeAPI Grids`);
  }
});

test("the nav bar switches between grids and marks the current one", async ({ page }) => {
  await page.goto("/pokemon");
  const nav = page.getByRole("banner").getByRole("navigation");
  await nav.getByRole("link", { name: "Items" }).click();
  await expect(page).toHaveURL("/items");
  await expect(nav.getByRole("link", { name: "Items" })).toHaveAttribute("aria-current", "page");
});

test.describe("unknown pages", () => {
  test.use({ allowedConsoleErrors: [/404/] });

  test("return a real 404", async ({ page }) => {
    const response = await page.goto("/nope");
    expect(response?.status()).toBe(404);
  });
});

test("old singular URLs redirect to the plural pages", async ({ page }) => {
  await page.goto("/move?sort=-power");
  await expect(page).toHaveURL("/moves?sort=-power");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the hamburger menu opens the grids and closes after picking one", async ({ page }) => {
    await page.goto("/pokemon");
    const menuButton = page.getByRole("button", { name: "Open navigation" });
    await expect(page.getByRole("banner").getByRole("link", { name: "Items" })).toBeHidden();

    await menuButton.click();
    const drawer = page.locator("#nav-drawer");
    await drawer.getByRole("link", { name: "Items" }).click();

    await expect(page).toHaveURL("/items");
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  });
});
