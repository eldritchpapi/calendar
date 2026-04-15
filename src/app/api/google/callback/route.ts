import { NextRequest, NextResponse } from "next/server";
import { handleCallback } from "@/lib/google-calendar";

// OAuth redirect target — receives ?code=... and stores tokens.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const err = request.nextUrl.searchParams.get("error");

  if (err) {
    return NextResponse.redirect(
      new URL(`/settings?google_error=${encodeURIComponent(err)}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  try {
    await handleCallback(code);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Token exchange failed";
    return NextResponse.redirect(
      new URL(`/settings?google_error=${encodeURIComponent(msg)}`, request.url)
    );
  }

  return NextResponse.redirect(new URL("/settings?google=connected", request.url));
}
