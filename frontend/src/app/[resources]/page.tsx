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

export default function ResourcePage({ params }: PageProps<"/[resources]">) {
  // Params resolve almost immediately; nothing to show until we know the title.
  return (
    <Suspense fallback={null}>
      <ResourceView params={params} />
    </Suspense>
  );
}

async function ResourceView({ params }: Pick<PageProps<"/[resources]">, "params">) {
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
      <GridData slug={slug} />
    </Suspense>
  );
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
  return (
    <>
      <Title slug={slug} />
      {"error" in result ? (
        <Alert severity="error">{result.error}</Alert>
      ) : (
        <ResourceGrid slug={slug} rows={result.rows} />
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
