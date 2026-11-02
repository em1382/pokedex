# mass-datagrid-port

PokeAPI data in MUI data grids, served from our own backend. After the data
has been imported once, everything works offline.

| Dir         | What                                                                         | Port |
| ----------- | ---------------------------------------------------------------------------- | ---- |
| `backend/`  | Rails 8 API serving PokeAPI data from SQLite (`storage/development.sqlite3`) | 3001 |
| `frontend/` | Next.js 16 (App Router) + MUI `DataGrid`, one grid per resource type         | 3000 |

```
                    import (once, explicit)
pokeapi.co ─────────────────────────────────┐
raw.githubusercontent.com (sprites) ────────┤
                                            ▼
browser ──> Next.js server ──> Rails /api/:resources/all ──> SQLite
   └──── /sprites/* (Next rewrite) ──> Rails /sprites/* ──> SQLite
```

- The API **never** calls out at request time. If a record or resource hasn't been imported, it returns 404, and the error message names the import command to run.
- The browser only talks to Next.js. Next.js loads all rows for a grid in a single request and passes them to `DataGrid`. Pagination (25/50/100 rows per page), sorting and filtering then run in the browser.

## Setup

You need Ruby 3.4 (the version in `backend/.ruby-version`, e.g. `rbenv install 3.4.9`),
Node 24 and pnpm.

```sh
pnpm bootstrap      # pnpm install, bundle install, create the SQLite DB
pnpm import         # one-time download into SQLite (needs network)
pnpm dev            # Rails on :3001 and Next on :3000
```

Open http://localhost:3000.

## Docker (fully offline)

One image runs both apps, with the PokeAPI data imported **at build time** into SQLite
(records + sprites). Building needs network access; the running container needs none.

```sh
docker build -t pokedex .
docker run --rm -p 3000:3000 pokedex          # http://localhost:3000
```

- Only Next.js (port 3000) is exposed. Rails listens on `127.0.0.1:3001` inside the container, and
  Next starts only once Rails is up. The healthcheck covers both.
- Build args: `POKEAPI_RESOURCES` (default `pokemon,moves,abilities,items,types`),
  `POKEAPI_SPRITES` (`0` to skip images), `POKEAPI_DELAY` (seconds between upstream requests,
  default `0.05`).
- Fair use: PokeAPI responses and sprite images are kept in a BuildKit cache mount
  (`id=pokeapi-cache`), so rebuilds reuse them instead of downloading again.
- The import runs with `STRICT=1`: if any record or sprite fails to download, the build fails
  instead of shipping an image with missing data.
- `docker stop` shuts both servers down promptly at any point. If either server exits on its own,
  the container exits non-zero, so restart policies notice.
- The image builds on x86_64 and ARM64 (e.g. Apple Silicon).
- Rails' production SSL settings are opt-in (`RAILS_FORCE_SSL=1`, `RAILS_ASSUME_SSL=1`), because
  in this setup Rails is never exposed directly. `SECRET_KEY_BASE` defaults to a random value per
  boot (the API has no sessions); set it explicitly if you need a stable one.

## Importing data (`bin/rails pokeapi:import`)

```sh
pnpm import                                              # pokemon, move, ability, item, type + sprites
cd backend && bin/rails pokeapi:import RESOURCES=berries # any PokeAPI v2 resource (plural or PokeAPI name)
bin/rails pokeapi:import SPRITES=0 FORCE=1 DELAY=0.1     # skip images, refresh records, slower
bin/rails pokeapi:import STRICT=1                        # exit non-zero if anything failed
pnpm import:status                                       # row counts per resource
```

The import fetches the resource list, then every detail record. Each record is
stored verbatim as JSON in `pokeapi_records`, with one row per
`(resource, pokeapi_id)`. Records are keyed by id because names are not always
unique: the item list has two entries named `roseli-berry`. After the records,
it downloads the sprite each grid shows into `pokeapi_sprites`.

It follows PokeAPI's [fair use policy](https://pokeapi.co/docs/v2#fairuse):

