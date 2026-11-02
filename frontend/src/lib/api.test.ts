import { afterEach, describe, expect, it, vi } from "vitest";

import { BackendError, getResourceRows } from "./api";

function mockFetch(response: Partial<Response> | Error) {
  const fn = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response as Response;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

afterEach(() => vi.unstubAllGlobals());

describe("getResourceRows", () => {
  it("requests /api/<path>/all with the projection and maps every record", async () => {
    const fetch = mockFetch(ok([{ id: 1, name: "a" }, { id: 2, name: "b" }]));

    const rows = await getResourceRows(
      "moves",
      { fields: ["id", "name", "sprites.default"], counts: ["learned_by_pokemon"] },
      (d: { id: number; name: string }) => `${d.id}:${d.name}`,
    );

    expect(rows).toEqual(["1:a", "2:b"]);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe("http://localhost:3001/api/moves/all");
    expect(parsed.searchParams.get("fields")).toBe("id,name,sprites.default");
    expect(parsed.searchParams.get("counts")).toBe("learned_by_pokemon");
    expect(init).toEqual({ cache: "no-store" });
  });

  it("asks for English-only localized arrays", async () => {
    const fetch = mockFetch(ok([]));
    await getResourceRows("items", { fields: ["id", "effect_entries"], english: ["effect_entries"] }, (d) => d);
    expect(new URL((fetch.mock.calls[0] as unknown as [string])[0]).searchParams.get("english")).toBe("effect_entries");
  });

  it("omits counts when the projection has none", async () => {
    const fetch = mockFetch(ok([]));
    await getResourceRows("types", { fields: ["id"] }, (d) => d);
    expect(new URL((fetch.mock.calls[0] as unknown as [string])[0]).searchParams.has("counts")).toBe(false);
  });

  it("surfaces the backend's error message and status", async () => {
    mockFetch({
      ok: false,
      status: 404,
      json: async () => ({ error: "No berries data imported. Run: bin/rails pokeapi:import RESOURCES=berries" }),
    });

    const err = await getResourceRows("berries", { fields: ["id"] }, (d) => d).catch((e) => e);
    expect(err).toBeInstanceOf(BackendError);
    expect(err.message).toMatch("pokeapi:import RESOURCES=berries");
    expect(err.status).toBe(404);
  });

  it("falls back to a generic message when the error body isn't JSON", async () => {
    mockFetch({ ok: false, status: 502, json: async () => Promise.reject(new SyntaxError("bad json")) });

    const err = await getResourceRows("moves", { fields: ["id"] }, (d) => d).catch((e) => e);
    expect(err).toBeInstanceOf(BackendError);
    expect(err.message).toBe("Rails API 502 for /api/moves/all?fields=id");
    expect(err.status).toBe(502);
  });

  it("shows a generic message when the backend is unreachable, logging the details server-side", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetch(new TypeError("fetch failed"));

    const err = await getResourceRows("moves", { fields: ["id"] }, (d) => d).catch((e) => e);

    expect(err).toBeInstanceOf(BackendError);
    expect(err.message).toBe("The data service is unavailable right now. Please try again shortly.");
    expect(err.message).not.toContain("localhost");
    expect(err.status).toBeUndefined();
    expect(String(log.mock.calls[0][0])).toContain("http://localhost:3001/api/moves/all");
  });
});
