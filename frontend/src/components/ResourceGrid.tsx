"use client";

import Box from "@mui/material/Box";
import { DataGrid } from "@mui/x-data-grid";
import { useMemo } from "react";

import { ROW_HEIGHT, withEllipsis } from "@/components/gridHelpers";
import { COLUMNS } from "@/resources/columns";
import type { ResourceSlug } from "@/resources/meta";

interface Props {
  slug: ResourceSlug;
  rows: { id: number }[];
  /** Show DataGrid's built-in skeleton overlay (used as the Suspense fallback). */
  loading?: boolean;
}

/**
 * Every row is already in memory, so pagination, sorting and filtering all
 * happen client-side (the grid's default "client" modes) — no requests on
 * page change.
 */
export default function ResourceGrid({ slug, rows, loading = false }: Props) {
  const columns = useMemo(() => withEllipsis(COLUMNS[slug]), [slug]);
  return (
    // Fill whatever height <main> has left (flex-basis 0, so content never pushes
    // the page into scrolling); 377px floor ≈ toolbar + header + footer + 4 rows.
    <Box sx={{ flex: "1 1 0", minHeight: 377, width: "100%" }}>
      <DataGrid
        rows={rows}
        columns={columns}
        pagination
        paginationMode="client"
        pageSizeOptions={[25, 50, 100]}
        initialState={{ pagination: { paginationModel: { page: 0, pageSize: 25 } } }}
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
