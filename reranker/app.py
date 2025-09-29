#!/usr/bin/env python3
"""
Microservice de reranking pour Regalica Notebook
Utilise BGE-reranker-v2-m3 pour réordonner les candidats RAG
"""

import os
import time
import logging
from typing import List, Dict, Any
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
from sentence_transformers import CrossEncoder

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
RERANKER_MODEL_NAME = os.getenv('RERANKER_MODEL_NAME', 'BAAI/bge-reranker-v2-m3')
HOST = os.getenv('HOST', '0.0.0.0')
PORT = int(os.getenv('PORT', 8001))

# Application FastAPI
app = FastAPI(
    title="Regalica Reranker",
    description="Microservice de reranking pour pipeline RAG",
    version="1.0.0"
)

# Variable globale pour le modèle
model = None

class RerankRequest(BaseModel):
    query: str
    candidates: List[str]

class RerankResponse(BaseModel):
    scores: List[float]
    processing_time_ms: int
    model: str

def load_model():
    """Charge le modèle de reranking"""
    global model
    
    logger.info(f"Chargement du modèle de reranking: {RERANKER_MODEL_NAME}")
    start_time = time.time()
    
    try:
        model = CrossEncoder(RERANKER_MODEL_NAME)
        
        load_time = time.time() - start_time
        logger.info(f"Modèle de reranking chargé en {load_time:.2f}s")
        
        # Test du modèle avec un exemple simple
        test_scores = model.predict([("test query", "test document")])
        logger.info(f"Test réussi - Score exemple: {test_scores[0]:.4f}")
        
    except Exception as e:
        logger.error(f"Erreur lors du chargement du modèle: {e}")
        raise

@app.on_event("startup")
async def startup_event():
    """Initialisation au démarrage"""
    logger.info("Démarrage du microservice reranker")
    load_model()

@app.get("/health")
async def health_check():
    """Endpoint de santé"""
    if model is None:
        raise HTTPException(status_code=503, detail="Modèle non chargé")
    
    return {
        "status": "healthy",
        "model": RERANKER_MODEL_NAME,
        "timestamp": time.time()
    }

@app.get("/info")
async def model_info():
    """Informations sur le modèle"""
    if model is None:
        raise HTTPException(status_code=503, detail="Modèle non chargé")
    
    return {
        "model_name": RERANKER_MODEL_NAME,
        "model_type": "cross_encoder",
        "max_length": getattr(model, 'max_length', 'unknown')
    }

@app.post("/rerank", response_model=RerankResponse)
async def rerank_candidates(request: RerankRequest):
    """Réordonne les candidats selon leur pertinence par rapport à la requête"""
    if model is None:
        raise HTTPException(status_code=503, detail="Modèle non chargé")
    
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Requête vide")
    
    if not request.candidates:
        raise HTTPException(status_code=400, detail="Liste de candidats vide")
    
    if len(request.candidates) > 64:
        raise HTTPException(status_code=400, detail="Trop de candidats (max 64)")
    
    # Rejeter les candidats vides
    valid_candidates = []
    valid_indices = []
    for i, candidate in enumerate(request.candidates):
        if candidate and candidate.strip():
            valid_candidates.append(candidate.strip())
            valid_indices.append(i)
    
    if not valid_candidates:
        raise HTTPException(status_code=400, detail="Aucun candidat valide")
    
    try:
        start_time = time.time()
        
        # Préparer les paires (query, candidate) pour le cross-encoder
        pairs = [(request.query, candidate) for candidate in valid_candidates]
        
        # Calculer les scores de pertinence en batch
        raw_scores = model.predict(pairs)
        
        # Normaliser les scores entre 0 et 1 en utilisant la fonction sigmoid
        normalized_scores = [float(1 / (1 + np.exp(-score))) for score in raw_scores]
        
        # Reconstituer les scores pour tous les candidats originaux (0 pour les vides)
        full_scores = [0.0] * len(request.candidates)
        for i, valid_idx in enumerate(valid_indices):
            full_scores[valid_idx] = normalized_scores[i]
        
        processing_time = int((time.time() - start_time) * 1000)
        
        # Logs de temps par lot
        avg_time_per_candidate = processing_time / len(valid_candidates) if valid_candidates else 0
        logger.info(f"Reranking terminé: {len(valid_candidates)}/{len(request.candidates)} candidats valides en {processing_time}ms ({avg_time_per_candidate:.1f}ms/candidat)")
        logger.debug(f"Scores: min={min(normalized_scores):.4f}, max={max(normalized_scores):.4f}, avg={np.mean(normalized_scores):.4f}")
        
        return RerankResponse(
            scores=full_scores,
            processing_time_ms=processing_time,
            model=RERANKER_MODEL_NAME
        )
        
    except Exception as e:
        logger.error(f"Erreur lors du reranking: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur interne: {str(e)}")

@app.post("/rerank/batch")
async def rerank_batch(request: RerankRequest):
    """Alias pour /rerank pour compatibilité"""
    return await rerank_candidates(request)

if __name__ == "__main__":
    logger.info(f"Démarrage du serveur reranker sur {HOST}:{PORT}")
    uvicorn.run(
        "app:app",
        host=HOST,
        port=PORT,
        log_level="info",
        access_log=True
    )
