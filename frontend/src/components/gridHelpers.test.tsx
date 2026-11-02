import type { GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ROW_HEIGHT, spriteColumn, withEllipsis } from "./gridHelpers";

const FIBONACCI = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];
const params = (value: unknown, formattedValue: unknown = value) =>
  ({ value, formattedValue }) as unknown as GridRenderCellParams;

describe("ROW_HEIGHT", () => {
  it("is a Fibonacci number that fits the 40px sprites", () => {
    expect(FIBONACCI).toContain(ROW_HEIGHT);
    expect(ROW_HEIGHT).toBeGreaterThan(40);
  });
});

describe("spriteColumn", () => {
  const col = spriteColumn("sprite");

  it("is a centered, non-sortable, non-filterable flex cell", () => {
    expect(col).toMatchObject({
      field: "sprite",
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      display: "flex",
      align: "center",
    });
  });

  it("renders the sprite image", () => {
    const { container } = render(<>{col.renderCell!(params("/sprites/pokemon/25.png"))}</>);
    const img = container.querySelector("img")!;
    expect(img).toHaveAttribute("src", "/sprites/pokemon/25.png");
    expect(img).toHaveAttribute("width", "40");
    expect(img).toHaveAttribute("loading", "lazy");
  });

  it("renders nothing without a sprite", () => {
    const { container } = render(<>{col.renderCell!(params(null))}</>);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("withEllipsis", () => {
  const custom = () => "custom";
  const cols: GridColDef[] = [
    { field: "name" },
    { field: "power", type: "number" },
    { field: "flag", type: "boolean" },
    { field: "sprite", renderCell: custom },
  ];
  const [name, power, flag, sprite] = withEllipsis(cols);

  it("gives text and number columns the ellipsis cell", () => {
    render(<>{name.renderCell!(params("pikachu"))}</>);
    expect(screen.getByText("pikachu")).toHaveStyle({
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    });
  });

  it("shows the formatted value (e.g. 1,000) rather than the raw one", () => {
    render(<>{power.renderCell!(params(1000, "1,000"))}</>);
    expect(screen.getByText("1,000")).toBeInTheDocument();
  });

  it("renders nothing for empty values", () => {
    expect(name.renderCell!(params(null))).toBeNull();
    expect(name.renderCell!(params(""))).toBeNull();
  });

  it("keeps boolean and custom-rendered columns as they are", () => {
    expect(flag).toBe(cols[2]);
    expect(sprite).toBe(cols[3]);
  });

  it("doesn't mutate the input columns", () => {
    expect(cols[0].renderCell).toBeUndefined();
  });
});
