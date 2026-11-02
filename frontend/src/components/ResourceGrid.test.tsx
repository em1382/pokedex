import type { DataGridProps } from "@mui/x-data-grid";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { COLUMNS } from "@/resources/columns";
import { ROW_HEIGHT } from "./gridHelpers";
import ResourceGrid from "./ResourceGrid";

// DataGrid needs real layout to render; jsdom has none. Capture the props we
// pass instead and check the configuration contract.
let props: DataGridProps;
vi.mock("@mui/x-data-grid", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mui/x-data-grid")>()),
  DataGrid: (p: DataGridProps) => {
    props = p;
    return null;
  },
}));

const rows = [{ id: 1 }, { id: 2 }];

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

  it("is not loading by default, with skeleton rows when it is", () => {
    expect(props.loading).toBe(false);
    render(<ResourceGrid slug="move" rows={[]} loading />);
    expect(props.loading).toBe(true);
    expect(props.slotProps?.loadingOverlay).toEqual({ variant: "skeleton", noRowsVariant: "skeleton" });
  });
});

describe("ResourceGrid URL state", () => {
  beforeEach(() => window.history.replaceState(null, "", "/moves"));

  it("starts from the view in the query string", () => {
    render(<ResourceGrid slug="move" rows={rows} query="filter=type&op=equals&value=fire&sort=-power&page=2&hide=effect" />);

    expect(props.paginationModel).toEqual({ page: 1, pageSize: 25 });
    expect(props.sortModel).toEqual([{ field: "power", sort: "desc" }]);
    expect(props.filterModel?.items).toEqual([{ id: 1, field: "type", operator: "equals", value: "fire" }]);
    expect(props.columnVisibilityModel).toEqual({ effect: false });
  });

  it("writes view changes to the URL without navigating", async () => {
    const push = vi.spyOn(window.history, "pushState");
    render(<ResourceGrid slug="move" rows={rows} />);

    act(() => props.onSortModelChange!([{ field: "power", sort: "desc" }], {} as never));
    act(() => props.onPaginationModelChange!({ page: 3, pageSize: 50 }, {} as never));

    expect(window.location.pathname).toBe("/moves");
    expect(window.location.search).toBe("?sort=-power&page=4&pageSize=50");
    expect(push).not.toHaveBeenCalled();
  });

  it("clears the query when the view returns to the default", () => {
    window.history.replaceState(null, "", "/moves?page=2");
    render(<ResourceGrid slug="move" rows={rows} query="page=2" />);

    act(() => props.onPaginationModelChange!({ page: 0, pageSize: 25 }, {} as never));

    expect(window.location.search).toBe("");
  });

  it("normalizes a hand-edited link (invalid parts dropped)", () => {
    window.history.replaceState(null, "", "/moves?page=abc&sort=-power&pageSize=999");
    render(<ResourceGrid slug="move" rows={rows} query="page=abc&sort=-power&pageSize=999" />);

    expect(window.location.search).toBe("?sort=-power");
  });

  it("leaves the URL alone while showing the loading skeleton", () => {
    window.history.replaceState(null, "", "/moves?page=abc");
    render(<ResourceGrid slug="move" rows={[]} query="page=abc" loading />);

    expect(window.location.search).toBe("?page=abc");
  });
});
