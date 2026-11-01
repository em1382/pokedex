import type { DataGridProps } from "@mui/x-data-grid";
import { render } from "@testing-library/react";
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
    const initial = props.initialState?.pagination?.paginationModel?.pageSize;
    expect(options).toContain(initial);
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
