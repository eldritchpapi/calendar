import { NextResponse } from "next/server";
import { listAllCalendars, isConnected } from "@/lib/google-calendar";

export async function GET() {
  const connected = await isConnected();
  if (!connected) {
    return NextResponse.json({ connected: false, calendars: [] });
  }

  const calendars = await listAllCalendars();
  return NextResponse.json({ connected: true, calendars });
}
