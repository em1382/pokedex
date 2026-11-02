"use client";

import Box from "@mui/material/Box";
import { DataGrid } from "@mui/x-data-grid";
import { useEffect, useMemo, useState } from "react";

import { ROW_HEIGHT, withEllipsis } from "@/components/gridHelpers";
import { parseGridState, serializeGridState, type GridUrlOptions } from "@/lib/gridUrlState";
import { COLUMNS } from "@/resources/columns";
import type { ResourceSlug } from "@/resources/meta";

/** MIT DataGrid caps page size at 100. */
export const PAGE_SIZE_OPTIONS = [25, 50, 100];
export const DEFAULT_PAGE_SIZE = 25;

interface Props {
  slug: ResourceSlug;
  rows: { id: number }[];
  /** The page's query string; the grid's view (page, sort, filter…) starts from it. */
  query?: string;
  /** Show DataGrid's built-in skeleton overlay (used as the Suspense fallback). */
  loading?: boolean;
}

/**
 * Every row is already in memory, so pagination, sorting and filtering all
 * happen client-side (the grid's default "client" modes) — no requests on
 * page change. The view is mirrored into the URL so it can be shared as a link.
 */
export default function ResourceGrid({ slug, rows, query = "", loading = false }: Props) {
  const columns = useMemo(() => withEllipsis(COLUMNS[slug]), [slug]);
  const urlOptions: GridUrlOptions = useMemo(
    () => ({ columns, pageSizeOptions: PAGE_SIZE_OPTIONS, defaultPageSize: DEFAULT_PAGE_SIZE }),
    [columns],
  );

  const [initial] = useState(() => parseGridState(new URLSearchParams(query), urlOptions));
  const [paginationModel, setPaginationModel] = useState(initial.paginationModel);
  const [sortModel, setSortModel] = useState(initial.sortModel);
  const [filterModel, setFilterModel] = useState(initial.filterModel);
  const [columnVisibilityModel, setColumnVisibilityModel] = useState(initial.columnVisibilityModel);

  // Keep the URL in step with the view. replaceState (not router.replace) so the
  // server isn't asked to re-render — and re-send every row — on each change;
  // Next.js keeps usePathname/useSearchParams in sync with it.
  useEffect(() => {
    if (loading) return;
    const search = serializeGridState(
      { paginationModel, sortModel, filterModel, columnVisibilityModel },
      urlOptions,
    );
    const url = search ? `${window.location.pathname}?${search}` : window.location.pathname;
    if (url !== window.location.pathname + window.location.search) {
      window.history.replaceState(null, "", url);
    }
  }, [loading, paginationModel, sortModel, filterModel, columnVisibilityModel, urlOptions]);

  return (
    // Fill whatever height <main> has left (flex-basis 0, so content never pushes
    // the page into scrolling); 377px floor ≈ toolbar + header + footer + 4 rows.
    <Box sx={{ flex: "1 1 0", minHeight: 377, width: "100%" }}>
      <DataGrid
        rows={rows}
        columns={columns}
        pagination
        paginationMode="client"
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        sortModel={sortModel}
        onSortModelChange={setSortModel}
        filterModel={filterModel}
        onFilterModelChange={setFilterModel}
        columnVisibilityModel={columnVisibilityModel}
        onColumnVisibilityModelChange={setColumnVisibilityModel}
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
        disableRowSelectionOnClick
        rowHeight={ROW_HEIGHT}
      />
    </Box>
  );
}
