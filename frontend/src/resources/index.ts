import "server-only";

import { getResourceRows, type Projection } from "@/lib/api";
import { abilityProjection, toAbilityRow } from "./ability/mapper";
import { itemProjection, toItemRow } from "./item/mapper";
import { RESOURCE_META, type ResourceSlug } from "./meta";
import { moveProjection, toMoveRow } from "./move/mapper";
import { pokemonProjection, toPokemonRow } from "./pokemon/mapper";
import { toTypeRow, typeProjection } from "./type/mapper";

interface Loader {
  projection: Projection;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toRow: (detail: any) => { id: number };
}

const LOADERS: Record<ResourceSlug, Loader> = {
  pokemon: { projection: pokemonProjection, toRow: toPokemonRow },
  move: { projection: moveProjection, toRow: toMoveRow },
  ability: { projection: abilityProjection, toRow: toAbilityRow },
  item: { projection: itemProjection, toRow: toItemRow },
  type: { projection: typeProjection, toRow: toTypeRow },
};

/** All rows for a grid; the backend returns them ordered by PokeAPI id. */
export function loadRows(slug: ResourceSlug) {
  const { projection, toRow } = LOADERS[slug];
  return getResourceRows(RESOURCE_META[slug].path, projection, toRow);
}
