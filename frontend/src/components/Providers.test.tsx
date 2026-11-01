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

  it("uses MUI's stock spacing (only our own values are Fibonacci)", () => {
    expect(theme.spacing(2)).toBe("16px");
    expect(theme.palette.primary.main).toBe("#d32f2f");
  });
});
