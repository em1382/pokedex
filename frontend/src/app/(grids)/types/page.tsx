import GridPage, { gridMetadata } from "@/components/GridPage";

export const metadata = gridMetadata("type");

export default function Page() {
  return <GridPage slug="type" />;
}
