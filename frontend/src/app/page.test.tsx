import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import "../../test/next-mocks";
import { RESOURCE_META, RESOURCE_SLUGS } from "@/resources/meta";
import Home from "./page";

describe("Home (resource directory)", () => {
  it("has a heading", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1, name: "Resource directory" })).toBeInTheDocument();
  });

  it("shows a card per grid, linking to its plural path", () => {
    render(<Home />);
    for (const slug of RESOURCE_SLUGS) {
      const meta = RESOURCE_META[slug];
      const card = screen.getByRole("link", { name: new RegExp(`^${meta.label}`) });
      expect(card).toHaveAttribute("href", `/${meta.path}`);
      expect(card).toHaveTextContent(meta.description);
      expect(card).toHaveTextContent(`/api/${meta.path}`);
    }
  });
});
