import type { Metadata } from "next";

import { JoinView } from "@/components/views/JoinView";

export const metadata: Metadata = { title: "Join workspace · Cerno" };

/**
 * Accepting happens in the browser, not here.
 *
 * `accept_workspace_invite` is scoped to `auth.uid()`, and this route sits
 * inside the dashboard layout — so anyone reaching it is already signed in and
 * the RPC has a session to work with. Accepting server-side would need the same
 * session anyway, and would burn the invite on a page *preload*.
 */
export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <JoinView token={token} />;
}
