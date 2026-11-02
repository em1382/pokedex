import type { Metadata } from "next";
import "./globals.css";

import Container from "@mui/material/Container";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";

import NavBar from "@/components/NavBar";
import Providers from "@/components/Providers";
import { fib } from "@/theme/spacing";

export const metadata: Metadata = {
  // Grid pages set their own title, e.g. "Moves · PokeAPI Grids".
  title: { default: "PokeAPI Grids", template: "%s · PokeAPI Grids" },
  description: "PokeAPI data in MUI data grids, served offline from a Rails + SQLite backend.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The color-scheme class is added to <html> before hydration, hence the warning suppression.
    <html lang="en" suppressHydrationWarning>
      <body>
        <InitColorSchemeScript attribute="class" />
        <Providers>
          <NavBar />
          {/* Column flex: lets a page's grid grow into exactly the space left. */}
          <Container
            component="main"
            maxWidth={false}
            sx={{ py: fib(21), flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
          >
            {children}
          </Container>
        </Providers>
      </body>
    </html>
  );
}
