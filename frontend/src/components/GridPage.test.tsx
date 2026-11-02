import { render, screen } from "@testing-library/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BackendError } from "@/lib/api";
import GridPage, { gridMetadata } from "./GridPage";

// Server-component tree, exercised by calling the async component directly.
const { loadRows, gridProps } = vi.hoisted(() => ({
  loadRows: vi.fn(),
  gridProps: [] as { slug: string; rows?: unknown[]; loading?: boolean }[],
}));

vi.mock("@/resources", () => ({ loadRows }));
vi.mock("next/server", () => ({ connection: vi.fn(async () => undefined) }));
vi.mock("@/components/ResourceGrid", () => ({
  default: (props: { slug: string; rows: unknown[] }) => {
    gridProps.push(props);
    return <div data-testid="grid">{`${props.rows.length} rows`}</div>;
  },
  LoadingGrid: (props: { slug: string }) => {
    gridProps.push({ ...props, loading: true });
    return <div data-testid="grid">skeleton</div>;
  },
}));

type El = ReactElement<{ children?: ReactNode; fallback?: ReactNode; slug?: string }>;

/** GridPage → [title, <Suspense fallback><GridData/></Suspense>]. */
function parts(slug: Parameters<typeof GridPage>[0]["slug"]) {
  const [title, suspense] = [(GridPage({ slug }) as El).props.children].flat() as El[];
  return { title, fallback: suspense.props.fallback, data: suspense.props.children as El };
}

async function content(slug: Parameters<typeof GridPage>[0]["slug"]) {
  const { data } = parts(slug);
  expect(isValidElement(data)).toBe(true);
  return (data.type as (props: unknown) => Promise<ReactNode>)(data.props);
}

beforeEach(() => {
  loadRows.mockReset();
  gridProps.length = 0;
});

describe("GridPage", () => {
  it("shows the title over the grid's skeleton while rows load (no spinner)", () => {
    const { title, fallback } = parts("move");

    render(
      <>
        {title}
        {fallback}
      </>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Moves" })).toBeInTheDocument();
    expect(screen.getByTestId("grid")).toHaveTextContent("skeleton");
    expect(gridProps[0]).toEqual({ slug: "move", loading: true });
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("loads the resource's rows and renders its grid", async () => {
    const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
    loadRows.mockResolvedValue(rows);

    render(<>{await content("ability")}</>);

    expect(loadRows).toHaveBeenCalledWith("ability");
    expect(screen.getByTestId("grid")).toHaveTextContent("3 rows");
    expect(gridProps.at(-1)).toEqual({ slug: "ability", rows });
  });

  it("shows the backend's error message instead of the grid", async () => {
    loadRows.mockRejectedValue(new BackendError("No items data imported. Run: bin/rails pokeapi:import", 404));

    render(<>{await content("item")}</>);

    expect(screen.getByRole("alert")).toHaveTextContent("No items data imported");
    expect(screen.queryByTestId("grid")).not.toBeInTheDocument();
  });

  it("rethrows unexpected errors to the app's error boundary (app/error.tsx)", async () => {
    loadRows.mockRejectedValue(new TypeError("boom"));
    await expect(content("type")).rejects.toThrow("boom");
  });

  it("titles each grid page", () => {
    expect(gridMetadata("move")).toEqual({ title: "Moves" });
  });
});
