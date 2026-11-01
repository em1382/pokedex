import type { GridColDef } from "@mui/x-data-grid";

import type { AbilityRow } from "./mapper";

export const abilityColumns: GridColDef<AbilityRow>[] = [
  { field: "id", headerName: "ID", type: "number", width: 80 },
  { field: "name", headerName: "Name", width: 180 },
  { field: "generation", headerName: "Generation", width: 140 },
  { field: "is_main_series", headerName: "Main series", type: "boolean", width: 110 },
  { field: "pokemon_count", headerName: "# Pokémon", type: "number", width: 110 },
  { field: "hidden_count", headerName: "# Hidden", type: "number", width: 100 },
  { field: "effect", headerName: "Effect", flex: 1, minWidth: 360 },
];
