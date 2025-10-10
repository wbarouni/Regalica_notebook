/**
 * MindMap data models
 */

export interface MindMapNode {
  id: string;
  label: string;
  summary: string;
  citations: Citation[];
  clusterId: number;
  chunkIds: string[];
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface MindMapEdge {
  source: string | MindMapNode;
  target: string | MindMapNode;
  weight: number;
}

export interface Citation {
  docId: string;
  docTitle: string;
  page?: number | null;
  spanStart: number;
  spanEnd: number;
  text: string;
}

export interface MindMapMeta {
  query?: string;
  docId?: string;
  topK: number;
  lang: string;
  chunksCount: number;
  nodesCount: number;
  edgesCount: number;
  clusteringMethod: string;
  silhouetteScore?: number;
  processingTimeMs: number;
}

export interface MindMapData {
  nodes: MindMapNode[];
  edges: MindMapEdge[];
  meta: MindMapMeta;
}

export interface MindMapState {
  data: MindMapData | null;
  selectedNode: MindMapNode | null;
  loading: boolean;
  error: string | null;
  searchTerm: string;
}
