# mass-datagrid-port

PokeAPI data in MUI data grids, served from our own backend. After the data
has been imported once, everything works offline.

| Dir         | What                                                                        | Port |
|-------------|-----------------------------------------------------------------------------|------|
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

You need Ruby 3.2+ (with `ruby-dev` headers), Node 20+ and pnpm.

```sh
export PATH="$HOME/.local/share/gem/ruby/3.2.0/bin:$PATH"   # if gems are user-installed
pnpm bootstrap      # pnpm install, bundle install, create the SQLite DB
pnpm import         # one-time download into SQLite (needs network)
pnpm dev            # Rails on :3001 and Next on :3000
```

Open http://localhost:3000.

## Importing data (`bin/rails pokeapi:import`)

```sh
pnpm import                                              # pokemon, move, ability, item, type + sprites
cd backend && bin/rails pokeapi:import RESOURCES=berries # any PokeAPI v2 resource (plural or PokeAPI name)
bin/rails pokeapi:import SPRITES=0 FORCE=1 DELAY=0.1     # skip images, refresh records, slower
pnpm import:status                                       # row counts per resource
```

The import fetches the resource list, then every detail record. Each record is
stored verbatim as JSON in `pokeapi_records`, with one row per
`(resource, pokeapi_id)`. Records are keyed by id because names are not always
unique: the item list has two entries named `roseli-berry`. After the records,
it downloads the sprite each grid shows into `pokeapi_sprites`.

It follows PokeAPI's [fair use policy](https://pokeapi.co/docs/v2#fairuse):

- Records already in SQLite are skipped, so re-running the import is cheap.
- Upstream requests run one at a time, 50 ms apart (`DELAY`), and send a descriptive `User-Agent`.
- Every PokeAPI response is also cached in `backend/storage/pokeapi_cache`. A `FORCE=1` re-import reads from that cache instead of calling PokeAPI again (30-day TTL). You can delete the folder once the import is done.

To use the app on another machine with no network, copy
`backend/storage/development.sqlite3`.

## Rails API

| Route                                       | Returns                                                             |
|---------------------------------------------|---------------------------------------------------------------------|
| `GET /api/:resources?limit=&offset=`        | PokeAPI-style paginated list (`count`, `next`, `previous`, `results`) |
| `GET /api/:resources/:id_or_name`           | The stored PokeAPI record, verbatim                                 |
| `GET /api/:resources/all?fields=&counts=`   | Every record in one JSON array, ordered by id, optionally trimmed   |
| `GET /sprites/*path`                        | Sprite image (same path as under `PokeAPI/sprites/master/sprites/`) |

Collection paths are plural (`/api/moves`, `/api/abilities`, `/api/pokemon-species`); "pokemon"
is its own plural (`/api/pokemon`). Singular paths return 404 with a hint. Records are still
stored under PokeAPI's own (singular) resource names.

Raw records can be large: a full Pokémon is about 250 KB, mostly its move
list, and all Pokémon together are about 177 MB. `/all` can therefore trim each
record inside SQLite (`PokeapiProjection`):

- `fields=id,name,sprites.front_default`: dotted paths to keep. Nesting and JSON types are preserved.
- `counts=moves`: replaces an array with `moves_count`.

The Pokémon grid fetches about 420 KB this way.

Code: `backend/app/controllers/pokeapi_controller.rb`, `app/services/pokeapi_{importer,projection,client}.rb`,
`app/models/pokeapi_{record,sprite}.rb`, `lib/tasks/pokeapi.rake`.

## Frontend layout

```
frontend/src/
  app/page.tsx                 directory of grids
  app/[resources]/page.tsx     one grid page per resource at its plural path: /pokemon, /moves,
                               /abilities, /items, /types (singular URLs 308-redirect, next.config.ts)
  components/ResourceGrid.tsx  DataGrid, client pagination, toolbar + quick filter
  lib/api.ts                   server-only Rails client (one /all request per grid)
  resources/
    meta.ts                    slugs, plural paths, labels, descriptions
    index.ts                   slug → projection + row mapper (server)
    columns.ts                 slug → column defs (client)
    <slug>/mapper.ts           projection (fields/counts) + PokeAPI record → flat row
    <slug>/columns.tsx         GridColDef[] for that row
```

`RAILS_API_URL` (default `http://localhost:3001`) is used for server-side fetches
and for the `/sprites` rewrite in `next.config.ts`.

### Adding a grid

1. Import the data: `bin/rails pokeapi:import RESOURCES=<slug>`. To also import its images, add the sprite's JSON path to `PokeapiImporter::SPRITE_PATHS`.
2. Add the slug to `RESOURCE_SLUGS` and `RESOURCE_META` (with its plural `path`) in `resources/meta.ts`,
   and a singular→plural redirect in `next.config.ts`.
3. Create `resources/<slug>/mapper.ts` (projection plus `toRow`) and `resources/<slug>/columns.tsx`.
4. Register them in `resources/index.ts` and `resources/columns.ts`.

## Tests

```sh
pnpm test        # Rails tests (network disabled via WebMock) + frontend lint + typecheck
pnpm build       # production build of the frontend
```
