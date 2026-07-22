import type { Metadata } from "next";

import { ResetForm } from "@/components/auth/ResetForm";

export const metadata: Metadata = { title: "New password · Cerno" };

// The recovery session is set by /auth/callback before this renders, so there's
// nothing to prerender — the page is meaningful only for a signed-in request.
export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return <ResetForm />;
}
