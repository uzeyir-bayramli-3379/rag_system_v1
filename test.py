# Indexing step of the RAG pipeline: read a PDF, chunk it, embed the chunks,
# and upsert them into Supabase/pgvector. Ends with a sample similarity query.
from chunking_evaluation.chunking import (
    ClusterSemanticChunker,
    LLMSemanticChunker,
    FixedTokenChunker,
    RecursiveTokenChunker,
    KamradtModifiedChunker
)
import numpy as np
import matplotlib.pyplot as plt
from sklearn.decomposition import PCA
from sentence_transformers import SentenceTransformer
import dotenv
from google import genai
from PyPDF2 import PdfReader
import tiktoken
from chunking_evaluation.utils import openai_token_count
import os
from supabase import create_client, Client
dotenv.load_dotenv()

#Template function taken from a documentation , used to vizualize and analyze the chunks of text created by the chunkers. It can be used to check for overlaps and understand how the chunking is working.
def analyze_chunks(chunks, use_tokens=False):
    # Print the chunks of interest
    print("\nNumber of Chunks:", len(chunks))
    print("\n", "="*50, "50th Chunk", "="*50,"\n", chunks[49])
    print("\n", "="*50, "51st Chunk", "="*50,"\n", chunks[50])
    
    chunk1, chunk2 = chunks[49], chunks[50]
    
    if use_tokens:
        encoding = tiktoken.get_encoding("cl100k_base")
        tokens1 = encoding.encode(chunk1)
        tokens2 = encoding.encode(chunk2)
        
        # Find overlapping tokens
        for i in range(len(tokens1), 0, -1):
            if tokens1[-i:] == tokens2[:i]:
                overlap = encoding.decode(tokens1[-i:])
                print("\n", "="*50, f"\nOverlapping text ({i} tokens):", overlap)
                return
        print("\nNo token overlap found")
    else:
        # Find overlapping characters
        for i in range(min(len(chunk1), len(chunk2)), 0, -1):
            if chunk1[-i:] == chunk2[:i]:
                print("\n", "="*50, f"\nOverlapping text ({i} chars):", chunk1[-i:])
                return
        print("\nNo character overlap found")

#Environment keys
client=genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


# Supabase client (service role key) used to upsert chunks and run vector search.
supa_url:str=os.getenv("SUPABASE_URL")
supa_service_key:str=os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(supa_url, supa_service_key)


#PDF onto text. Extract every page and cache it to output.txt, then read it back.
reader=PdfReader("file.pdf")
with open("output.txt", "w",encoding='utf-8') as f:
    for page in reader.pages:
        text=page.extract_text()
        if text:
            f.write(text+'\n')
with open ("output.txt", "r",encoding='utf-8') as f:
    document=f.read()

#Chunking with fixed token chunker and slight overlap.
chunker=FixedTokenChunker(
    chunk_size=512,
    chunk_overlap=100,
    encoding_name="cl100k_base"
)
token_chunks=chunker.split_text(document)


#Gemini Embedding left as comment for anyone who wants to use it. 
#result = client.models.embed_content(
#    model="gemini-embedding-001",
#    contents=token_chunks,               
#)
#vectors = result.embeddings  
##print("Number of token chunks:", len(token_chunks))
#analyze_chunks(token_chunks, use_tokens=True)

#Actual embedding model used for this test. Runs locally (no API billing).
#NOTE: generation.py must use this same model so query and chunk vectors align.
model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
vectors = model.encode(token_chunks, show_progress_bar=True)
print(vectors.shape)  # (num_chunks, embedding_dim) sanity check

#Plotting the PCA of the chunk embeddings
#Optional , can be commented out if not needed.
#pca=PCA(n_components=2)
#reduced_vectors=pca.fit_transform(vectors)
#plt.figure(figsize=(10, 7))
#plt.scatter(reduced_vectors[:, 0], reduced_vectors[:, 1], alpha=0.5)
#plt.title("PCA of Chunk Embeddings")
#plt.xlabel("Principal Component 1")
#plt.ylabel("Principal Component 2")
#plt.grid()
#plt.show()


# Pair each chunk with its embedding and build one row per chunk.
zipped=list(zip(token_chunks, vectors))
rows=[
    {"document_name": "file.pdf", "chunk_index": i, "chunk_text": chunk, "embedding": vector.tolist()}
    for i, (chunk, vector) in enumerate(zipped)
]
# Upsert keyed on (document_name, chunk_index) so re-runs update instead of duplicating.
supabase.table("document_chunks").upsert(rows, on_conflict='document_name,chunk_index').execute()


# Smoke test: embed a sample question and retrieve the closest chunks.
question='How is machine learning used to detect damage in aerospace structures?'
qvec=model.encode(question).tolist()
response = supabase.rpc(
    "match_documents",
    {
        "query_embedding": qvec, 
        "match_threshold": 0.3, 
        "match_count": 5
    }
).execute()

for item in response.data:
    print(f"Similarity: {item['similarity']:.4f} | Text: {item['chunk_text']}")