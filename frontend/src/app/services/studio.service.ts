import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface MindMapNode {
  id: string;
  label: string;
  summary: string;
  citations: Citation[];
  clusterId: number;
  level?: number;  // NEW: Hierarchical level (1=central, 2=branches, 3=details, 4=sub)
  position?: { x: number; y: number };
}

export interface MindMapEdge {
  source: string;
  target: string;
  weight: number;
}

export interface Citation {
  docId: string;
  docTitle: string;
  page?: number;
  spanStart: number;
  spanEnd: number;
  text: string;
}

export interface MindMapData {
  nodes: MindMapNode[];
  edges: MindMapEdge[];
  meta: {
    query?: string;
    docId?: string;
    notebookId?: string;  // NEW: Track which notebook generated this
    topK: number;
    lang: string;
    chunksCount: number;
    nodesCount: number;
    edgesCount: number;
    clusteringMethod: string;
    silhouetteScore: number;
    processingTimeMs: number;
  };
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  confidential: boolean;
  ends_at?: string;
  created_at: string;
  updated_at: string;
  members?: WorkspaceMember[];
  documents?: WorkspaceDocument[];
  metrics?: WorkspaceMetrics;
}

export interface WorkspaceMember {
  user_id: string;
  role: 'admin' | 'editor' | 'viewer';
  joined_at: string;
}

export interface WorkspaceDocument {
  document_id: string;
  quarantined: boolean;
  quarantine_reason?: string;
  added_at: string;
  title: string;
  mime: string;
  bytes: number;
}

export interface WorkspaceMetrics {
  total_members: number;
  total_documents: number;
  quarantined_documents: number;
  quarantine_rate: number;
  guardian_alerts: {
    info?: number;
    warning?: number;
    critical?: number;
  };
}

export interface GuardianScanResult {
  hasSecrets: boolean;
  hasPII: boolean;
  matches: Array<{
    pattern: string;
    value: string;
    index: number;
    severity: 'info' | 'warning' | 'critical';
    description: string;
  }>;
  summary: {
    total: number;
    critical: number;
    warning: number;
    info: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class StudioService {
  private readonly apiUrl = '/api/studio';

  constructor(private http: HttpClient) {}

  // ============================================
  // Mind Map Methods
  // ============================================

  /**
   * Generate mind map from query, document, or notebook (DYNAMIC - NO HARDCODING)
   */
  generateMindMap(params: {
    query?: string;
    docId?: string;
    notebookId?: string;  // NEW: Notebook isolation support
    topK?: number;
    lang?: string;
  }): Observable<MindMapData> {
    const queryParams = new URLSearchParams();
    
    if (params.query) queryParams.append('query', params.query);
    if (params.docId) queryParams.append('docId', params.docId);
    if (params.notebookId) queryParams.append('notebookId', params.notebookId);
    if (params.topK) queryParams.append('topK', params.topK.toString());
    if (params.lang) queryParams.append('lang', params.lang);
    
    return this.http.get<MindMapData>(
      `${this.apiUrl}/mindmap?${queryParams.toString()}`
    );
  }

  /**
   * Save mind map to database
   */
  saveMindMap(
    mindMapData: MindMapData,
    workspaceId?: string,
    createdBy?: string
  ): Observable<{ mindMapId: string; message: string }> {
    return this.http.post<{ mindMapId: string; message: string }>(
      `${this.apiUrl}/mindmap`,
      { mindMapData, workspaceId, createdBy }
    );
  }

  // ============================================
  // Workspace Methods
  // ============================================

  /**
   * List all workspaces (optionally for a specific user)
   */
  listWorkspaces(userId?: string): Observable<{ workspaces: Workspace[] }> {
    const params = userId ? `?userId=${userId}` : '';
    return this.http.get<{ workspaces: Workspace[] }>(
      `${this.apiUrl}/workspaces${params}`
    );
  }

  /**
   * Create workspace from natural language prompt
   */
  createWorkspace(
    prompt: string,
    createdBy?: string
  ): Observable<{
    workspace: Workspace;
    parsed: any;
    message: string;
  }> {
    return this.http.post<any>(
      `${this.apiUrl}/workspaces/create`,
      { prompt, createdBy }
    );
  }

  /**
   * Get workspace details with members and metrics
   */
  getWorkspace(workspaceId: string): Observable<Workspace> {
    return this.http.get<Workspace>(
      `${this.apiUrl}/workspaces/${workspaceId}`
    );
  }

  /**
   * Add member to workspace
   */
  addMember(
    workspaceId: string,
    userId: string,
    role: 'admin' | 'editor' | 'viewer',
    addedBy: string
  ): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.apiUrl}/workspaces/${workspaceId}/members`,
      { userId, role, addedBy }
    );
  }

  /**
   * Update member role
   */
  updateMemberRole(
    workspaceId: string,
    userId: string,
    newRole: 'admin' | 'editor' | 'viewer',
    updatedBy: string
  ): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(
      `${this.apiUrl}/workspaces/${workspaceId}/members/${userId}`,
      { newRole, updatedBy }
    );
  }

  /**
   * Remove member from workspace
   */
  removeMember(
    workspaceId: string,
    userId: string,
    removedBy: string
  ): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.apiUrl}/workspaces/${workspaceId}/members/${userId}?removedBy=${removedBy}`
    );
  }

  // ============================================
  // Guardian Methods
  // ============================================

  /**
   * Scan text for PII/secrets
   */
  scanText(text: string): Observable<GuardianScanResult> {
    return this.http.post<GuardianScanResult>(
      `${this.apiUrl}/guardian/scan`,
      { text }
    );
  }

  /**
   * Get quarantined documents for a workspace
   */
  getQuarantinedDocuments(
    workspaceId: string
  ): Observable<{ documents: WorkspaceDocument[] }> {
    return this.http.get<{ documents: WorkspaceDocument[] }>(
      `${this.apiUrl}/guardian/quarantined/${workspaceId}`
    );
  }

  /**
   * Get Guardian detection patterns
   */
  getGuardianPatterns(): Observable<{ patterns: any }> {
    return this.http.get<{ patterns: any }>(
      `${this.apiUrl}/guardian/patterns`
    );
  }

  // ============================================
  // Health Check
  // ============================================

  /**
   * Check Studio features health
   */
  healthCheck(): Observable<{
    status: string;
    features: Record<string, boolean>;
    timestamp: string;
  }> {
    return this.http.get<any>(`${this.apiUrl}/health`);
  }
}
