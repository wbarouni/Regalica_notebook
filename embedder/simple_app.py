#!/usr/bin/env python3
"""
Simple mock embedder service for testing
"""

import os
import time
import logging
from typing import List
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
HOST = '0.0.0.0'
PORT = int(os.getenv('PORT', 8000))

# Application FastAPI
app = FastAPI(
    title="Simple Embedder",
    description="Mock embedder service for testing",
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
    return {
        "status": "healthy",
        "model": "mock-embedder",
        "dimension": 1024,
        "timestamp": time.time()
    }

@app.get("/info")
async def model_info():
    """Informations sur le modèle"""
    return {
        "model_name": "mock-embedder",
        "dimension": 1024,
        "max_seq_length": 512
    }

@app.post("/embed", response_model=EmbedResponse)
async def generate_embeddings(request: EmbedRequest):
    """Génère des embeddings mock pour une liste de textes"""
    if not request.texts:
        raise HTTPException(status_code=400, detail="Liste de textes vide")
    
    if len(request.texts) > 100:
        raise HTTPException(status_code=400, detail="Trop de textes (max 100)")
    
    start_time = time.time()
    
    # Génération d'embeddings mock (vecteurs aléatoires normalisés)
    import random
    vectors = []
    for text in request.texts:
        # Créer un vecteur de dimension 1024 avec des valeurs aléatoires
        vector = [random.gauss(0, 0.1) for _ in range(1024)]
        # Normaliser le vecteur
        norm = sum(x*x for x in vector) ** 0.5
        if norm > 0:
            vector = [x/norm for x in vector]
        vectors.append(vector)
    
    processing_time = int((time.time() - start_time) * 1000)
    
    logger.info(f"Mock embeddings générés: {len(request.texts)} textes en {processing_time}ms")
    
    return EmbedResponse(
        vectors=vectors,
        dim=1024,
        model="mock-embedder",
        processing_time_ms=processing_time
    )

if __name__ == "__main__":
    logger.info(f"Démarrage du serveur mock embedder sur {HOST}:{PORT}")
    uvicorn.run(
        "simple_app:app",
        host=HOST,
        port=PORT,
        log_level="info"
    )