- Records already in SQLite are skipped, so re-running the import is cheap.
- Upstream requests run one at a time, with a 50 ms pause (`DELAY`) after every request that reaches
  the network, failed ones included, and send a descriptive `User-Agent`.
- Rate limiting (429) and server errors (5xx) are retried up to 4 times with backoff (1, 2, 4 s),
  honouring `Retry-After` (capped at 60 s). Other errors fail that one record and are reported.
- Every PokeAPI response and sprite image is also cached in `backend/storage/pokeapi_cache`
  (30-day TTL). A `FORCE=1` re-import, or a rebuilt database, reads from that cache instead of
  calling PokeAPI or GitHub again. You can delete the folder once the import is done.

To use the app on another machine with no network, export a single self-contained copy of the
database (the live file is in WAL mode, so copying it directly can miss recent rows):

```sh
cd backend && bin/rails pokeapi:export FILE=/tmp/pokeapi.sqlite3
# then on the other machine: copy it to backend/storage/development.sqlite3
```

## Rails API

| Route                                              | Returns                                                                      |
| -------------------------------------------------- | ---------------------------------------------------------------------------- |
| `GET /api/:resources?limit=&offset=`               | PokeAPI-style paginated list (`count`, `next`, `previous`, `results`)        |
| `GET /api/:resources/:id_or_name`                  | The stored PokeAPI record, verbatim                                          |
| `GET /api/:resources/all?fields=&counts=&english=` | Every record in one JSON array, ordered by id, optionally trimmed (streamed) |
| `GET /sprites/*path`                               | Sprite image (same path as under `PokeAPI/sprites/master/sprites/`)          |

Collection paths are plural (`/api/moves`, `/api/abilities`, `/api/pokemon-species`); "pokemon"
is its own plural (`/api/pokemon`). Singular paths return 404 with a hint. Records are still
stored under PokeAPI's own (singular) resource names.

Raw records can be large: a full Pokémon is about 250 KB, mostly its move
list, and all Pokémon together are about 177 MB. `/all` can therefore trim each
record inside SQLite (`PokeapiProjection`):

- `fields=id,name,sprites.front_default`: dotted paths to keep. Nesting and JSON types are preserved.
- `counts=moves`: replaces an array with `moves_count`.
- `english=flavor_text_entries`: reduces a localized array (also listed in `fields`) to its first
  English entry, instead of every language for every game version.

What each grid fetches this way: Pokémon 1.7 MB, items 1.6 MB, moves 0.9 MB, abilities 0.6 MB,
types 0.02 MB (uncompressed). The response is streamed in batches, so even an untrimmed request
(all Pokémon, about 177 MB) doesn't load everything into memory. `limit` must be at least 1.

Code: `backend/app/controllers/pokeapi_controller.rb`, `app/services/pokeapi_{importer,projection,client}.rb`,
`app/models/pokeapi_{record,sprite}.rb`, `lib/tasks/pokeapi.rake`.

## Frontend layout

```
frontend/src/
  app/page.tsx                 directory of grids
  app/(grids)/<path>/page.tsx  one static route per grid: /pokemon, /moves, /abilities, /items,
                               /types (singular URLs 308-redirect, next.config.ts); unknown paths 404
  app/error.tsx                recoverable error page
  components/GridPage.tsx      title + grid (skeleton while rows stream in)
  components/ResourceGrid.tsx  DataGrid, client pagination, toolbar + quick filter, URL state
  lib/api.ts                   server-only Rails client (one /all request per grid)
  resources/
    meta.ts                    slugs, plural paths, labels, descriptions
    index.ts                   slug → projection + row mapper (server)
    columns.ts                 slug → column defs (client)
    <slug>/mapper.ts           projection (fields/counts/english) + PokeAPI record → flat row
    <slug>/columns.tsx         GridColDef[] for that row
```

