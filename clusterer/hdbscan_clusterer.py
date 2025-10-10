"""
HDBSCAN-based clustering with KMeans fallback for mind map node generation.
"""
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
import hdbscan
from typing import List, Dict, Tuple, Optional
import logging

logger = logging.getLogger(__name__)


class TextClusterer:
    """Clusters text using HDBSCAN with KMeans fallback."""
    
    def __init__(
        self,
        min_cluster_size: int = 5,
        min_samples: int = 5,
        metric: str = "cosine",
        reduce_dim: int = 50
    ):
        self.min_cluster_size = min_cluster_size
        self.min_samples = min_samples
        self.metric = metric
        self.reduce_dim = reduce_dim
        self.vectorizer = TfidfVectorizer(
            max_features=1000,
            stop_words='english',
            ngram_range=(1, 2),
            min_df=1
        )
    
    def cluster(
        self,
        texts: List[str]
    ) -> Dict[str, any]:
        """
        Cluster texts using HDBSCAN, fallback to KMeans if needed.
        
        Args:
            texts: List of text strings to cluster
            
        Returns:
            Dict with clusters, labels, method, and metrics
        """
        if len(texts) < 2:
            logger.warning("Too few texts to cluster")
            return {
                "clusters": [0] * len(texts),
                "labels": ["Cluster 0"] * len(texts),
                "n_clusters": 1,
                "silhouette_score": 0.0,
                "method": "single",
                "noise_points": 0
            }
        
        # Vectorize texts
        try:
            X = self.vectorizer.fit_transform(texts)
            X_dense = X.toarray()
        except Exception as e:
            logger.error(f"Vectorization failed: {e}")
            return self._single_cluster_fallback(len(texts))
        
        # Dimensionality reduction if needed
        if X_dense.shape[1] > self.reduce_dim and X_dense.shape[0] > self.reduce_dim:
            pca = PCA(n_components=min(self.reduce_dim, X_dense.shape[0] - 1))
            X_reduced = pca.fit_transform(X_dense)
            logger.info(f"Reduced dimensions from {X_dense.shape[1]} to {X_reduced.shape[1]}")
        else:
            X_reduced = X_dense
        
        # Try HDBSCAN first
        try:
            result = self._try_hdbscan(X_reduced, texts)
            if result["n_clusters"] >= 2:
                logger.info(f"HDBSCAN succeeded with {result['n_clusters']} clusters")
                return result
            else:
                logger.info("HDBSCAN produced <2 clusters, trying KMeans fallback")
        except Exception as e:
            logger.warning(f"HDBSCAN failed: {e}, trying KMeans fallback")
        
        # Fallback to KMeans
        return self._try_kmeans(X_reduced, texts)
    
    def _try_hdbscan(self, X: np.ndarray, texts: List[str]) -> Dict[str, any]:
        """Try HDBSCAN clustering."""
        clusterer = hdbscan.HDBSCAN(
            min_cluster_size=self.min_cluster_size,
            min_samples=self.min_samples,
            metric=self.metric,
            cluster_selection_method='eom'
        )
        
        labels = clusterer.fit_predict(X)
        
        # Count clusters (excluding noise -1)
        unique_labels = set(labels)
        n_clusters = len([l for l in unique_labels if l != -1])
        noise_points = list(labels).count(-1)
        
        # Calculate silhouette score (excluding noise)
        non_noise_mask = labels != -1
        if n_clusters >= 2 and np.sum(non_noise_mask) > 1:
            try:
                sil_score = silhouette_score(
                    X[non_noise_mask],
                    labels[non_noise_mask],
                    metric=self.metric
                )
            except Exception:
                sil_score = 0.0
        else:
            sil_score = 0.0
        
        # Generate cluster labels
        cluster_labels = self._generate_cluster_labels(texts, labels, n_clusters)
        
        return {
            "clusters": labels.tolist(),
            "labels": cluster_labels,
            "n_clusters": n_clusters,
            "silhouette_score": float(sil_score),
            "method": "hdbscan",
            "noise_points": noise_points
        }
    
    def _try_kmeans(self, X: np.ndarray, texts: List[str]) -> Dict[str, any]:
        """Fallback to KMeans with optimal k selection."""
        n_samples = X.shape[0]
        
        # Calculate optimal k
        k_max = min(8, max(2, int(np.sqrt(n_samples / 2))))
        k_min = 2
        
        best_k = k_min
        best_score = -1
        best_labels = None
        
        # Try different k values and pick best silhouette score
        for k in range(k_min, k_max + 1):
            if k >= n_samples:
                break
            
            kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
            labels = kmeans.fit_predict(X)
            
            try:
                score = silhouette_score(X, labels, metric='euclidean')
                if score > best_score:
                    best_score = score
                    best_k = k
                    best_labels = labels
            except Exception:
                continue
        
        if best_labels is None:
            logger.warning("KMeans failed, using single cluster")
            return self._single_cluster_fallback(n_samples)
        
        # Generate cluster labels
        cluster_labels = self._generate_cluster_labels(texts, best_labels, best_k)
        
        logger.info(f"KMeans selected k={best_k} with silhouette={best_score:.3f}")
        
        return {
            "clusters": best_labels.tolist(),
            "labels": cluster_labels,
            "n_clusters": best_k,
            "silhouette_score": float(best_score),
            "method": "kmeans",
            "noise_points": 0
        }
    
    def _generate_cluster_labels(
        self,
        texts: List[str],
        clusters: np.ndarray,
        n_clusters: int
    ) -> List[str]:
        """Generate descriptive labels for each cluster."""
        cluster_labels = []
        
        for cluster_id in range(n_clusters):
            # Find texts in this cluster
            cluster_mask = clusters == cluster_id
            cluster_texts = [texts[i] for i in range(len(texts)) if cluster_mask[i]]
            
            if cluster_texts:
                # Extract most common terms
                try:
                    vectorizer = TfidfVectorizer(max_features=3, stop_words='english')
                    vectorizer.fit(cluster_texts)
                    top_terms = vectorizer.get_feature_names_out()
                    label = " + ".join(top_terms[:2])
                except Exception:
                    label = f"Cluster {cluster_id}"
            else:
                label = f"Cluster {cluster_id}"
            
            cluster_labels.append(label)
        
        # Map cluster IDs to labels for all texts
        result_labels = []
        for cluster_id in clusters:
            if cluster_id == -1:
                result_labels.append("Noise")
            else:
                result_labels.append(cluster_labels[cluster_id])
        
        return result_labels
    
    def _single_cluster_fallback(self, n: int) -> Dict[str, any]:
        """Return single cluster result."""
        return {
            "clusters": [0] * n,
            "labels": ["Main Cluster"] * n,
            "n_clusters": 1,
            "silhouette_score": 0.0,
            "method": "fallback",
            "noise_points": 0
        }
