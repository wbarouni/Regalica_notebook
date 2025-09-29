#!/usr/bin/env python3
"""
Microservice d'embeddings réels pour Regalica Notebook
Utilise sentence-transformers pour générer des embeddings locaux
"""

import os
import time
import logging
from typing import List, Dict, Any
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
from sentence_transformers import SentenceTransformer

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
EMBED_MODEL_NAME = os.getenv('EMBED_MODEL_NAME', 'intfloat/multilingual-e5-large')
HOST = os.getenv('HOST', '0.0.0.0')
PORT = int(os.getenv('PORT', 8000))

# Modèles supportés avec leurs dimensions
SUPPORTED_MODELS = {
    'intfloat/multilingual-e5-large': 1024,
    'nomic-ai/nomic-embed-text-v1.5': 768,
    'sentence-transformers/all-MiniLM-L6-v2': 384,
    'intfloat/e5-large-v2': 1024
}

# Application FastAPI
app = FastAPI(
    title="Regalica Embedder",
    description="Microservice de génération d'embeddings réels",
    version="1.0.0"
)

# Variable globale pour le modèle
model = None
model_dim = None

class EmbedRequest(BaseModel):
    texts: List[str]

class EmbedResponse(BaseModel):
    vectors: List[List[float]]
    dim: int
    model: str
    processing_time_ms: int

def load_model():
    """Charge le modèle d'embeddings"""
    global model, model_dim
    
    logger.info(f"Chargement du modèle: {EMBED_MODEL_NAME}")
    start_time = time.time()
    
    try:
        model = SentenceTransformer(EMBED_MODEL_NAME)
        model_dim = SUPPORTED_MODELS.get(EMBED_MODEL_NAME, model.get_sentence_embedding_dimension())
        
        load_time = time.time() - start_time
        logger.info(f"Modèle chargé en {load_time:.2f}s - Dimension: {model_dim}")
        
        # Test du modèle avec un texte simple
        test_embedding = model.encode(["test"], normalize_embeddings=True)
        logger.info(f"Test réussi - Shape: {test_embedding.shape}")
        
    except Exception as e:
        logger.error(f"Erreur lors du chargement du modèle: {e}")
        raise

@app.on_event("startup")
async def startup_event():
    """Initialisation au démarrage"""
    logger.info("Démarrage du microservice embedder")
    load_model()

@app.get("/health")
async def health_check():
    """Endpoint de santé"""
    if model is None:
        raise HTTPException(status_code=503, detail="Modèle non chargé")
    
    return {
        "status": "healthy",
        "model": EMBED_MODEL_NAME,
        "dimension": model_dim,
        "timestamp": time.time()
    }

@app.get("/info")
async def model_info():
    """Informations sur le modèle"""
    if model is None:
        raise HTTPException(status_code=503, detail="Modèle non chargé")
    
    return {
        "model_name": EMBED_MODEL_NAME,
        "dimension": model_dim,
        "supported_models": list(SUPPORTED_MODELS.keys()),
        "max_seq_length": getattr(model, 'max_seq_length', 'unknown')
    }

@app.post("/embed", response_model=EmbedResponse)
async def generate_embeddings(request: EmbedRequest):
    """Génère des embeddings pour une liste de textes"""
    if model is None:
        raise HTTPException(status_code=503, detail="Modèle non chargé")
    
    if not request.texts:
        raise HTTPException(status_code=400, detail="Liste de textes vide")
    
    if len(request.texts) > 100:
        raise HTTPException(status_code=400, detail="Trop de textes (max 100)")
    
    try:
        start_time = time.time()
        
        # Génération des embeddings avec normalisation L2
        embeddings = model.encode(
            request.texts,
            normalize_embeddings=True,
            show_progress_bar=False
        )
        
        processing_time = int((time.time() - start_time) * 1000)
        
        # Conversion en liste Python pour JSON
        vectors = embeddings.tolist()
        
        # Vérification de la normalisation
        for i, vector in enumerate(vectors):
            norm = np.linalg.norm(vector)
            if abs(norm - 1.0) > 0.01:  # Tolérance pour les erreurs de précision
                logger.warning(f"Vecteur {i} non normalisé: norme = {norm}")
        
        logger.info(f"Embeddings générés: {len(request.texts)} textes en {processing_time}ms")
        
        return EmbedResponse(
            vectors=vectors,
            dim=model_dim,
            model=EMBED_MODEL_NAME,
            processing_time_ms=processing_time
        )
        
    except Exception as e:
        logger.error(f"Erreur lors de la génération d'embeddings: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur interne: {str(e)}")

@app.post("/embed/batch")
async def generate_embeddings_batch(request: EmbedRequest):
    """Génère des embeddings par batch (alias pour /embed)"""
    return await generate_embeddings(request)

if __name__ == "__main__":
    logger.info(f"Démarrage du serveur sur {HOST}:{PORT}")
    uvicorn.run(
        "app:app",
        host=HOST,
        port=PORT,
        log_level="info",
        access_log=True
    )
