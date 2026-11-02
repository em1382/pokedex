import { expect, footer, names, openGrid, query, test } from "./fixtures";

test("next and previous pages update the rows and the URL", async ({ page }) => {
  await openGrid(page, "/pokemon");

  await page.getByRole("button", { name: "Go to next page" }).click();
  await expect(footer(page)).toHaveText("26–50 of 60");
  await expect(names(page).first()).toHaveText("raichu");
  await expect(page).toHaveURL("/pokemon?page=2");

  await page.getByRole("button", { name: "Go to next page" }).click();
  await expect(footer(page)).toHaveText("51–60 of 60");
  await expect(names(page).first()).toHaveText("dugtrio");
  await expect(page.getByRole("button", { name: "Go to next page" })).toBeDisabled();

  await page.getByRole("button", { name: "Go to previous page" }).click();
  await page.getByRole("button", { name: "Go to previous page" }).click();
  await expect(footer(page)).toHaveText("1–25 of 60");
  await expect(page).toHaveURL("/pokemon");
});

test("changing rows per page updates the rows and the URL", async ({ page }) => {
  await openGrid(page, "/pokemon");

  await page.getByRole("combobox", { name: /rows per page/i }).click();
  await page.getByRole("option", { name: "50" }).click();

  await expect(footer(page)).toHaveText("1–50 of 60");
  await expect(page).toHaveURL("/pokemon?pageSize=50");
});

test("rows per page never goes above the MIT DataGrid's limit of 100", async ({ page }) => {
  await openGrid(page, "/pokemon");
  await page.getByRole("combobox", { name: /rows per page/i }).click();
  await expect(page.getByRole("option")).toHaveText(["25", "50", "100"]);
});

test("a link to a page opens on that page and keeps its URL", async ({ page }) => {
  await openGrid(page, "/pokemon?page=3");

  await expect(footer(page)).toHaveText("51–60 of 60");
  await expect(names(page).first()).toHaveText("dugtrio");
  await page.waitForTimeout(1000); // nothing may rewrite the URL after loading
  expect(query(page)).toBe("page=3");
});

test("a link with a page size opens with that page size", async ({ page }) => {
  await openGrid(page, "/pokemon?page=2&pageSize=50");

  await expect(footer(page)).toHaveText("51–60 of 60");
  expect(query(page)).toBe("page=2&pageSize=50");
});
