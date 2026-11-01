import type { GridColDef } from "@mui/x-data-grid";

import type { MoveRow } from "./mapper";

export const moveColumns: GridColDef<MoveRow>[] = [
  { field: "id", headerName: "ID", type: "number", width: 80 },
  { field: "name", headerName: "Name", width: 180 },
  { field: "type", headerName: "Type", width: 110 },
  { field: "damage_class", headerName: "Class", width: 110 },
  { field: "power", headerName: "Power", type: "number", width: 90 },
  { field: "accuracy", headerName: "Accuracy", type: "number", width: 100 },
  { field: "pp", headerName: "PP", type: "number", width: 70 },
  { field: "priority", headerName: "Priority", type: "number", width: 90 },
  { field: "effect_chance", headerName: "Effect %", type: "number", width: 90 },
  { field: "target", headerName: "Target", width: 170 },
  { field: "generation", headerName: "Generation", width: 140 },
  { field: "learned_by_count", headerName: "# Pokémon", type: "number", width: 110 },
  { field: "effect", headerName: "Effect", flex: 1, minWidth: 320 },
];
