import type { GridColDef } from "@mui/x-data-grid";

import { spriteColumn } from "@/components/gridHelpers";
import type { ItemRow } from "./mapper";

export const itemColumns: GridColDef<ItemRow>[] = [
  { field: "id", headerName: "ID", type: "number", width: 80 },
  spriteColumn<ItemRow>("sprite"),
  { field: "name", headerName: "Name", width: 200 },
  { field: "category", headerName: "Category", width: 170 },
  { field: "buy_price", headerName: "Buy (₽)", type: "number", width: 100 },
  { field: "sell_price", headerName: "Sell (₽)", type: "number", width: 100 },
  { field: "price_version", headerName: "Price version", width: 170 },
  { field: "fling_power", headerName: "Fling power", type: "number", width: 110 },
  { field: "fling_effect", headerName: "Fling effect", width: 140 },
  { field: "attributes", headerName: "Attributes", width: 260 },
  { field: "held_by_count", headerName: "# Held by", type: "number", width: 100 },
  { field: "effect", headerName: "Effect", flex: 1, minWidth: 320 },
];
