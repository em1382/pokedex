import { expect, footer, names, openGrid, query, test } from "./fixtures";

test("a link with a filter shows only matching rows", async ({ page }) => {
  await openGrid(page, "/moves?filter=type&op=equals&value=fire");

  await expect(footer(page)).toHaveText("1–3 of 3");
  await expect(names(page)).toHaveText(["fire-punch", "ember", "flamethrower"]);
  expect(query(page)).toBe("filter=type&op=equals&value=fire");
});

test("a link with a numeric filter compares numbers", async ({ page }) => {
  await openGrid(page, "/moves?filter=power&op=%3E%3D&value=100");

  await expect(footer(page)).toHaveText("1–6 of 6");
  await expect(names(page)).toHaveText([
    "mega-kick",
    "jump-kick",
    "thrash",
    "double-edge",
    "hydro-pump",
    "blizzard",
  ]);
});

test("a filter operator the column doesn't offer is ignored and dropped from the URL", async ({
  page,
}) => {
  await openGrid(page, "/moves?filter=power&op=contains&value=5");

  await expect(footer(page)).toHaveText("1–25 of 60");
  await expect(page).toHaveURL("/moves");
});

test("filtering from the filter panel updates the rows and the URL", async ({ page }) => {
  await openGrid(page, "/moves");

  await page.getByRole("button", { name: "Filters" }).click();
  const panel = page.getByRole("dialog", { name: "Filters" });
  await panel.getByRole("combobox", { name: "Column" }).click();
  await page.getByRole("option", { name: "Type", exact: true }).click();
  await panel.getByRole("textbox", { name: "Value" }).fill("fire");

  await expect(footer(page)).toHaveText("1–3 of 3");
  await expect(page).toHaveURL("/moves?filter=type&op=contains&value=fire");
});

test.describe("quick search", () => {
  test("matches names only", async ({ page }) => {
    // "ember" is a Fire-type move, but its name doesn't contain "fire".
    await openGrid(page, "/moves?q=fire");
    await expect(names(page)).toHaveText(["fire-punch"]);
    await expect(footer(page)).toHaveText("1–1 of 1");
  });

  test("typing a search filters the rows and updates the URL", async ({ page }) => {
    await openGrid(page, "/moves");

    await page.getByRole("button", { name: "Search" }).click();
    await page.getByPlaceholder("Search names…").fill("punch");

    await expect(footer(page)).toHaveText("1–5 of 5");
    await expect(names(page)).toHaveText([
      "comet-punch",
      "mega-punch",
      "fire-punch",
      "ice-punch",
      "thunder-punch",
    ]);
    await expect(page).toHaveURL("/moves?q=punch");
  });

  test("a search that matches nothing shows no rows", async ({ page }) => {
    await page.goto("/pokemon?q=zzzz");
    await expect(footer(page)).toHaveText("0–0 of 0");
  });
});
