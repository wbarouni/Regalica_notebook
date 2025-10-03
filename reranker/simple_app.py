#!/usr/bin/env python3
"""
Simple mock reranker service for testing
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
PORT = int(os.getenv('PORT', 8001))

# Application FastAPI
app = FastAPI(
    title="Simple Reranker",
    description="Mock reranker service for testing",
    version="1.0.0"
)

class RerankRequest(BaseModel):
    query: str
    candidates: List[str]

class RerankResponse(BaseModel):
    scores: List[float]
    processing_time_ms: int
    model: str

@app.get("/health")
async def health_check():
    """Endpoint de santé"""
    return {
        "status": "healthy",
        "model": "mock-reranker",
        "timestamp": time.time()
    }

@app.get("/info")
async def model_info():
    """Informations sur le modèle"""
    return {
        "model_name": "mock-reranker",
        "model_type": "cross_encoder",
        "max_length": 512
    }

@app.post("/rerank", response_model=RerankResponse)
async def rerank_candidates(request: RerankRequest):
    """Réordonne les candidats selon leur pertinence (mock)"""
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Requête vide")
    
    if not request.candidates:
        raise HTTPException(status_code=400, detail="Liste de candidats vide")
    
    if len(request.candidates) > 64:
        raise HTTPException(status_code=400, detail="Trop de candidats (max 64)")
    
    start_time = time.time()
    
    # Génération de scores mock basés sur la longueur du texte et des mots communs
    import random
    scores = []
    query_words = set(request.query.lower().split())
    
    for candidate in request.candidates:
        if not candidate or not candidate.strip():
            scores.append(0.0)
            continue
            
        # Score basé sur les mots communs + un peu d'aléatoire
        candidate_words = set(candidate.lower().split())
        common_words = len(query_words.intersection(candidate_words))
        base_score = min(common_words / max(len(query_words), 1), 1.0)
        
        # Ajouter un peu d'aléatoire et normaliser entre 0 et 1
        random_factor = random.uniform(0.1, 0.9)
        final_score = (base_score * 0.7 + random_factor * 0.3)
        scores.append(final_score)
    
    processing_time = int((time.time() - start_time) * 1000)
    
    logger.info(f"Mock reranking terminé: {len(request.candidates)} candidats en {processing_time}ms")
    
    return RerankResponse(
        scores=scores,
        processing_time_ms=processing_time,
        model="mock-reranker"
    )

if __name__ == "__main__":
    logger.info(f"Démarrage du serveur mock reranker sur {HOST}:{PORT}")
    uvicorn.run(
        "simple_app:app",
        host=HOST,
        port=PORT,
        log_level="info"
    )
