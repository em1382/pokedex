import type { GridColDef } from "@mui/x-data-grid";

import { abilityColumns } from "./ability/columns";
import { itemColumns } from "./item/columns";
import type { ResourceSlug } from "./meta";
import { moveColumns } from "./move/columns";
import { pokemonColumns } from "./pokemon/columns";
import { typeColumns } from "./type/columns";

// Column defs hold render functions, so they live on the client side only.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const COLUMNS: Record<ResourceSlug, GridColDef<any>[]> = {
  pokemon: pokemonColumns,
  move: moveColumns,
  ability: abilityColumns,
  item: itemColumns,
  type: typeColumns,
};
