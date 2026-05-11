import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
 
  if (!webhookUrl) {
    return NextResponse.json(
      { error: "N8N_WEBHOOK_URL is not configured." },
      { status: 500 }
    );
  }

  try {
    // Forward the raw multipart/form-data body directly to n8n
    const formData = await req.formData();

    const n8nRes = await fetch(webhookUrl, {
      method: "POST",
      body: formData,
      // Do NOT set Content-Type — let fetch set the boundary automatically
    });

    if (!n8nRes.ok) {
      const text = await n8nRes.text();
      return NextResponse.json(
        { error: `n8n returned ${n8nRes.status}`, detail: text },
        { status: n8nRes.status }
      );
    }

    const data = await n8nRes.json().catch(() => ({ ok: true }));
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
