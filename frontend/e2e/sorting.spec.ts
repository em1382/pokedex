import { expect, names, openGrid, query, test } from "./fixtures";

// Weight has no ties at either end in the fixture: diglett is lightest, arcanine heaviest.
test("clicking a column header sorts ascending, then descending, and updates the URL", async ({
  page,
}) => {
  await openGrid(page, "/pokemon");
  const header = page.getByRole("columnheader", { name: "Weight (hg)" });

  await header.click();
  await expect(names(page).first()).toHaveText("diglett");
  await expect(page).toHaveURL("/pokemon?sort=weight");

  await header.click();
  await expect(names(page).first()).toHaveText("arcanine");
  await expect(page).toHaveURL("/pokemon?sort=-weight");
});

test("a link with a sort opens sorted, across pages", async ({ page }) => {
  await openGrid(page, "/pokemon?sort=-weight");
  await expect(names(page).first()).toHaveText("arcanine");
  await expect(names(page).nth(1)).toHaveText("venusaur");
  await expect(page.getByRole("columnheader", { name: "Weight (hg)" })).toHaveAttribute(
    "aria-sort",
    "descending",
  );

  await page.getByRole("button", { name: "Go to next page" }).click();
  await expect(names(page).first()).not.toHaveText("arcanine");
  expect(query(page)).toBe("sort=-weight&page=2");
});
