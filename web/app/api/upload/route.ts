import { RAG_API_URL } from "@/app/lib/api";

// Proxies the PDF upload to the FastAPI /upload endpoint (server-side, so the
// browser never talks to the Python service directly).
export async function POST(request: Request) {
  let incoming: FormData;
  try {
    incoming = await request.formData();
  } catch {
    return Response.json(
      { detail: "Expected multipart form data." },
      { status: 400 }
    );
  }

  const file = incoming.get("file");
  if (!(file instanceof File)) {
    return Response.json(
      { detail: "No PDF file provided." },
      { status: 400 }
    );
  }

  const forwarded = new FormData();
  forwarded.append("file", file, file.name);

  try {
    const upstream = await fetch(`${RAG_API_URL}/upload`, {
      method: "POST",
      body: forwarded,
    });
    const data = await upstream.json().catch(() => ({}));
    return Response.json(data, { status: upstream.status });
  } catch {
    return Response.json(
      { detail: "Could not reach the indexing service. Is it running?" },
      { status: 502 }
    );
  }
}
