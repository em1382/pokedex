import { expect, footer, names, openGrid, query, test } from "./fixtures";

test("a shared link restores the whole view and keeps its URL", async ({ page }) => {
  const shared = "filter=power&op=%3E%3D&value=100&q=kick&sort=-power&pageSize=50&hide=effect";
  await openGrid(page, `/moves?${shared}`);

  await expect(names(page)).toHaveText(["mega-kick", "jump-kick"]);
  await expect(footer(page)).toHaveText("1–2 of 2");
  await expect(page.getByRole("columnheader", { name: "Effect", exact: true })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "Power" })).toHaveAttribute(
    "aria-sort",
    "descending",
  );
  await page.waitForTimeout(1000); // nothing may rewrite the URL after loading
  expect(query(page)).toBe(shared);
});

test("a link can hide columns", async ({ page }) => {
  await openGrid(page, "/pokemon?hide=species,abilities");
  await expect(page.getByRole("columnheader", { name: "Species" })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "Abilities" })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "Types" })).toBeVisible();
});

test("invalid link values are ignored and cleaned out of the URL", async ({ page }) => {
  await openGrid(page, "/pokemon?page=abc&pageSize=999&sort=-nope");
  await expect(footer(page)).toHaveText("1–25 of 60");
  await expect(page).toHaveURL("/pokemon");
});

test("the nav-bar link to the current grid resets its view", async ({ page }) => {
  await openGrid(page, "/pokemon");
  await page.getByRole("columnheader", { name: "Weight (hg)" }).click();
  await expect(page).toHaveURL("/pokemon?sort=weight");

  await page.getByRole("banner").getByRole("link", { name: "Pokémon" }).click();

  await expect(page).toHaveURL("/pokemon");
  await expect(names(page).first()).toHaveText("bulbasaur");
  await expect(page.getByRole("columnheader", { name: "Weight (hg)" })).not.toHaveAttribute(
    "aria-sort",
    /ending/,
  );
});
