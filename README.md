# RAG System v1

A retrieval-augmented generation (RAG) pipeline built from scratch — **PDF in, grounded answers out** — deliberately implemented *without* high-level frameworks like LangChain, so every layer (chunking, embeddings, vector storage, similarity search, generation) is written and understood directly rather than abstracted away.

> **Learning project, v1.** The goal here wasn't to ship a product — it was to understand the internals of RAG by building each brick by hand. The system works end to end, and the limitations are documented honestly below.

---

## What it does

Give it a PDF and ask a question in plain English. The system:

1. Splits the document into chunks
2. Converts each chunk into a vector embedding
3. Stores those vectors in a Postgres + `pgvector` database
4. Embeds your question and finds the most semantically similar chunks
5. Feeds those chunks to an LLM, which writes an answer **grounded in the document** (not its own training data)

## Pipeline

```
PDF
 └─ text extraction              (PyPDF2)
     └─ chunking                 (token-based, 512 tokens / 100 overlap)
         └─ embeddings           (MiniLM, local, 384-dim)
             └─ vector storage   (Supabase / pgvector)
                 └─ retrieval     (cosine similarity, top-k via SQL function)
                     └─ augmentation  (retrieved chunks injected into prompt)
                         └─ generation  (Gemini, constrained to provided context)
                             └─ grounded answer
```

## How it works

**Ingestion** (`test.py`)
- PDF text is extracted with **PyPDF2**.
- Text is chunked using a token-based chunker (`chunking_evaluation`) at **512 tokens with 100-token overlap**, using `cl100k_base` purely as a size ruler.
- Each chunk is embedded **locally** with `sentence-transformers` (`paraphrase-multilingual-MiniLM-L12-v2`, **384 dimensions**) — chosen so document ingestion never hits API rate limits or cost.
- Chunks + vectors are inserted into a Supabase `document_chunks` table.
- An optional PCA visualization (matplotlib) projects the 384-dim embeddings to 2D for inspection.

