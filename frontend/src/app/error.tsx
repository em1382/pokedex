"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "next/link";
import { useEffect } from "react";

import { fib } from "@/theme/spacing";

/**
 * Catches unexpected render errors in any page, so the app stays usable.
 * (Next 16: `retry` re-fetches and re-renders the page; `error` may be any value.)
 */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: fib(13) }}>
      <Alert severity="error">Something went wrong showing this page.</Alert>
      <Box sx={{ display: "flex", gap: fib(8) }}>
        <Button variant="contained" onClick={() => retry()}>
          Try again
        </Button>
        <Button component={Link} href="/" variant="outlined">
          Back to the directory
        </Button>
      </Box>
    </Box>
  );
}
