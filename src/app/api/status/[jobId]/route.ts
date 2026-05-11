import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/status/[jobId]
 *
 * Optional — only needed if your n8n workflow returns a jobId on submission
 * instead of waiting synchronously for the full result.
 *
 * n8n exposes an execution status endpoint if you use the "Respond to Webhook"
 * node set to "When last node finishes". Alternatively, you can build a custom
 * status endpoint inside n8n using the HTTP Request + Set nodes and call it here.
 *
 * Expected response shape from n8n:
 * {
 *   stage: "editing_image" | "writing_copy" | "awaiting_approval" | "publishing" | "done" | "error",
 *   message: string,
 *   editedImageUrl?: string,
 *   generatedCopy?: string,
 *   slackMessageTs?: string,
 *   postUrl?: string,
 *   error?: string
 * }
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const statusUrl = process.env.N8N_STATUS_URL;
  if (!statusUrl) {
    return NextResponse.json(
      { error: "N8N_STATUS_URL is not configured." },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(`${statusUrl}/${params.jobId}`, {
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
