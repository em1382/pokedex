import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { pathname } from "../../test/next-mocks";
import NavBar from "./NavBar";

const PAGES = [
  ["Pokémon", "/pokemon"],
  ["Moves", "/moves"],
  ["Abilities", "/abilities"],
  ["Items", "/items"],
  ["Types", "/types"],
] as const;

const header = () => screen.getByRole("banner");
const drawer = () => screen.getByRole("presentation");

describe("NavBar", () => {
  beforeEach(() => {
    pathname.current = "/moves";
  });

  it("links the title to the directory", () => {
    render(<NavBar />);
    expect(within(header()).getByRole("link", { name: "PokeAPI Grids" })).toHaveAttribute("href", "/");
  });

  it("links every grid at its plural path", () => {
    render(<NavBar />);
    for (const [label, href] of PAGES) {
      expect(within(header()).getByRole("link", { name: label })).toHaveAttribute("href", href);
    }
  });

  it("marks the current page", () => {
    render(<NavBar />);
    expect(within(header()).getByRole("link", { name: "Moves" })).toHaveAttribute("aria-current", "page");
    expect(within(header()).getByRole("link", { name: "Items" })).not.toHaveAttribute("aria-current");
  });

  it("opens a drawer with every grid from the hamburger button", async () => {
    render(<NavBar />);
    const button = screen.getByRole("button", { name: "Open navigation" });
    expect(button).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(button);

    expect(button).toHaveAttribute("aria-expanded", "true");
    for (const [label, href] of PAGES) {
      expect(within(drawer()).getByRole("link", { name: label })).toHaveAttribute("href", href);
    }
    expect(within(drawer()).getByRole("link", { name: "Moves" })).toHaveClass("Mui-selected");
  });

  it("closes the drawer after picking a page", async () => {
    render(<NavBar />);
    await userEvent.click(screen.getByRole("button", { name: "Open navigation" }));

    await userEvent.click(within(drawer()).getByRole("link", { name: "Items" }));

    await waitFor(() => expect(screen.queryByRole("presentation")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Open navigation" })).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the drawer on Escape", async () => {
    render(<NavBar />);
    await userEvent.click(screen.getByRole("button", { name: "Open navigation" }));

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("presentation")).not.toBeInTheDocument());
  });
});
