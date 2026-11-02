import { render, screen } from "@testing-library/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BackendError } from "@/lib/api";
import ResourcePage from "./page";

// Server-component tree, exercised by calling each async component directly.
const { loadRows, gridProps } = vi.hoisted(() => ({
  loadRows: vi.fn(),
  gridProps: [] as { slug: string; rows: unknown[]; loading?: boolean; query?: string }[],
}));

vi.mock("@/resources", () => ({ loadRows }));
vi.mock("next/server", () => ({ connection: vi.fn(async () => undefined) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/components/ResourceGrid", () => ({
  default: (props: { slug: string; rows: unknown[]; loading?: boolean; query?: string }) => {
    gridProps.push(props);
    return <div data-testid="grid">{props.loading ? "skeleton" : `${props.rows.length} rows`}</div>;
  },
}));

type El = ReactElement<{ children?: ReactNode; fallback?: ReactNode; [k: string]: unknown }>;
type AsyncComponent = (props: unknown) => Promise<ReactNode>;

/** Unwrap <Suspense><Child/></Suspense>: returns the fallback and the awaited child output. */
async function unwrap(suspense: El) {
  const child = suspense.props.children as El;
  expect(isValidElement(child)).toBe(true);
  return { fallback: suspense.props.fallback, child: (await (child.type as AsyncComponent)(child.props)) as El };
}

async function renderPage(path: string, search: Record<string, string | string[] | undefined> = {}) {
  const page = ResourcePage({
    params: Promise.resolve({ resources: path }),
    searchParams: Promise.resolve(search),
  } as never) as El;
  const outer = await unwrap(page); // awaits params → inner Suspense
  const inner = await unwrap(outer.child); // awaits rows → title + grid/alert
  return { outerFallback: outer.fallback, innerFallback: inner.fallback, content: inner.child };
}

beforeEach(() => {
  loadRows.mockReset();
  gridProps.length = 0;
});

describe("grid page", () => {
  it("renders nothing until the route params resolve", async () => {
    loadRows.mockResolvedValue([]);
    expect((await renderPage("moves")).outerFallback).toBeNull();
  });

  it("shows the title over a skeleton grid while rows load", async () => {
    loadRows.mockResolvedValue([]);
    const { innerFallback } = await renderPage("moves");

    render(<>{innerFallback}</>);

    expect(screen.getByRole("heading", { level: 1, name: "Moves" })).toBeInTheDocument();
    expect(screen.getByTestId("grid")).toHaveTextContent("skeleton");
    expect(gridProps[0]).toEqual({ slug: "move", rows: [], loading: true });
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument(); // no spinner
  });

  it("loads the resource for the plural path and renders its grid", async () => {
    const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
    loadRows.mockResolvedValue(rows);
    const { content } = await renderPage("abilities");

    render(<>{content}</>);

    expect(loadRows).toHaveBeenCalledWith("ability");
    expect(screen.getByRole("heading", { level: 1, name: "Abilities" })).toBeInTheDocument();
    expect(screen.getByTestId("grid")).toHaveTextContent("3 rows");
    expect(gridProps.at(-1)).toMatchObject({ slug: "ability", rows, query: "" });
  });

  it("hands the grid the shared view from the query string (repeated keys kept)", async () => {
    loadRows.mockResolvedValue([{ id: 1 }]);
    const { content } = await renderPage("moves", { filter: "power", op: "isAnyOf", value: ["40", "90"], page: "2", unset: undefined });

    render(<>{content}</>);

    expect(gridProps.at(-1)?.query).toBe("filter=power&op=isAnyOf&value=40&value=90&page=2");
    const grid = (content.props.children as El[]).find((c) => isValidElement(c) && c.key !== null) as El;
    expect(grid.key).toBe("filter=power&op=isAnyOf&value=40&value=90&page=2");
  });

  it("shows the backend's error message instead of the grid", async () => {
    loadRows.mockRejectedValue(new BackendError("No items data imported. Run: bin/rails pokeapi:import", 404));
    const { content } = await renderPage("items");

    render(<>{content}</>);

    expect(screen.getByRole("heading", { level: 1, name: "Items" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("No items data imported");
    expect(screen.queryByTestId("grid")).not.toBeInTheDocument();
  });

  it("rethrows unexpected errors (handled by Next's error boundary)", async () => {
    loadRows.mockRejectedValue(new TypeError("boom"));
    await expect(renderPage("types")).rejects.toThrow("boom");
  });

  it.each(["move", "pokemons", "berries"])("404s for %s", async (path) => {
    await expect(renderPage(path)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(loadRows).not.toHaveBeenCalled();
  });
});
