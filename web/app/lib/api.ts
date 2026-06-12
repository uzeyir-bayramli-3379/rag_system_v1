// Base URL of the Python FastAPI service. Override with RAG_API_URL in the
// environment (server-side only — never exposed to the browser).
export const RAG_API_URL =
  process.env.RAG_API_URL ?? "http://127.0.0.1:8000";
