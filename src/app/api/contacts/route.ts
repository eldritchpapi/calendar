import { NextResponse } from "next/server";
import { db } from "@/db";
import { contacts } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const allContacts = await db
    .select()
    .from(contacts)
    .orderBy(desc(contacts.lastBookedAt))
    .all();
  return NextResponse.json(allContacts);
}
