"use client";

import Box from "@mui/material/Box";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { ROW_HEIGHT, withEllipsis } from "@/components/gridHelpers";
import {
  parseGridState,
  serializeGridState,
  type GridUrlOptions,
  type GridUrlState,
} from "@/lib/gridUrlState";
import { COLUMNS } from "@/resources/columns";
import type { ResourceSlug } from "@/resources/meta";

/** MIT DataGrid caps page size at 100. */
const PAGE_SIZE_OPTIONS = [25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;

const DEFAULT_VIEW: GridUrlState = {
  paginationModel: { page: 0, pageSize: DEFAULT_PAGE_SIZE },
  sortModel: [],
  filterModel: { items: [] },
  columnVisibilityModel: {},
};

const MAX_PENDING = 10;

interface UrlSync {
  view: GridUrlState;
  /** Last query string seen from useSearchParams. */
  seen: string;
  /** Queries written with replaceState that Next hasn't reflected back yet. */
  pending: string[];
}

/** Start from a URL's query: its view, plus the normalized query we'll write if it differs. */
function fromUrl(search: string, options: GridUrlOptions): UrlSync {
  const view = parseGridState(new URLSearchParams(search), options);
  const normalized = serializeGridState(view, options);
  return { view, seen: search, pending: normalized === search ? [] : [normalized] };
}

/** The only column the toolbar's quick search looks at. */
const SEARCH_FIELD = "name";

/**
 * Display columns: ellipsis cells, the ID column always visible, and quick
 * search limited to the name (returning null skips a column).
 */
function useColumns(slug: ResourceSlug): GridColDef[] {
  return useMemo(
    () =>
      withEllipsis(COLUMNS[slug]).map((c) => ({
        ...c,
        ...(c.field === "id" && { hideable: false }),
        ...(c.field !== SEARCH_FIELD && { getApplyQuickFilterFn: () => null }),
      })),
    [slug],
  );
}

/**
 * Every row is already in memory, so pagination, sorting and filtering all
 * happen client-side — no requests on page change. The view (page, sort,
 * filter, quick search, hidden columns) lives in the URL so it can be shared.
 */
export default function ResourceGrid({
  slug,
  rows,
}: {
  slug: ResourceSlug;
  rows: { id: number }[];
}) {
  const columns = useColumns(slug);
  const urlOptions: GridUrlOptions = useMemo(
    () => ({ columns, pageSizeOptions: PAGE_SIZE_OPTIONS, defaultPageSize: DEFAULT_PAGE_SIZE }),
    [columns],
  );
  const search = useSearchParams().toString();
  const query = (view: GridUrlState) => serializeGridState(view, urlOptions);

  // The view, the last query string seen from Next, and the queries we've
  // written with replaceState but not yet seen come back through useSearchParams.
  const [sync, setSync] = useState<UrlSync>(() => fromUrl(search, urlOptions));

  if (search !== sync.seen) {
    const own = sync.pending.indexOf(search);
    // One of our own writes arriving: keep the view, drop it (and older writes).
    // Anything else is a navigation (a link to this grid, a shared link): adopt it.
    setSync(
      own >= 0
        ? { ...sync, seen: search, pending: sync.pending.slice(own + 1) }
        : fromUrl(search, urlOptions),
    );
  }

  const changeView = (patch: Partial<GridUrlState>) =>
    setSync((s) => {
      const view = { ...s.view, ...patch };
      const q = query(view);
      return {
        ...s,
        view,
        pending: q === s.seen ? s.pending : [...s.pending, q].slice(-MAX_PENDING),
      };
    });

  // Mirror the view into the URL. replaceState (not router.replace) so the
  // server isn't asked to re-render — and re-send every row — on each change;
  // Next.js keeps useSearchParams in sync with it.
  const current = query(sync.view);
  useEffect(() => {
    const url = current ? `${window.location.pathname}?${current}` : window.location.pathname;
    if (url !== window.location.pathname + window.location.search) {
      window.history.replaceState(null, "", url);
    }
  }, [current]);

  return <GridFrame columns={columns} rows={rows} view={sync.view} onViewChange={changeView} />;
}

const noSubscribe = () => () => {};

/**
 * The grid with its loading skeleton, used while rows stream in (no URL state).
 * It's part of the prerendered page shell, where DataGrid can't run (it reads
 * Math.random() while rendering, and renders nothing server-side anyway), so the
 * shell gets a same-sized placeholder and the skeleton appears once in the browser.
 */
export function LoadingGrid({ slug }: { slug: ResourceSlug }) {
  const columns = useColumns(slug);
  const inBrowser = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  if (!inBrowser) return <GridArea sx={{ border: 1, borderColor: "divider", borderRadius: 1 }} />;
  return <GridFrame columns={columns} rows={[]} view={DEFAULT_VIEW} loading />;
}

/** The space a grid takes: whatever height <main> has left (flex-basis 0, so content
 * never pushes the page into scrolling); 377px floor ≈ toolbar + header + footer + 4 rows. */
function GridArea({ children, sx }: { children?: React.ReactNode; sx?: object }) {
  return <Box sx={{ flex: "1 1 0", minHeight: 377, width: "100%", ...sx }}>{children}</Box>;
}

interface FrameProps {
  columns: GridColDef[];
  rows: { id: number }[];
  view: GridUrlState;
  onViewChange?: (patch: Partial<GridUrlState>) => void;
  loading?: boolean;
}

function GridFrame({ columns, rows, view, onViewChange, loading = false }: FrameProps) {
  return (
    <GridArea>
      <DataGrid
        rows={rows}
        columns={columns}
        pagination
        paginationMode="client"
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        paginationModel={view.paginationModel}
        onPaginationModelChange={(paginationModel) => onViewChange?.({ paginationModel })}
        sortModel={view.sortModel}
        onSortModelChange={(sortModel) => onViewChange?.({ sortModel })}
        filterModel={view.filterModel}
        onFilterModelChange={(filterModel) => onViewChange?.({ filterModel })}
        columnVisibilityModel={view.columnVisibilityModel}
        onColumnVisibilityModelChange={(columnVisibilityModel) =>
          onViewChange?.({ columnVisibilityModel })
        }
        showToolbar
        loading={loading}
        slotProps={{
          loadingOverlay: { variant: "skeleton", noRowsVariant: "skeleton" },
          toolbar: {
            // No export menu. (Print export would also switch the grid to one page
            // of *all* rows, which throws on the MIT DataGrid past 100 rows.)
            csvOptions: { disableToolbarButton: true },
            printOptions: { disableToolbarButton: true },
          },
        }}
        localeText={{
          toolbarQuickFilterPlaceholder: "Search names…",
          toolbarQuickFilterLabel: "Search names",
        }}
        disableRowSelectionOnClick
        rowHeight={ROW_HEIGHT}
      />
    </GridArea>
  );
}
