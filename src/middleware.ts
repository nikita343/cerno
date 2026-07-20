import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { hasSupabaseConfig, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";

/** Everything under here requires a session. */
const PROTECTED_PREFIX = "/dashboard";
/** Signed-in users get bounced off these back into the app. */
const AUTH_ROUTES = ["/login", "/signup"];

export async function middleware(request: NextRequest) {
  // Without config there is no session to refresh and no way to authenticate,
  // so guarding would lock every route with no way through. Let requests pass
  // and let the pages themselves explain what's missing.
  if (!hasSupabaseConfig()) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Written to both: the request so downstream server components read the
        // refreshed token, and the response so the browser stores it.
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Refreshes an expiring token as a side effect. Do not remove, and do not
  // replace with getSession() — see the note in lib/supabase/server.ts.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && pathname.startsWith(PROTECTED_PREFIX)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Remember where they were headed so login can return them there.
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && AUTH_ROUTES.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files. The auth callback is
     * deliberately included: it needs the cookie plumbing above to persist the
     * session it exchanges.
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
