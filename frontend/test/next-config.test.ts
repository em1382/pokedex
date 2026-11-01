import { describe, expect, it } from "vitest";

import { RESOURCE_META, RESOURCE_SLUGS } from "@/resources/meta";
import nextConfig from "../next.config";

describe("next.config", () => {
  it("redirects each old singular URL to its plural page, permanently", async () => {
    const redirects = await nextConfig.redirects!();
    const expected = RESOURCE_SLUGS.filter((s) => RESOURCE_META[s].path !== s).map((s) => ({
      source: `/${s}`,
      destination: `/${RESOURCE_META[s].path}`,
      permanent: true,
    }));
    expect(redirects).toEqual(expected);
  });

  it("does not redirect /pokemon (its own plural)", async () => {
    const redirects = await nextConfig.redirects!();
    expect(redirects.find((r) => r.source === "/pokemon")).toBeUndefined();
  });

  it("proxies /sprites to the Rails backend", async () => {
    const rewrites = await nextConfig.rewrites!();
    expect(rewrites).toEqual([
      { source: "/sprites/:path*", destination: "http://localhost:3001/sprites/:path*" },
    ]);
  });

  it("keeps Cache Components on (the grid pages rely on Suspense streaming)", () => {
    expect(nextConfig.cacheComponents).toBe(true);
  });
});
