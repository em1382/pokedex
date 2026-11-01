import "server-only";

/**
 * The Rails API serves imported PokeAPI data from SQLite (no network at request
 * time). The browser never talks to Rails directly, except for sprite images,
 * which go through the /sprites rewrite in next.config.ts.
 */
export const RAILS_API_URL = process.env.RAILS_API_URL ?? "http://localhost:3001";

export class BackendError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

/** Which parts of each record to fetch (see PokeapiProjection in the backend). */
export interface Projection {
  /** Dotted JSON paths to keep, e.g. "sprites.front_default". */
  fields: string[];
  /** Top-level arrays to return only as "<name>_count". */
  counts?: string[];
}

async function fetchJson<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${RAILS_API_URL}${path}`, { cache: "no-store" });
  } catch (err) {
    throw new BackendError(
      `Could not reach the Rails API at ${RAILS_API_URL} (${(err as Error).message}). Is it running?`,
    );
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new BackendError(body?.error ?? `Rails API ${res.status} for ${path}`, res.status);
  }
  return (await res.json()) as T;
}

/** Every record of a resource in one request, trimmed to `projection`, mapped to rows. */
export async function getResourceRows<D, R>(
  /** Plural API path segment, e.g. "moves". */
  path: string,
  projection: Projection,
  toRow: (detail: D) => R,
): Promise<R[]> {
  const query = new URLSearchParams({ fields: projection.fields.join(",") });
  if (projection.counts?.length) query.set("counts", projection.counts.join(","));
  const docs = await fetchJson<D[]>(`/api/${path}/all?${query}`);
  return docs.map(toRow);
}
