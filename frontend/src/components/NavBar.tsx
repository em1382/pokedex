"use client";

import MenuIcon from "@mui/icons-material/Menu";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";

import { RESOURCE_META, RESOURCE_SLUGS } from "@/resources/meta";
import { fib } from "@/theme/spacing";

const LINKS = RESOURCE_SLUGS.map((slug) => ({
  href: `/${RESOURCE_META[slug].path}`,
  label: RESOURCE_META[slug].label,
}));

/** Inline links from md up; on sm and below, a hamburger (right) opening a right-hand drawer. */
export default function NavBar() {
  const [open, setOpen] = useState(false);

  return (
    <AppBar position="static" elevation={0}>
      <Toolbar sx={{ gap: fib(13) }}>
        <Typography
          component={Link}
          href="/"
          variant="h6"
          noWrap
          sx={{ color: "inherit", textDecoration: "none", mr: fib(13) }}
        >
          PokeAPI Grids
        </Typography>

        <Box component="nav" sx={{ display: { xs: "none", md: "flex" }, gap: fib(8) }}>
          <WithPathname render={(current) => <InlineLinks current={current} />} />
        </Box>

        <IconButton
          color="inherit"
          edge="end"
          aria-label="Open navigation"
          aria-controls="nav-drawer"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          sx={{ display: { xs: "inline-flex", md: "none" }, ml: "auto" }} // pushed to the right edge
        >
          <MenuIcon />
        </IconButton>
      </Toolbar>

      <Drawer
        id="nav-drawer"
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        // Stay in the DOM while closed so the button's aria-controls always resolves.
        keepMounted
        sx={{ display: { md: "none" } }}
      >
        <Box component="nav" sx={{ width: 233, py: fib(8) }}>
          <Typography variant="overline" component="div" color="text.secondary" sx={{ px: fib(21) }}>
            Grids
          </Typography>
          <List disablePadding>
            <WithPathname
              render={(current) => <DrawerLinks current={current} onNavigate={() => setOpen(false)} />}
            />
          </List>
        </Box>
      </Drawer>
    </AppBar>
  );
}

/**
 * The current path is request data, so with Cache Components it must be read
 * inside <Suspense>. Until it streams in, links render without the highlight.
 */
function WithPathname({ render }: { render: (current: string | null) => React.ReactNode }) {
  return (
    <Suspense fallback={render(null)}>
      <PathnameReader render={render} />
    </Suspense>
  );
}

function PathnameReader({ render }: { render: (current: string | null) => React.ReactNode }) {
  return render(usePathname());
}

function InlineLinks({ current }: { current: string | null }) {
  return LINKS.map(({ href, label }) => (
    <Button
      key={href}
      component={Link}
      href={href}
      color="inherit"
      aria-current={current === href ? "page" : undefined}
    >
      {label}
    </Button>
  ));
}

function DrawerLinks({ current, onNavigate }: { current: string | null; onNavigate: () => void }) {
  return LINKS.map(({ href, label }) => (
    <ListItemButton
      key={href}
      component={Link}
      href={href}
      selected={current === href}
      aria-current={current === href ? "page" : undefined}
      onClick={onNavigate}
      sx={{ px: fib(21) }}
    >
      <ListItemText primary={label} />
    </ListItemButton>
  ));
}
