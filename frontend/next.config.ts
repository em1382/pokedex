import path from "node:path";

import type { NextConfig } from "next";

const RAILS_API_URL = process.env.RAILS_API_URL ?? "http://localhost:3001";

// Grid pages live at plural paths; old singular URLs redirect permanently.
// ("pokemon" is its own plural, so it needs no redirect.)
const SINGULAR_TO_PLURAL: Record<string, string> = {
  move: "moves",
  ability: "abilities",
  item: "items",
  type: "types",
};

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Self-contained server for the Docker image (.next/standalone). Traced from
  // the monorepo root because pnpm keeps the real packages there.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, ".."),
  async redirects() {
    return Object.entries(SINGULAR_TO_PLURAL).map(([singular, plural]) => ({
      source: `/${singular}`,
      destination: `/${plural}`,
      permanent: true,
    }));
  },
  // Sprite images are stored in the backend's SQLite DB; proxy them so the
  // browser can load them from this origin (works offline).
  async rewrites() {
    return [{ source: "/sprites/:path*", destination: `${RAILS_API_URL}/sprites/:path*` }];
  },
};

export default nextConfig;
