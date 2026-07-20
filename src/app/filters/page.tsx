import type { Metadata } from "next";

import { FiltersView } from "@/components/views/FiltersView";

export const metadata: Metadata = { title: "Filters & labels · Cerno" };

export default function FiltersPage() {
  return <FiltersView />;
}
