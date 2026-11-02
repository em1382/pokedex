import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import EllipsisCell from "./EllipsisCell";

// jsdom has no layout, so fake whether the text overflows its cell.
function overflow(truncated: boolean) {
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(truncated ? 300 : 100);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(100);
}

const TEXT = "Has a 10% chance to burn the target.";

describe("EllipsisCell", () => {
  it("renders the text on one line with an ellipsis", () => {
    render(<EllipsisCell text={TEXT} />);
    expect(screen.getByText(TEXT)).toHaveStyle({
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    });
  });

  it("shows the full text in a tooltip when it is truncated", async () => {
    overflow(true);
    render(<EllipsisCell text={TEXT} />);

    await userEvent.hover(screen.getByText(TEXT));

    expect(await screen.findByRole("tooltip")).toHaveTextContent(TEXT);
  });

  it("shows no tooltip when the text fits", async () => {
    overflow(false);
    render(<EllipsisCell text={TEXT} />);

    await userEvent.hover(screen.getByText(TEXT));

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("opens for keyboard users when the grid cell gets focus, and closes on blur", async () => {
    overflow(true);
    render(
      <div role="gridcell" tabIndex={0} data-testid="cell">
        <EllipsisCell text={TEXT} />
      </div>,
    );

    screen.getByTestId("cell").focus();
    expect(await screen.findByRole("tooltip")).toHaveTextContent(TEXT);

    screen.getByTestId("cell").blur();
    await vi.waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
  });

  it("stays closed on focus when the text fits", async () => {
    overflow(false);
    render(
      <div role="gridcell" tabIndex={0} data-testid="cell">
        <EllipsisCell text={TEXT} />
      </div>,
    );

    screen.getByTestId("cell").focus();

    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("hides the tooltip again when the pointer leaves", async () => {
    overflow(true);
    render(<EllipsisCell text={TEXT} />);
    const cell = screen.getByText(TEXT);

    await userEvent.hover(cell);
    await screen.findByRole("tooltip");
    await userEvent.unhover(cell);

    await vi.waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
  });
});
