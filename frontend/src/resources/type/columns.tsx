import type { GridColDef } from "@mui/x-data-grid";

import type { TypeRow } from "./mapper";

const relation = (field: keyof TypeRow, headerName: string): GridColDef<TypeRow> => ({
  field,
  headerName,
  width: 220,
});

export const typeColumns: GridColDef<TypeRow>[] = [
  { field: "id", headerName: "ID", type: "number", width: 80 },
  { field: "name", headerName: "Name", width: 120 },
  { field: "generation", headerName: "Generation", width: 140 },
  { field: "damage_class", headerName: "Damage class", width: 120 },
  relation("double_damage_to", "2× to"),
  relation("double_damage_from", "2× from"),
  relation("half_damage_to", "½× to"),
  relation("half_damage_from", "½× from"),
  relation("no_damage_to", "0× to"),
  relation("no_damage_from", "0× from"),
  { field: "pokemon_count", headerName: "# Pokémon", type: "number", width: 110 },
  { field: "move_count", headerName: "# Moves", type: "number", width: 100 },
];
