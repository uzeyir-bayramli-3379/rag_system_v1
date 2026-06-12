"""Reusable RAG pipeline logic shared by the FastAPI endpoints.

This refactors the standalone scripts (test.py = indexing, generation.py =
generation) into importable functions, with the expensive pieces (the MiniLM
model, the Supabase + Gemini clients) loaded once and reused across requests.
"""
from __future__ import annotations

import io
import os
from pathlib import Path
from functools import lru_cache

import dotenv
from PyPDF2 import PdfReader
from chunking_evaluation.chunking import FixedTokenChunker
from sentence_transformers import SentenceTransformer
from supabase import create_client, Client
from google import genai

# Load secrets from the repo-root .env (one level up from server/).
dotenv.load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# Must match the model used at indexing time, or query and chunk vectors
# won't live in the same space (see the note in test.py).
EMBED_MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"
GEN_MODEL_NAME = "gemini-2.5-flash"

# Chunking parameters — identical to the original indexing script.
CHUNK_SIZE = 512
CHUNK_OVERLAP = 100

# Retrieval defaults — low threshold + generous count favours recall and
# lets the LLM filter the noise.
DEFAULT_MATCH_THRESHOLD = 0.1
DEFAULT_MATCH_COUNT = 10


@lru_cache(maxsize=1)
def get_model() -> SentenceTransformer:
    """Load the embedding model once and cache it for the process lifetime."""
    return SentenceTransformer(EMBED_MODEL_NAME)


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


@lru_cache(maxsize=1)
def get_gemini() -> genai.Client:
    return genai.Client(api_key=os.environ["GEMINI_API_KEY"])


def extract_pdf_text(file_bytes: bytes) -> str:
    """Pull text from every page of an in-memory PDF."""
    reader = PdfReader(io.BytesIO(file_bytes))
    parts: list[str] = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            parts.append(text)
    return "\n".join(parts)


def chunk_text(document: str) -> list[str]:
    """Fixed-token chunking with overlap (same config as the original script)."""
    chunker = FixedTokenChunker(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        encoding_name="cl100k_base",
    )
    return chunker.split_text(document)


def index_pdf(file_bytes: bytes, document_name: str) -> dict:
    """Index one PDF: extract -> chunk -> embed -> upsert into pgvector.

    Re-indexing the same document_name replaces its previous chunks so stale
    higher-index chunks from an older version don't linger.
    """
    document = extract_pdf_text(file_bytes)
    if not document.strip():
        raise ValueError("No extractable text found in this PDF.")

    chunks = chunk_text(document)
    if not chunks:
        raise ValueError("PDF produced no chunks.")

    vectors = get_model().encode(chunks, show_progress_bar=False)

    rows = [
        {
            "document_name": document_name,
            "chunk_index": i,
            "chunk_text": chunk,
            "embedding": vector.tolist(),
        }
        for i, (chunk, vector) in enumerate(zip(chunks, vectors))
    ]

    supabase = get_supabase()
    # Single-document scope: wipe every existing chunk so only the freshly
    # uploaded PDF lives in the table, then insert its chunks. This prevents
    # match_documents from bleeding retrieval across previously uploaded docs.
    supabase.table("document_chunks").delete().gte("chunk_index", 0).execute()
    supabase.table("document_chunks").upsert(
        rows, on_conflict="document_name,chunk_index"
    ).execute()

    return {"document_name": document_name, "chunks": len(chunks)}


def retrieve(
    question: str,
    match_threshold: float = DEFAULT_MATCH_THRESHOLD,
    match_count: int = DEFAULT_MATCH_COUNT,
) -> list[dict]:
    """Embed the question and run cosine search via the match_documents RPC."""
    query_embedding = get_model().encode(question).tolist()
    response = get_supabase().rpc(
        "match_documents",
        {
            "query_embedding": query_embedding,
            "match_threshold": match_threshold,
            "match_count": match_count,
        },
    ).execute()
    return response.data or []


def answer_question(
    question: str,
    match_threshold: float = DEFAULT_MATCH_THRESHOLD,
    match_count: int = DEFAULT_MATCH_COUNT,
) -> dict:
    """Full query path: retrieve grounding chunks, then ask Gemini.

    Returns the grounded answer plus the retrieved sources (text + similarity)
    so the UI can show what the answer was based on.
    """
    matches = retrieve(question, match_threshold, match_count)

    if not matches:
        return {
            "answer": "I couldn't find anything relevant in the uploaded "
            "document(s) to answer that.",
            "sources": [],
        }

    context = "\n\n---\n\n".join(item["chunk_text"] for item in matches)

    prompt = f"""Answer the question using ONLY the context below.
   If the context doesn't contain the answer, say so — do not make anything up.

   Context:
   {context}

   Question: {question}"""

    result = get_gemini().models.generate_content(
        model=GEN_MODEL_NAME,
        contents=prompt,
    )

    sources = [
        {
            "chunk_index": item.get("chunk_index"),
            "document_name": item.get("document_name"),
            "similarity": item.get("similarity"),
            "preview": (item["chunk_text"][:240] + "…")
            if len(item["chunk_text"]) > 240
            else item["chunk_text"],
        }
        for item in matches
    ]

    return {"answer": result.text, "sources": sources}
