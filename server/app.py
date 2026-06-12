"""FastAPI service exposing the RAG pipeline to the Next.js frontend.

Endpoints:
  GET  /health        -> liveness check
  POST /upload        -> multipart PDF; chunk + embed + store in pgvector
  POST /query         -> {question} -> grounded Gemini answer + sources
"""
from __future__ import annotations

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import pipeline

app = FastAPI(title="Ask your PDF — RAG service")

# The Next.js route handlers proxy server-side, so browser CORS isn't strictly
# required, but allow localhost dev origins for direct calls / debugging.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_PDF_BYTES = 15 * 1024 * 1024  # 15 MB guard


class QueryRequest(BaseModel):
    question: str


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/upload")
async def upload(file: UploadFile = File(...)) -> dict:
    if file.content_type not in ("application/pdf", "application/x-pdf"):
        raise HTTPException(status_code=415, detail="Please upload a PDF file.")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(data) > MAX_PDF_BYTES:
        raise HTTPException(status_code=413, detail="PDF is larger than 15 MB.")

    document_name = file.filename or "document.pdf"

    try:
        result = pipeline.index_pdf(data, document_name)
    except ValueError as e:
        # Expected, user-facing problems (no text, no chunks, etc.)
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:  # noqa: BLE001 — surface unexpected failures cleanly
        raise HTTPException(status_code=500, detail=f"Indexing failed: {e}")

    return result


@app.post("/query")
def query(req: QueryRequest) -> dict:
    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    try:
        return pipeline.answer_question(question)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")
