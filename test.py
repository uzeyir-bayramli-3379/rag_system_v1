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
dotenv.load_dotenv()
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


key=os.getenv("GEMINI_API_KEY")
print("ok" if key else "GEMINI_API_KEY not set")
client=genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

reader=PdfReader("file.pdf")
with open("output.txt", "w",encoding='utf-8') as f:
    for page in reader.pages:
        text=page.extract_text()
        if text:
            f.write(text+'\n')
with open ("output.txt", "r",encoding='utf-8') as f:
    document=f.read()
chunker=FixedTokenChunker(
    chunk_size=512,
    chunk_overlap=100,
    encoding_name="cl100k_base"
)
token_chunks=chunker.split_text(document)
#result = client.models.embed_content(
#    model="gemini-embedding-001",
#    contents=token_chunks,               
#)
#vectors = result.embeddings  
##print("Number of token chunks:", len(token_chunks))
#analyze_chunks(token_chunks, use_tokens=True)
model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
vectors = model.encode(token_chunks, show_progress_bar=True)
print(vectors.shape)

pca=PCA(n_components=2)
reduced_vectors=pca.fit_transform(vectors)
plt.figure(figsize=(10, 7))
plt.scatter(reduced_vectors[:, 0], reduced_vectors[:, 1], alpha=0.5)
plt.title("PCA of Chunk Embeddings")
plt.xlabel("Principal Component 1")
plt.ylabel("Principal Component 2")
plt.grid()
plt.show()
