import { NextResponse } from "next/server";
import { disconnect } from "@/lib/google-calendar";

export async function POST() {
  await disconnect();
  return NextResponse.json({ success: true });
}
