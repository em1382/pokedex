import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";

import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";

import NavBar from "@/components/NavBar";
import Providers from "@/components/Providers";
import RootLayout, { metadata } from "./layout";

type El = ReactElement<{
  children?: React.ReactNode;
  lang?: string;
  component?: string;
  sx?: object;
}>;
const kids = (el: El) => [el.props.children].flat() as El[];

describe("RootLayout", () => {
  const html = RootLayout({ children: <p>page</p> } as never) as El;
  const body = kids(html)[0];
  const [colorScheme, providers] = kids(body);
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

  it("applies the light/dark scheme before first paint (no flash for dark-mode users)", () => {
    expect(colorScheme.type).toBe(InitColorSchemeScript);
    expect((colorScheme.props as { attribute?: string }).attribute).toBe("class");
  });

  it("titles pages '<grid> · PokeAPI Grids', defaulting to the app name", () => {
    expect(metadata.title).toEqual({ default: "PokeAPI Grids", template: "%s · PokeAPI Grids" });
  });
});
