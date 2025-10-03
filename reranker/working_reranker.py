#!/usr/bin/env python3
"""
Working reranker service
"""
import os
import time
import random
from typing import List
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Working Reranker")

class RerankRequest(BaseModel):
    query: str
    candidates: List[str]

class RerankResponse(BaseModel):
    scores: List[float]
    processing_time_ms: int
    model: str

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model": "mock-reranker",
        "timestamp": time.time()
    }

@app.post("/rerank")
def rerank(request: RerankRequest):
    start_time = time.time()
    
    # Generate mock scores based on text similarity
    scores = []
    query_words = set(request.query.lower().split())
    
    for candidate in request.candidates:
        if not candidate or not candidate.strip():
            scores.append(0.0)
            continue
            
        candidate_words = set(candidate.lower().split())
        common_words = len(query_words.intersection(candidate_words))
        base_score = min(common_words / max(len(query_words), 1), 1.0)
        
        # Add randomness and normalize
        random_factor = random.uniform(0.1, 0.9)
        final_score = (base_score * 0.7 + random_factor * 0.3)
        scores.append(final_score)
    
    processing_time = int((time.time() - start_time) * 1000)
    
    return RerankResponse(
        scores=scores,
        processing_time_ms=processing_time,
        model="mock-reranker"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001, log_level="info")

