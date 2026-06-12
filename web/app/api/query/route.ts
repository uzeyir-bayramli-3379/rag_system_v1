import { RAG_API_URL } from "@/app/lib/api";

// Proxies a question to the FastAPI /query endpoint.
export async function POST(request: Request) {
  let body: { question?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ detail: "Expected JSON body." }, { status: 400 });
  }

  const question = (body.question ?? "").trim();
  if (!question) {
    return Response.json(
      { detail: "Question cannot be empty." },
      { status: 400 }
    );
  }

  try {
    const upstream = await fetch(`${RAG_API_URL}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const data = await upstream.json().catch(() => ({}));
    return Response.json(data, { status: upstream.status });
  } catch {
    return Response.json(
      { detail: "Could not reach the query service. Is it running?" },
      { status: 502 }
    );
  }
}
