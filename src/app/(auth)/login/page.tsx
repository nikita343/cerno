import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = { title: "Sign in · Cerno" };

export default function LoginPage() {
  // AuthForm reads ?next and ?error via useSearchParams, which has to sit
  // behind a Suspense boundary.
  return (
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  );
}
