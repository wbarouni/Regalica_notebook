#!/usr/bin/env python3
"""
Real embedder service using Ollama's nomic-embed-text model
"""
import os
import time
import logging
import requests
from typing import List
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
OLLAMA_URL = os.getenv('OLLAMA_URL', 'http://localhost:11434')
EMBED_MODEL = os.getenv('EMBED_MODEL', 'nomic-embed-text:latest')
HOST = os.getenv('HOST', '127.0.0.1')
PORT = int(os.getenv('PORT', 8000))

# Application FastAPI
app = FastAPI(
    title="Real Ollama Embedder",
    description="Real embedding service using Ollama",
    version="1.0.0"
)

class EmbedRequest(BaseModel):
    texts: List[str]

class EmbedResponse(BaseModel):
    vectors: List[List[float]]
    dim: int
    model: str
    processing_time_ms: int

@app.get("/health")
async def health_check():
    """Endpoint de santé"""
    try:
        # Test Ollama connection
        response = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        if response.status_code == 200:
            return {
                "status": "healthy",
                "model": EMBED_MODEL,
                "ollama_url": OLLAMA_URL,
                "timestamp": time.time()
            }
        else:
            raise HTTPException(status_code=503, detail="Ollama not accessible")
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Health check failed: {str(e)}")

@app.get("/info")
async def model_info():
    """Informations sur le modèle"""
    return {
        "model_name": EMBED_MODEL,
        "ollama_url": OLLAMA_URL,
        "dimension": 768,  # nomic-embed-text dimension
        "type": "real_embedding"
    }

@app.post("/embed", response_model=EmbedResponse)
async def generate_embeddings(request: EmbedRequest):
    """Génère des embeddings réels via Ollama"""
    if not request.texts:
        raise HTTPException(status_code=400, detail="Liste de textes vide")
    
    if len(request.texts) > 100:
        raise HTTPException(status_code=400, detail="Trop de textes (max 100)")
    
    start_time = time.time()
    
    try:
        logger.info(f"Generating embeddings for {len(request.texts)} texts using {EMBED_MODEL}")
        
        vectors = []
        
        # Process each text individually (Ollama embedding API)
        for text in request.texts:
            response = requests.post(
                f"{OLLAMA_URL}/api/embeddings",
                json={
                    "model": EMBED_MODEL,
                    "prompt": text.strip()
                },
                timeout=30
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=500, 
                    detail=f"Ollama embedding failed: {response.text}"
                )
            
            embedding_data = response.json()
            if "embedding" not in embedding_data:
                raise HTTPException(
                    status_code=500,
                    detail="Invalid embedding response from Ollama"
                )
            
            vectors.append(embedding_data["embedding"])
        
        processing_time = int((time.time() - start_time) * 1000)
        
        # Determine dimension from first vector
        dim = len(vectors[0]) if vectors else 0
        
        logger.info(f"Generated {len(vectors)} embeddings in {processing_time}ms (dim={dim})")
        
        return EmbedResponse(
            vectors=vectors,
            dim=dim,
            model=EMBED_MODEL,
            processing_time_ms=processing_time
        )
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Ollama request failed: {e}")
        raise HTTPException(status_code=503, detail=f"Ollama service unavailable: {str(e)}")
    except Exception as e:
        logger.error(f"Embedding generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Embedding failed: {str(e)}")

if __name__ == "__main__":
    logger.info(f"Starting real Ollama embedder on {HOST}:{PORT}")
    logger.info(f"Using model: {EMBED_MODEL}")
    logger.info(f"Ollama URL: {OLLAMA_URL}")
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")

