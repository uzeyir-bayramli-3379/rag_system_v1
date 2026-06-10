# Generation step of the RAG pipeline: retrieve relevant chunks from Supabase,
# then feed them as context to Gemini to produce a grounded answer.
# (Assumes test.py has already embedded and upserted the chunks into the DB.)
from google import genai
from supabase import create_client, Client
import os
import dotenv
from sentence_transformers import SentenceTransformer
dotenv.load_dotenv()

# Environment keys: Gemini for generation, Supabase for vector retrieval.
client=genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
supa_url:str=os.getenv("SUPABASE_URL")
supa_service_key:str=os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(supa_url, supa_service_key)

# Must match the model used at indexing time, otherwise embeddings aren't comparable.
model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")

# Embed the user's question into the same vector space as the stored chunks.
question = "How is machine learning used to detect damage in aerospace structures?"
query_embedding = model.encode(question).tolist()

# Retrieval: pgvector similarity search via the match_documents RPC.
# Low threshold + high count favours recall (let the LLM filter the noise).
response = supabase.rpc(
    "match_documents",
    {
        "query_embedding": query_embedding,
        "match_threshold": 0.1,
        "match_count": 10,
    },
).execute()

# Inspect what was retrieved and how similar each chunk is.
for item in response.data:
    print(f"Similarity: {item['similarity']:.4f} | Text: {item['chunk_text']}")

# Stitch the retrieved chunks into a single context block for the prompt.
context = "\n\n---\n\n".join(item["chunk_text"] for item in response.data)

# Grounding instruction: answer only from context to reduce hallucination.
prompt = f"""Answer the question using ONLY the context below.
   If the context doesn't contain the answer, say so — do not make anything up.

   Context:
   {context}

   Question: {question}"""

# Generation: hand the retrieved context + question to Gemini.
answer = client.models.generate_content(
       model="gemini-2.5-flash",
       contents=prompt
   )
print(answer.text)