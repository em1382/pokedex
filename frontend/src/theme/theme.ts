import { createTheme } from "@mui/material/styles";

/**
 * Light and dark schemes as CSS variables, switched by a class on <html>.
 * InitColorSchemeScript (in the root layout) sets that class before first
 * paint, so dark-mode users never see a flash of the light theme.
 */
export const theme = createTheme({
  cssVariables: { colorSchemeSelector: "class" },
  colorSchemes: { light: true, dark: true },
  palette: { primary: { main: "#d32f2f" } },
});
