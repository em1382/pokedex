import type { GridColDef } from "@mui/x-data-grid";

import { spriteColumn } from "@/components/gridHelpers";
import type { PokemonRow } from "./mapper";

const stat = (field: keyof PokemonRow, headerName: string): GridColDef<PokemonRow> => ({
  field,
  headerName,
  type: "number",
  width: 80,
});

export const pokemonColumns: GridColDef<PokemonRow>[] = [
  { field: "id", headerName: "ID", type: "number", width: 80 },
  spriteColumn<PokemonRow>("sprite"),
  { field: "name", headerName: "Name", width: 180 },
  { field: "species", headerName: "Species", width: 150 },
  { field: "types", headerName: "Types", width: 150 },
  { field: "abilities", headerName: "Abilities", width: 260 },
  { field: "height", headerName: "Height (dm)", type: "number", width: 110 },
  { field: "weight", headerName: "Weight (hg)", type: "number", width: 110 },
  { field: "base_experience", headerName: "Base XP", type: "number", width: 100 },
  stat("hp", "HP"),
  stat("attack", "Atk"),
  stat("defense", "Def"),
  stat("special_attack", "SpA"),
  stat("special_defense", "SpD"),
  stat("speed", "Spe"),
  stat("total", "Total"),
  { field: "move_count", headerName: "# Moves", type: "number", width: 100 },
  { field: "is_default", headerName: "Default form", type: "boolean", width: 120 },
];
