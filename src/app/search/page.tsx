import type { Metadata } from "next";

import { SearchView } from "@/components/views/SearchView";

export const metadata: Metadata = { title: "Search · Cerno" };

export default function SearchPage() {
  return <SearchView />;
}
