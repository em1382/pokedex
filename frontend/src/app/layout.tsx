import type { Metadata } from "next";
import "./globals.css";

import Container from "@mui/material/Container";

import NavBar from "@/components/NavBar";
import Providers from "@/components/Providers";
import { fib } from "@/theme/spacing";

export const metadata: Metadata = {
  title: "PokeAPI Grids",
  description: "PokeAPI data in MUI data grids, served offline from a Rails + SQLite backend.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
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