`RAILS_API_URL` (default `http://localhost:3001`) is used for server-side fetches at runtime,
and for the `/sprites` rewrite in `next.config.ts`, which is fixed at **build** time
(`next build` / `docker build`), so set it before building.

Each grid's rows are cached in memory for an hour (`"use cache"` in `resources/index.ts`), so page
views don't re-fetch and re-map every record. After a re-import, restart the front-end (or wait up to
an hour) to see new data. Unknown paths return a real 404, each grid has its own tab title, and
unexpected errors show a recoverable error page (`app/error.tsx`).

### Shareable links

Each grid's view is kept in the URL, so copying the address bar shares exactly what you see:

```
/moves?filter=type&op=equals&value=fire&sort=-power&page=2&pageSize=50&q=punch&hide=effect
```

| Param                   | Meaning                                                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `page`                  | 1-based page (omitted for page 1)                                                                                           |
| `pageSize`              | 25, 50 or 100 (omitted for 25)                                                                                              |
| `sort`                  | column field; `-` prefix for descending                                                                                     |
| `filter`, `op`, `value` | the filter: column, operator (`contains`, `equals`, `>=`, `isAnyOf`, `isEmpty`, …) and value (repeat `value` for `isAnyOf`) |
| `q`                     | quick search text                                                                                                           |
| `hide`                  | comma-separated hidden columns                                                                                              |

Defaults are left out, and unknown or invalid values are ignored and cleaned out of the URL.
That includes filter operators the column doesn't offer. The ID column can't be hidden. Following
a link to a grid (e.g. its nav-bar link) shows that link's view. Changes use `history.replaceState`,
so updating the URL never re-fetches the rows (`lib/gridUrlState.ts`, `components/ResourceGrid.tsx`).

### Adding a grid

1. Import the data: `bin/rails pokeapi:import RESOURCES=<slug>`. To also import its images, add the sprite's JSON path to `PokeapiImporter::SPRITE_PATHS`.
2. Add the slug to `RESOURCE_SLUGS` and `RESOURCE_META` (with its plural `path`) in `resources/meta.ts`,
   and a singular→plural redirect in `next.config.ts`.
3. Create `resources/<slug>/mapper.ts` (projection plus `toRow`) and `resources/<slug>/columns.tsx`.
4. Register them in `resources/index.ts` and `resources/columns.ts`.
5. Add its page, `app/(grids)/<path>/page.tsx` (copy an existing one and change the slug). A test
   fails if a grid in `meta.ts` has no page.

## Development

Node 24 (`.nvmrc`), Ruby 3.4 (`backend/.ruby-version`) and pnpm (`packageManager`) are pinned.

```sh
pnpm check         # everything CI runs: format check, lint, typecheck, tests
pnpm format        # Prettier (frontend, Markdown, JSON, YAML) + RuboCop autocorrect (backend)
pnpm lint          # RuboCop (rails-omakase) + ESLint (Next.js config)
pnpm typecheck
pnpm coverage      # both test suites with coverage (backend/coverage, frontend/coverage)
pnpm build         # production build of the frontend
```

CI (`.github/workflows/ci.yml`) runs these on every push to `main` and every pull request.
Editor basics are in `.editorconfig`.

## Tests

- **Backend** (`backend/test`, Minitest): models, services (upstream client, importer,
  projection), controllers and rake tasks. The network is disabled with WebMock, so tests never call
  PokeAPI. Coverage: `COVERAGE=1 bin/rails test` (SimpleCov, line + branch).
- **Frontend** (`frontend/src/**/*.test.ts(x)`, Vitest + Testing Library on jsdom): row mappers run
  against the backend's `fields`/`counts`/`english` projection (`test/fixtures.ts`), the API client,
  loaders, grid configuration (MIT limits) with the real DataGrid as well, URL state, components, the
  grid page and its routes, and `next.config.ts`. `pnpm --filter frontend test:watch` for watch mode.

Both suites are at 100% line and branch coverage, and it's enforced: a coverage run (`pnpm coverage`,
and CI) fails if either drops below 100%.
