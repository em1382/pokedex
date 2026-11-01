"use client";

import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Link from "next/link";

import { RESOURCE_META, RESOURCE_SLUGS } from "@/resources/meta";
import { fib } from "@/theme/spacing";

export default function Home() {
  return (
    <>
      <Typography variant="h4" component="h1" sx={{ mb: fib(13) }}>
        Resource directory
      </Typography>
      <Typography color="text.secondary" sx={{ mb: fib(21) }}>
        Each grid loads every record of a PokeAPI resource and pages through it in the
        browser. Data is served by the local Rails API from its SQLite copy of PokeAPI, so it works offline.
      </Typography>
      <Grid container spacing={fib(13)}>
        {RESOURCE_SLUGS.map((slug) => {
          const meta = RESOURCE_META[slug];
          return (
            <Grid key={slug} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card variant="outlined" sx={{ height: "100%" }}>
                <CardActionArea component={Link} href={`/${meta.path}`} sx={{ height: "100%" }}>
                  <CardContent>
                    <Typography variant="h6">{meta.label}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {meta.description}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      /api/{meta.path}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </>
  );
}
