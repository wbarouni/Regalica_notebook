/**
 * Node Context Models for Mind Map Modal
 */

export interface NodeContext {
  nodeId: string;
  label: string;
  summary: string;
  fullSummary: string;
  citations: Citation[];
  relatedNodes: RelatedNode[];
  suggestedQuestions: string[];
  chunkCount: number;
  metadata: {
    clusterId: number;
    level: number;
  };
}

export interface Citation {
  docId: string;
  docTitle: string;
  page?: number;
  spanStart: number;
  spanEnd: number;
  text: string;
}

export interface RelatedNode {
  id: string;
  label: string;
  similarity: number;
}