**Retrieval + Generation** (`generation.py`)
- The user's question is embedded with the **same MiniLM model** (this is mandatory — query and documents must live in the same vector space to be comparable).
- A Postgres `match_documents` function performs cosine-similarity search and returns the top-k chunks. (PostgREST doesn't expose pgvector operators directly, so the search is wrapped in a SQL function and called via `rpc()`.)
- The retrieved chunk text is injected into a grounding prompt that instructs the model to answer **only** from the provided context.
- **Google Gemini** generates the final answer.

## Tech stack

| Layer | Tool |
|---|---|
| Language | Python |
| PDF extraction | PyPDF2 |
| Chunking | `chunking_evaluation` |
| Embeddings | `sentence-transformers` — `paraphrase-multilingual-MiniLM-L12-v2` (local, 384-dim) |
| Vector store | Supabase (Postgres + `pgvector`) |
| Generation | Google Gemini API |
| Visualization | scikit-learn (PCA) + matplotlib |

## Database setup

Run once in the Supabase SQL editor.

```sql
-- Enable the extension
create extension if not exists vector;

-- Table
create table document_chunks (
    id            bigserial primary key,
    document_name text   not null,
    chunk_index   int    not null,
    chunk_text    text   not null,
    embedding     vector(384),
    unique (document_name, chunk_index)
);

create index idx_chunks_document_name on document_chunks(document_name);
create index idx_chunks_embedding on document_chunks using hnsw (embedding vector_cosine_ops);

-- Similarity search function
create or replace function match_documents (
    query_embedding vector(384),
    match_threshold float,
    match_count     int
)
returns table (
    id            bigint,
    document_name text,
    chunk_index   int,
    chunk_text    text,
    similarity    float
)
language sql stable
as $$
    select
        document_chunks.id,
        document_chunks.document_name,
        document_chunks.chunk_index,
        document_chunks.chunk_text,
        1 - (document_chunks.embedding <=> query_embedding) as similarity
    from document_chunks
    where 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
    order by document_chunks.embedding <=> query_embedding asc
    limit match_count;
$$;
```

## Running it

1. **Clone & environment**
   ```bash
   git clone https://github.com/uzeyir-bayramli-3379/rag_system_v1.git
   cd rag_system_v1
   conda create -n rag_app python=3.12 && conda activate rag_app
   pip install -r requirements.txt
   ```
   *(No `requirements.txt` yet — generate one with `pip freeze > requirements.txt`. Core deps: `sentence-transformers`, `supabase`, `google-genai`, `PyPDF2`, `chunking_evaluation`, `python-dotenv`, `scikit-learn`, `matplotlib`.)*

2. **Environment variables** — create a `.env` file (never commit it):
   ```
   GEMINI_API_KEY=your_key_here
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```
   > The **service role key** bypasses Row Level Security and is appropriate for this local backend script. Keep it out of version control and never expose it client-side.

3. **Set up the database** — run the SQL above in Supabase.

4. **Ingest a document** — place a PDF in the project folder and run the ingestion script once to populate the table.

5. **Ask questions** — run `generation.py` and edit the `question` to query your document.

## Design notes

- **No LangChain, on purpose.** Every stage is implemented directly to learn how RAG actually works under the hood.
- **Local embeddings, API generation.** Embeddings are high-volume (every chunk, every re-index) while generation is low-volume (a few calls per question). Running embeddings locally with MiniLM avoids rate limits entirely; Gemini handles the cheaper generation step.
- **Same model for documents and queries.** The embedding model and its 384-dim output are locked in — changing models means re-embedding everything.

## Known limitations (v1)

This is an honest accounting, not a finished product:

- **Naive PDF extraction.** PyPDF2 pulls in references, headers, and page numbers, which get chunked and embedded alongside real content — these can surface in retrieval as low-value matches. No preprocessing/cleaning yet.
- **Script-shaped, not modular.** Ingestion and querying currently live in scripts rather than clean reusable modules.
- **Single-document workflow.** The schema supports multiple documents (`document_name`), but the flow is built around one PDF at a time.
- **No interface.** Runs from the command line; no UI.
- **`match_threshold` needs per-document tuning** — generic queries return low similarity scores.
- The HNSW index is present but unnecessary at small scale (added for correctness/practice).

## Roadmap

- [ ] Split into clean `ingest.py` / `rag.py` modules
- [ ] PDF cleaning step (strip references, headers, page artifacts before chunking)
- [ ] Multi-document support with `document_name` filtering in retrieval
- [ ] Web UI (Next.js) + integration with a personal task tracker via deep links

## References & learning resources

This project was built incrementally while learning from:

- [What are embeddings? — Cloudflare](https://www.cloudflare.com/en-gb/learning/ai/what-are-embeddings/) — conceptual introduction to embeddings
- **Adam Lucek** — [Vector Databases guide (`WTF_VDB.ipynb`)](https://github.com/ALucek/embeddings-guide/blob/main/WTF_VDB.ipynb) and [Chunking Strategies (`chunking.ipynb`)](https://github.com/ALucek/chunking-strategies/blob/main/chunking.ipynb), plus accompanying videos: [[1]](https://www.youtube.com/watch?v=NMfArmQ27m4) [[2]](https://youtu.be/Pk2BeaGbcTE)
- [Convert PDF to txt in Python — GeeksforGeeks](https://www.geeksforgeeks.org/python/convert-pdf-to-txt-file-using-python/)
- [`all-MiniLM-L12-v2` model card — Hugging Face](https://huggingface.co/sentence-transformers/all-MiniLM-L12-v2)
- [PCA — scikit-learn](https://scikit-learn.org/stable/modules/generated/sklearn.decomposition.PCA.html)
- [pgvector](https://github.com/pgvector/pgvector)
- [Vector columns — Supabase Docs](https://supabase.com/docs/guides/ai/vector-columns)

## License

MIT — see `LICENSE`