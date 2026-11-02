import { expect, test as base, type Page } from "@playwright/test";

// Every test fails if the page logs a console error or throws, which includes
// React hydration errors. Tests expecting specific errors list them.
export const test = base.extend<{ allowedConsoleErrors: RegExp[]; consoleGuard: void }>({
  allowedConsoleErrors: [[], { option: true }],
  consoleGuard: [
    async ({ page, allowedConsoleErrors }, use) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error" && !allowedConsoleErrors.some((re) => re.test(msg.text()))) {
          errors.push(msg.text());
        }
      });
      page.on("pageerror", (err) => errors.push(err.message));
      await use();
      expect(errors, "console errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Open a grid page and wait until its rows (not the loading skeleton) are shown. */
export async function openGrid(page: Page, url: string) {
  await page.goto(url);
  await expect(footer(page)).toHaveText(/ of \d/);
  await expect(page.locator(".MuiDataGrid-cellSkeleton")).toHaveCount(0);
}

/** The pagination range, e.g. "1–25 of 60". */
export function footer(page: Page) {
  return page.locator(".MuiTablePagination-displayedRows");
}

/** The Name cells of the rows currently shown, in order. */
export function names(page: Page) {
  return page.locator('[role="row"] [data-field="name"][role="gridcell"]');
}

/** The current URL's query string, without the "?". */
export function query(page: Page) {
  return new URL(page.url()).search.slice(1);
}
