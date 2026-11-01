import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";

import NavBar from "@/components/NavBar";
import Providers from "@/components/Providers";
import RootLayout, { metadata } from "./layout";

type El = ReactElement<{ children?: React.ReactNode; lang?: string; component?: string; sx?: object }>;
const kids = (el: El) => [el.props.children].flat() as El[];

describe("RootLayout", () => {
  const html = RootLayout({ children: <p>page</p> } as never) as El;
  const body = kids(html)[0];
  const providers = kids(body)[0];
  const [nav, main] = kids(providers).filter(Boolean);

  it("renders an English document", () => {
    expect(html.type).toBe("html");
    expect(html.props.lang).toBe("en");
    expect(body.type).toBe("body");
  });

  it("wraps the page in the MUI providers, under the nav bar, inside a flex-growing <main>", () => {
    expect(providers.type).toBe(Providers);
    expect(nav.type).toBe(NavBar);
    expect(main.props.component).toBe("main");
    expect(main.props.sx).toMatchObject({ flex: 1, display: "flex", flexDirection: "column" });
    expect(kids(main).some((c) => c && (c as El).type === "p")).toBe(true);
  });

  it("sets the page title", () => {
    expect(metadata.title).toBe("PokeAPI Grids");
  });
});
