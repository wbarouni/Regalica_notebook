"""
FastAPI microservice for text clustering using HDBSCAN/KMeans.
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import logging
import os

from hdbscan_clusterer import TextClusterer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Clusterer Service",
    description="Text clustering microservice for mind map generation",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load configuration from environment
MIN_CLUSTER_SIZE = int(os.getenv("MIN_CLUSTER_SIZE", "5"))
MIN_SAMPLES = int(os.getenv("MIN_SAMPLES", "5"))
METRIC = os.getenv("METRIC", "cosine")
REDUCE_DIM = int(os.getenv("REDUCE_DIM", "50"))

# Initialize clusterer
clusterer = TextClusterer(
    min_cluster_size=MIN_CLUSTER_SIZE,
    min_samples=MIN_SAMPLES,
    metric=METRIC,
    reduce_dim=REDUCE_DIM
)

logger.info(f"Clusterer initialized with min_cluster_size={MIN_CLUSTER_SIZE}, "
            f"min_samples={MIN_SAMPLES}, metric={METRIC}, reduce_dim={REDUCE_DIM}")


# Request/Response models
class ClusterRequest(BaseModel):
    """Request model for clustering."""
    texts: List[str] = Field(..., min_items=1, description="List of texts to cluster")
    min_cluster_size: Optional[int] = Field(None, ge=2, le=100, description="Override min cluster size")
    min_samples: Optional[int] = Field(None, ge=1, le=100, description="Override min samples")
    metric: Optional[str] = Field(None, description="Distance metric (cosine, euclidean)")


class ClusterResponse(BaseModel):
    """Response model for clustering."""
    clusters: List[int] = Field(..., description="Cluster assignment for each text")
    labels: List[str] = Field(..., description="Descriptive label for each text's cluster")
    n_clusters: int = Field(..., description="Number of clusters found")
    silhouette_score: float = Field(..., description="Quality metric (-1 to 1)")
    method: str = Field(..., description="Method used (hdbscan, kmeans, fallback)")
    noise_points: int = Field(..., description="Number of noise points (for HDBSCAN)")


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    service: str
    version: str


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "clusterer",
        "version": "1.0.0"
    }


@app.post("/cluster", response_model=ClusterResponse)
async def cluster_texts(request: ClusterRequest):
    """
    Cluster texts using HDBSCAN with KMeans fallback.
    
    Args:
        request: ClusterRequest with texts and optional parameters
        
    Returns:
        ClusterResponse with cluster assignments and metadata
    """
    if not request.texts:
        raise HTTPException(status_code=400, detail="No texts provided")
    
    if len(request.texts) > 1000:
        raise HTTPException(status_code=400, detail="Too many texts (max 1000)")
    
    try:
        # Create clusterer with request-specific parameters if provided
        if request.min_cluster_size or request.min_samples or request.metric:
            temp_clusterer = TextClusterer(
                min_cluster_size=request.min_cluster_size or MIN_CLUSTER_SIZE,
                min_samples=request.min_samples or MIN_SAMPLES,
                metric=request.metric or METRIC,
                reduce_dim=REDUCE_DIM
            )
            result = temp_clusterer.cluster(request.texts)
        else:
            result = clusterer.cluster(request.texts)
        
        logger.info(f"Clustered {len(request.texts)} texts into {result['n_clusters']} "
                   f"clusters using {result['method']}")
        
        return ClusterResponse(**result)
    
    except Exception as e:
        logger.error(f"Clustering failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Clustering failed: {str(e)}")


@app.get("/")
async def root():
    """Root endpoint with service info."""
    return {
        "service": "clusterer",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "cluster": "/cluster (POST)"
        },
        "config": {
            "min_cluster_size": MIN_CLUSTER_SIZE,
            "min_samples": MIN_SAMPLES,
            "metric": METRIC,
            "reduce_dim": REDUCE_DIM
        }
    }


if __name__ == "__main__":
    import uvicorn
    
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8002"))
    
    logger.info(f"Starting clusterer service on {host}:{port}")
    
    uvicorn.run(
        "app:app",
        host=host,
        port=port,
        log_level="info",
        access_log=True
    )
