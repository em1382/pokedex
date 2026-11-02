import GridPage, { gridMetadata } from "@/components/GridPage";

export const metadata = gridMetadata("item");

export default function Page() {
  return <GridPage slug="item" />;
}
