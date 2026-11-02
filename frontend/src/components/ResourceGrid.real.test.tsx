import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ResourceGrid from "./ResourceGrid";

// The real MIT DataGrid (no mock): a link with a filter operator the column
// doesn't offer used to make the grid throw while rendering.
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const rows = [
  { id: 1, name: "pound", type: "normal", power: 40 },
  { id: 2, name: "ember", type: "fire", power: 40 },
];

describe("ResourceGrid with the real DataGrid", () => {
  it.each([
    "filter=power&op=contains&value=5", // string operator on a number column
    "filter=name&op=%3E&value=5", // number operator on a string column
    "filter=name&op=is&value=true", // boolean operator on a string column
  ])("renders instead of throwing for %s", (search) => {
    window.history.replaceState(null, "", `/moves?${search}`);

    expect(() => render(<ResourceGrid slug="move" rows={rows as never} />)).not.toThrow();
    expect(screen.getByRole("grid")).toBeInTheDocument();
    expect(window.location.search).toBe(""); // the bad filter is dropped from the URL too
  });
});
