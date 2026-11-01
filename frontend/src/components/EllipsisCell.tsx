"use client";

import Tooltip from "@mui/material/Tooltip";
import { useState } from "react";

/**
 * Single-line cell text: never wraps (so rows never grow), ends in an ellipsis
 * when it doesn't fit, and shows the full text in a tooltip only when truncated.
 */
export default function EllipsisCell({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip title={text} open={open} onClose={() => setOpen(false)} disableInteractive>
      <span
        onMouseEnter={(e) => {
          const el = e.currentTarget;
          if (el.scrollWidth > el.clientWidth) setOpen(true);
        }}
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
