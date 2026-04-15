import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/google-calendar";

// Kicks off the OAuth flow — admin is redirected to Google consent.
export async function GET() {
  try {
    const url = getAuthUrl();
    return NextResponse.redirect(url);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "OAuth misconfigured";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
