import { useTheme } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { theme } from "@/theme/theme";
import Providers from "./Providers";

function ThemeProbe() {
  return <span>{useTheme().palette.primary.main}</span>;
}

describe("Providers", () => {
  it("renders children with the app theme", () => {
    render(
      <Providers>
        <ThemeProbe />
      </Providers>,
    );
    expect(screen.getByText(theme.palette.primary.main)).toBeInTheDocument();
  });

  it("uses MUI's stock 8px spacing (only our own values are Fibonacci)", () => {
    expect(theme.spacing(2)).toBe("calc(2 * var(--mui-spacing, 8px))");
    expect(theme.palette.primary.main).toBe("#d32f2f");
  });

  it("has light and dark schemes as CSS variables, switched by a class", () => {
    // colorSchemes exists at runtime but isn't on MUI's public Theme type.
    const { colorSchemes } = theme as unknown as { colorSchemes: Record<string, unknown> };
    expect(Object.keys(colorSchemes)).toEqual(["light", "dark"]);
    expect(theme.vars).toBeDefined();
  });
});
