import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import ResourceGrid from "@/components/ResourceGrid";
import { BackendError } from "@/lib/api";
import { loadRows } from "@/resources";
import { RESOURCE_META, slugForPath, type ResourceSlug } from "@/resources/meta";
import { fib } from "@/theme/spacing";

export default function ResourcePage({ params, searchParams }: PageProps<"/[resources]">) {
  // Params resolve almost immediately; nothing to show until we know the title.
  return (
    <Suspense fallback={null}>
      <ResourceView params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ResourceView({ params, searchParams }: PageProps<"/[resources]">) {
  const slug = slugForPath((await params).resources);
  if (!slug) notFound();

  // While the rows load: the real grid (same columns) with its skeleton overlay.
  return (
    <Suspense
      fallback={
        <>
          <Title slug={slug} />
          <ResourceGrid slug={slug} rows={[]} loading />
        </>
      }
    >
      <GridData slug={slug} searchParams={searchParams} />
    </Suspense>
  );
}

async function GridData({
  slug,
  searchParams,
}: {
  slug: ResourceSlug;
  searchParams: PageProps<"/[resources]">["searchParams"];
}) {
  // Request-time only: never prerender (the Rails API need not be up at build time).
  await connection();
  const result = await loadRows(slug).then(
    (rows) => ({ rows }),
    (err: unknown) => {
      if (err instanceof BackendError) return { error: err.message };
      throw err;
    },
  );
  const query = toQueryString(await searchParams);
  return (
    <>
      <Title slug={slug} />
      {"error" in result ? (
        <Alert severity="error">{result.error}</Alert>
      ) : (
        // Keyed on the query so following a shared link to this grid starts that view.
        <ResourceGrid key={query} slug={slug} rows={result.rows} query={query} />
      )}
    </>
  );
}

function Title({ slug }: { slug: ResourceSlug }) {
  return (
    <Typography variant="h4" component="h1" sx={{ mb: fib(13) }}>
      {RESOURCE_META[slug].label}
    </Typography>
  );
}

/** Next's searchParams object back to a query string (repeated keys preserved). */
function toQueryString(params: Record<string, string | string[] | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) search.append(key, v);
  }
  return search.toString();
}
