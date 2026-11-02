import type { GridColDef, GridValidRowModel } from "@mui/x-data-grid";

import EllipsisCell from "./EllipsisCell";

/**
 * Every grid uses the same fixed row height: the smallest Fibonacci number that
 * fits the tallest cell content (40px sprites). Nothing wraps, so rows never grow.
 */
export const ROW_HEIGHT = 55;

const SPRITE_SIZE = 40;

export function spriteColumn<R extends GridValidRowModel>(field: string): GridColDef<R> {
  return {
    field,
    headerName: "Sprite",
    width: 72,
    sortable: false,
    filterable: false,
    disableColumnMenu: true,
    display: "flex", // flex cell → image vertically centered
    align: "center",
    headerAlign: "center",
    renderCell: ({ value }) =>
      value ? (
        // Plain <img>: sprites are small static files served by the backend; no next/image needed.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value as string}
          alt=""
          width={SPRITE_SIZE}
          height={SPRITE_SIZE}
          loading="lazy"
          style={{ display: "block" }}
        />
      ) : null,
  };
}

/**
 * Give every column without its own renderer a single-line ellipsis cell with
 * a tooltip. Booleans keep the grid's check/cross icons.
 */
export function withEllipsis<R extends GridValidRowModel>(
  columns: GridColDef<R>[],
): GridColDef<R>[] {
  return columns.map((col) =>
    col.renderCell || col.type === "boolean"
      ? col
      : {
          ...col,
          renderCell: ({ formattedValue, value }) => {
            const text = String(formattedValue ?? value ?? "");
            return text ? <EllipsisCell text={text} /> : null;
          },
        },
  );
}
