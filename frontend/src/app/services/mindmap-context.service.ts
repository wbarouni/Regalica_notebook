import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { NodeContext } from './node-context.model';

@Injectable({ providedIn: 'root' })
export class MindMapContextService {
  private readonly apiUrl = '/api/studio/mindmap';
  private contextCache = new Map<string, NodeContext>();
  
  constructor(private http: HttpClient) {}
  
  /**
   * Get full context for a node
   */
  async getNodeContext(nodeId: string, notebookId?: string): Promise<NodeContext> {
    const cacheKey = `${nodeId}-${notebookId || 'default'}`;
    
    // Check cache first
    if (this.contextCache.has(cacheKey)) {
      return this.contextCache.get(cacheKey)!;
    }
    
    try {
      const params: any = {};
      if (notebookId) {
        params.notebookId = notebookId;
      }
      
      const response = await firstValueFrom(
        this.http.get<NodeContext>(`${this.apiUrl}/node/${nodeId}/context`, { params })
      );
      
      // Cache the response
      this.contextCache.set(cacheKey, response);
      
      return response;
    } catch (error: any) {
      throw new Error(error.error?.error || 'Failed to load node context');
    }
  }
  
  /**
   * Clear cache for a specific node or all nodes
   */
  clearCache(nodeId?: string) {
    if (nodeId) {
      // Clear all cache entries for this node
      const keysToDelete: string[] = [];
      this.contextCache.forEach((_, key) => {
        if (key.startsWith(nodeId)) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => this.contextCache.delete(key));
    } else {
      this.contextCache.clear();
    }
  }
}
