import { NextRequest, NextResponse } from "next/server";
const protectedSections = new Set([
  "borrow-items",
  "return-items",
  "borrowing-history",
  "borrowing",
  "dashboard",
  "inventory",
  "categories",
  "locations",
  "stock-in",
  "stock-out",
  "adjustments",
  "damaged",
  "lost",
  "disposal",
  "transactions",
  "reports",
  "activity",
  "settings",
]);
export function proxy(request: NextRequest) {
  if (
    protectedSections.has(request.nextUrl.pathname.split("/")[1]) &&
    !request.cookies.get("hm_session")?.value
  )
    return NextResponse.redirect(new URL("/login", request.url));
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`;
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
