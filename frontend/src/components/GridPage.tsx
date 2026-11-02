import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import ResourceGrid, { LoadingGrid } from "@/components/ResourceGrid";
import { BackendError } from "@/lib/api";
import { loadRows } from "@/resources";
import { RESOURCE_META, type ResourceSlug } from "@/resources/meta";
import { fib } from "@/theme/spacing";

/**
 * A grid page: title + the resource's grid. Each grid has its own static route
 * (app/(grids)/<path>/page.tsx), so unknown paths are a plain 404 and the page
 * shell (title + skeleton) is prerendered.
 */
export default function GridPage({ slug }: { slug: ResourceSlug }) {
  return (
    <>
      <Typography variant="h4" component="h1" sx={{ mb: fib(13) }}>
        {RESOURCE_META[slug].label}
      </Typography>
      {/* While the rows load, the grid shows its skeleton. */}
      <Suspense fallback={<LoadingGrid slug={slug} />}>
        <GridData slug={slug} />
      </Suspense>
    </>
  );
}

/** Tab title for a grid page, e.g. "Moves · PokeAPI Grids" (template in the root layout). */
export function gridMetadata(slug: ResourceSlug): Metadata {
  return { title: RESOURCE_META[slug].label };
}

async function GridData({ slug }: { slug: ResourceSlug }) {
  // Request-time only: never prerender (the Rails API need not be up at build time).
  await connection();
  const result = await loadRows(slug).then(
    (rows) => ({ rows }),
    (err: unknown) => {
      if (err instanceof BackendError) return { error: err.message };
      throw err;
    },
  );
  if ("error" in result) return <Alert severity="error">{result.error}</Alert>;
  return <ResourceGrid slug={slug} rows={result.rows} />;
}
