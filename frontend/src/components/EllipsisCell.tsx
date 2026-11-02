"use client";

import Tooltip from "@mui/material/Tooltip";
import { useEffect, useRef, useState } from "react";

/**
 * Single-line cell text: never wraps (so rows never grow), ends in an ellipsis
 * when it doesn't fit, and shows the full text in a tooltip only when truncated.
 * The tooltip opens on hover, long-press (touch) and keyboard focus of the cell.
 */
export default function EllipsisCell({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const truncated = () => {
    const el = ref.current;
    return !!el && el.scrollWidth > el.clientWidth;
  };

  // DataGrid's keyboard navigation focuses the cell, not this span.
  useEffect(() => {
    const cell = ref.current?.closest<HTMLElement>('[role="gridcell"]');
    if (!cell) return;
    const show = () => truncated() && setOpen(true);
    const hide = () => setOpen(false);
    cell.addEventListener("focus", show);
    cell.addEventListener("blur", hide);
    return () => {
      cell.removeEventListener("focus", show);
      cell.removeEventListener("blur", hide);
    };
  }, []);

  return (
    <Tooltip
      title={text}
      open={open}
      onOpen={() => truncated() && setOpen(true)}
      onClose={() => setOpen(false)}
      disableInteractive
    >
      <span
        ref={ref}
        style={{
          display: "block",
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </span>
    </Tooltip>
  );
}
