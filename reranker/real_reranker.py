#!/usr/bin/env python3
"""
Real reranker service using Ollama for cross-encoding
"""
import os
import time
import logging
import requests
import json
from typing import List
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
OLLAMA_URL = os.getenv('OLLAMA_URL', 'http://localhost:11434')
RERANK_MODEL = os.getenv('RERANK_MODEL', 'qwen2:7b-instruct')  # Use powerful LLM for reranking
HOST = os.getenv('HOST', '127.0.0.1')
PORT = int(os.getenv('PORT', 8001))

# Application FastAPI
app = FastAPI(
    title="Real Ollama Reranker",
    description="Real reranking service using Ollama LLM",
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
    try:
        response = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        if response.status_code == 200:
            return {
                "status": "healthy",
                "model": RERANK_MODEL,
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
        "model_name": RERANK_MODEL,
        "ollama_url": OLLAMA_URL,
        "model_type": "llm_reranker",
        "type": "real_reranking"
    }

def create_rerank_prompt(query: str, candidate: str) -> str:
    """Create a prompt for LLM-based reranking"""
    return f"""Rate the relevance of the following document to the query on a scale of 0.0 to 1.0.

Query: {query}

Document: {candidate}

Respond with only a number between 0.0 and 1.0 representing the relevance score:"""

@app.post("/rerank", response_model=RerankResponse)
async def rerank_candidates(request: RerankRequest):
    """Réordonne les candidats selon leur pertinence via Ollama LLM"""
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Requête vide")
    
    if not request.candidates:
        raise HTTPException(status_code=400, detail="Liste de candidats vide")
    
    if len(request.candidates) > 20:  # Limit for LLM processing
        raise HTTPException(status_code=400, detail="Trop de candidats (max 20)")
    
    start_time = time.time()
    
    try:
        logger.info(f"Reranking {len(request.candidates)} candidates using {RERANK_MODEL}")
        
        scores = []
        
        # Process each candidate
        for i, candidate in enumerate(request.candidates):
            if not candidate or not candidate.strip():
                scores.append(0.0)
                continue
            
            # Create reranking prompt
            prompt = create_rerank_prompt(request.query, candidate.strip())
            
            # Call Ollama
            response = requests.post(
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model": RERANK_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.1,
                        "top_p": 0.9,
                        "max_tokens": 10
                    }
                },
                timeout=30
            )
            
            if response.status_code != 200:
                logger.warning(f"Ollama request failed for candidate {i}: {response.text}")
                scores.append(0.5)  # Default score
                continue
            
            result = response.json()
            generated_text = result.get("response", "0.5").strip()
            
            # Extract score from response
            try:
                # Try to extract a number from the response
                score_text = generated_text.split('\n')[0].strip()
                score = float(score_text)
                score = max(0.0, min(1.0, score))  # Clamp between 0 and 1
            except (ValueError, IndexError):
                logger.warning(f"Could not parse score from: {generated_text}")
                score = 0.5  # Default score
            
            scores.append(score)
            logger.debug(f"Candidate {i}: score={score}")
        
        processing_time = int((time.time() - start_time) * 1000)
        
        logger.info(f"Reranking completed: {len(scores)} scores in {processing_time}ms")
        logger.info(f"Score range: {min(scores):.3f} - {max(scores):.3f}")
        
        return RerankResponse(
            scores=scores,
            processing_time_ms=processing_time,
            model=RERANK_MODEL
        )
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Ollama request failed: {e}")
        raise HTTPException(status_code=503, detail=f"Ollama service unavailable: {str(e)}")
    except Exception as e:
        logger.error(f"Reranking failed: {e}")
        raise HTTPException(status_code=500, detail=f"Reranking failed: {str(e)}")

if __name__ == "__main__":
    logger.info(f"Starting real Ollama reranker on {HOST}:{PORT}")
    logger.info(f"Using model: {RERANK_MODEL}")
    logger.info(f"Ollama URL: {OLLAMA_URL}")
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")
