import { NextRequest, NextResponse } from "next/server";
import { executeWorkflows } from "@/lib/workflows";

// Called periodically (Vercel cron or external trigger) to execute
// pending workflow steps — before_meeting reminders, after_meeting follow-ups, etc.
async function run(request: NextRequest): Promise<NextResponse> {
  // Optional secret check — only required if CRON_SECRET is set
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization");
    const querySecret = request.nextUrl.searchParams.get("secret");
    const provided =
      authHeader?.replace("Bearer ", "") || querySecret || "";
    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    await executeWorkflows();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Workflow execution failed:", error);
    return NextResponse.json({ error: "Execution failed" }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
