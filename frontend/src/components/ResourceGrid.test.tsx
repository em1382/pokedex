import type { DataGridProps } from "@mui/x-data-grid";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { COLUMNS } from "@/resources/columns";
import { ROW_HEIGHT } from "./gridHelpers";
import ResourceGrid, { LoadingGrid } from "./ResourceGrid";

// DataGrid needs real layout to render; jsdom has none. Capture the props we
// pass instead and check the configuration contract. (ResourceGrid.real.test.tsx
// renders the real grid.)
let props: DataGridProps;
vi.mock("@mui/x-data-grid", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mui/x-data-grid")>()),
  DataGrid: (p: DataGridProps) => {
    props = p;
    return null;
  },
}));

// Like Next, useSearchParams follows the browser URL, including our own
// replaceState writes (Next re-renders on those; tests call rerender()).
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

/** Navigate to /moves?<search>. */
function visit(search: string) {
  window.history.replaceState(null, "", `/moves${search ? `?${search}` : ""}`);
}

const rows = [{ id: 1 }, { id: 2 }];

beforeEach(() => visit(""));

describe("ResourceGrid", () => {
  beforeEach(() => {
    render(<ResourceGrid slug="move" rows={rows} />);
  });

  it("passes the rows and the resource's columns", () => {
    expect(props.rows).toBe(rows);
    expect(props.columns.map((c) => c.field)).toEqual(COLUMNS.move.map((c) => c.field));
  });

  it("paginates client-side within the MIT DataGrid's 100-row page limit", () => {
    expect(props.pagination).toBe(true);
    expect(props.paginationMode).toBe("client");
    const options = props.pageSizeOptions as number[];
    expect(Math.max(...options)).toBeLessThanOrEqual(100);
    expect(props.paginationModel).toEqual({ page: 0, pageSize: 25 });
    expect(options).toContain(props.paginationModel?.pageSize);
  });

  it("disables CSV and print export (print would exceed the MIT page limit)", () => {
    const toolbar = props.slotProps?.toolbar;
    expect(props.showToolbar).toBe(true);
    expect(toolbar?.csvOptions?.disableToolbarButton).toBe(true);
    expect(toolbar?.printOptions?.disableToolbarButton).toBe(true);
  });

  it("uses the fixed Fibonacci row height", () => {
    expect(props.rowHeight).toBe(ROW_HEIGHT);
  });

  it("gives every text column the ellipsis cell", () => {
    for (const col of props.columns) {
      if (col.type !== "boolean") expect(col.renderCell, col.field).toBeTypeOf("function");
    }
  });

  it("keeps the ID column visible (it can't be hidden)", () => {
    expect(props.columns.find((c) => c.field === "id")?.hideable).toBe(false);
    expect(props.columns.filter((c) => c.hideable === false)).toHaveLength(1);
  });

  it("is not in its loading state", () => {
    expect(props.loading).toBe(false);
  });
});

describe("LoadingGrid", () => {
  it("shows the same columns with skeleton rows", () => {
    render(<LoadingGrid slug="move" />);
    expect(props.loading).toBe(true);
    expect(props.rows).toEqual([]);
    expect(props.slotProps?.loadingOverlay).toEqual({
      variant: "skeleton",
      noRowsVariant: "skeleton",
    });
    expect(props.columns.map((c) => c.field)).toEqual(COLUMNS.move.map((c) => c.field));
  });

  it("leaves the URL alone", () => {
    visit("page=abc");
    render(<LoadingGrid slug="move" />);
    expect(window.location.search).toBe("?page=abc");
  });

  it("renders a same-sized placeholder on the server (DataGrid can't be prerendered)", async () => {
    const { renderToString } = await import("react-dom/server");
    const html = renderToString(<LoadingGrid slug="move" />);
    expect(html).toContain("MuiBox-root");
    expect(html).not.toContain("MuiDataGrid");
  });
});

