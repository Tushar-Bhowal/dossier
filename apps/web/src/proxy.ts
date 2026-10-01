import { NextResponse, type NextRequest } from "next/server";

// Optimistic only: a present cookie is enough to skip the landing page. The dashboard still
// verifies the session and sends a stale one to /login, which never routes back here.
export function proxy(request: NextRequest) {
  if (request.cookies.has("dossier_session")) {
    return NextResponse.redirect(new URL("/kits", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/",
};
