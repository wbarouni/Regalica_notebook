#!/usr/bin/env python3
"""
Working embedder service
"""
import os
import time
import random
from typing import List
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Working Embedder")

class EmbedRequest(BaseModel):
    texts: List[str]

class EmbedResponse(BaseModel):
    vectors: List[List[float]]
    dim: int
    model: str
    processing_time_ms: int

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model": "mock-embedder",
        "dimension": 1024,
        "timestamp": time.time()
    }

@app.post("/embed")
def embed(request: EmbedRequest):
    start_time = time.time()
    
    vectors = []
    for text in request.texts:
        # Create normalized random vector
        vector = [random.gauss(0, 0.1) for _ in range(1024)]
        norm = sum(x*x for x in vector) ** 0.5
        if norm > 0:
            vector = [x/norm for x in vector]
        vectors.append(vector)
    
    processing_time = int((time.time() - start_time) * 1000)
    
    return EmbedResponse(
        vectors=vectors,
        dim=1024,
        model="mock-embedder",
        processing_time_ms=processing_time
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")