describe("ResourceGrid URL state", () => {
  it("starts from the view in the URL", () => {
    visit("filter=type&op=equals&value=fire&sort=-power&page=2&hide=effect");
    render(<ResourceGrid slug="move" rows={rows} />);

    expect(props.paginationModel).toEqual({ page: 1, pageSize: 25 });
    expect(props.sortModel).toEqual([{ field: "power", sort: "desc" }]);
    expect(props.filterModel?.items).toEqual([
      { id: 1, field: "type", operator: "equals", value: "fire" },
    ]);
    expect(props.columnVisibilityModel).toEqual({ effect: false });
  });

  it("writes view changes to the URL without navigating", () => {
    const push = vi.spyOn(window.history, "pushState");
    render(<ResourceGrid slug="move" rows={rows} />);

    act(() => props.onSortModelChange!([{ field: "power", sort: "desc" }], {} as never));
    act(() => props.onPaginationModelChange!({ page: 3, pageSize: 50 }, {} as never));
    act(() => props.onFilterModelChange!({ items: [], quickFilterValues: ["punch"] }, {} as never));
    act(() => props.onColumnVisibilityModelChange!({ effect: false }, {} as never));

    expect(window.location.pathname).toBe("/moves");
    expect(window.location.search).toBe("?q=punch&sort=-power&page=4&pageSize=50&hide=effect");
    expect(push).not.toHaveBeenCalled();
  });

  it("clears the query when the view returns to the default", () => {
    visit("page=2");
    render(<ResourceGrid slug="move" rows={rows} />);

    act(() => props.onPaginationModelChange!({ page: 0, pageSize: 25 }, {} as never));

    expect(window.location.search).toBe("");
  });

  it("normalizes a hand-edited link (invalid parts dropped)", () => {
    visit("page=abc&sort=-power&pageSize=999&filter=power&op=contains&value=5");
    render(<ResourceGrid slug="move" rows={rows} />);

    expect(window.location.search).toBe("?sort=-power");
  });

  it("adopts the view when a navigation changes the URL (e.g. a link to this grid)", () => {
    const { rerender } = render(<ResourceGrid slug="move" rows={rows} />);
    act(() => props.onSortModelChange!([{ field: "power", sort: "desc" }], {} as never));
    expect(window.location.search).toBe("?sort=-power");
    rerender(<ResourceGrid slug="move" rows={rows} />); // Next syncs our replaceState

    // The nav bar's plain /moves link:
    visit("");
    rerender(<ResourceGrid slug="move" rows={rows} />);

    expect(props.sortModel).toEqual([]);
    expect(window.location.search).toBe("");

    // A shared link to a different view of the same grid:
    visit("filter=type&op=equals&value=fire");
    rerender(<ResourceGrid slug="move" rows={rows} />);
    expect(props.filterModel?.items[0]).toMatchObject({ field: "type", value: "fire" });
  });

  it("isn't reset by its own URL writes", () => {
    const { rerender } = render(<ResourceGrid slug="move" rows={rows} />);
    act(() => props.onPaginationModelChange!({ page: 2, pageSize: 25 }, {} as never));
    act(() => props.onFilterModelChange!({ items: [], quickFilterValues: ["a"] }, {} as never));

    // Next re-renders with the URL we just wrote — even if it reorders the params.
    expect(window.location.search).toBe("?q=a&page=3");
    visit("page=3&q=a");
    rerender(<ResourceGrid slug="move" rows={rows} />);

    expect(props.paginationModel).toEqual({ page: 2, pageSize: 25 });
    expect(props.filterModel?.quickFilterValues).toEqual(["a"]);
  });

  it("keeps every change when several happen before Next reflects the first write", () => {
    render(<ResourceGrid slug="move" rows={rows} />);

    // No re-render from Next between these: each write is still "in flight".
    act(() => props.onSortModelChange!([{ field: "power", sort: "desc" }], {} as never));
    act(() => props.onPaginationModelChange!({ page: 1, pageSize: 25 }, {} as never));
    act(() => props.onColumnVisibilityModelChange!({ target: false }, {} as never));

    expect(props.sortModel).toEqual([{ field: "power", sort: "desc" }]);
    expect(props.paginationModel?.page).toBe(1);
    expect(props.columnVisibilityModel).toEqual({ target: false });
    expect(window.location.search).toBe("?sort=-power&page=2&hide=target");
  });

  it("doesn't queue a write for a change that leaves the URL as it is", () => {
    const replace = vi.spyOn(window.history, "replaceState");
    const { rerender } = render(<ResourceGrid slug="move" rows={rows} />);

    // DataGrid reports an unchanged model (e.g. on mount); the URL already matches.
    act(() => props.onFilterModelChange!({ items: [] }, {} as never));
    // ...so a later navigation to this same (empty) query is still recognized.
    act(() => props.onSortModelChange!([{ field: "name", sort: "asc" }], {} as never));
    rerender(<ResourceGrid slug="move" rows={rows} />);
    visit("");
    rerender(<ResourceGrid slug="move" rows={rows} />);

    expect(props.sortModel).toEqual([]);
    expect(replace.mock.calls.filter(([, , u]) => u === "/moves?sort=name")).toHaveLength(1);
  });
});
