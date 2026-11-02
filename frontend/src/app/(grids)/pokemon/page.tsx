import GridPage, { gridMetadata } from "@/components/GridPage";

export const metadata = gridMetadata("pokemon");

export default function Page() {
  return <GridPage slug="pokemon" />;
}
