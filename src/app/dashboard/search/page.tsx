import type { Metadata } from "next";

import { SearchView } from "@/components/views/SearchView";

export const metadata: Metadata = { title: "Search · Cerno" };

/**
 * The tag is read on the server and handed down rather than pulled from
 * `useSearchParams`, which would force a Suspense boundary around the whole
 * view for a value that is already available here.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tag } = await searchParams;
  return <SearchView initialQuery={typeof tag === "string" ? tag : null} />;
}
