import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface MindMapData {
  id: string;
  query: string;
  timestamp: Date;
  nodes: any[];
  connections: any[];
  sourceMessageId?: string;
  notebookId?: string;
}

@Injectable({ providedIn: 'root' })
export class MindMapStateService {
  private readonly STORAGE_KEY = 'mindmap_history';
  private readonly MAX_HISTORY = 10;
  
  private mindMapSubject = new BehaviorSubject<MindMapData | null>(null);
  mindMap$: Observable<MindMapData | null> = this.mindMapSubject.asObservable();
  
  private historySubject = new BehaviorSubject<MindMapData[]>([]);
  history$: Observable<MindMapData[]> = this.historySubject.asObservable();
  
  constructor() {
    this.loadHistoryFromStorage();
  }
  
  /**
   * Set the current active mind map
   */
  setCurrentMindMap(data: MindMapData): void {
    this.mindMapSubject.next(data);
  }
  
  /**
   * Get the current active mind map
   */
  getCurrentMindMap(): MindMapData | null {
    return this.mindMapSubject.value;
  }
  
  /**
   * Add a mind map to history
   */
  addToHistory(data: MindMapData): void {
    const currentHistory = this.historySubject.value;
    
    // Check if already exists (by id or sourceMessageId)
    const existingIndex = currentHistory.findIndex(
      m => m.id === data.id || (m.sourceMessageId && m.sourceMessageId === data.sourceMessageId)
    );
    
    let newHistory: MindMapData[];
    if (existingIndex >= 0) {
      // Update existing
      newHistory = [...currentHistory];
      newHistory[existingIndex] = data;
    } else {
      // Add new at beginning
      newHistory = [data, ...currentHistory];
      
      // Keep only MAX_HISTORY items
      if (newHistory.length > this.MAX_HISTORY) {
        newHistory = newHistory.slice(0, this.MAX_HISTORY);
      }
    }
    
    this.historySubject.next(newHistory);
    this.saveHistoryToStorage(newHistory);
  }
  
  /**
   * Get history list
   */
  getHistory(): MindMapData[] {
    return this.historySubject.value;
  }
  
  /**
   * Get a specific mind map from history by ID
   */
  getFromHistory(id: string): MindMapData | null {
    return this.historySubject.value.find(m => m.id === id) || null;
  }
  
  /**
   * Remove a mind map from history
   */
  removeFromHistory(id: string): void {
    const currentHistory = this.historySubject.value;
    const newHistory = currentHistory.filter(m => m.id !== id);
    this.historySubject.next(newHistory);
    this.saveHistoryToStorage(newHistory);
  }
  
  /**
   * Clear all history
   */
  clearHistory(): void {
    this.historySubject.next([]);
    this.saveHistoryToStorage([]);
  }
  
  /**
   * Clear current mind map (without removing from history)
   */
  clearCurrent(): void {
    this.mindMapSubject.next(null);
  }
  
  /**
   * Save history to localStorage
   */
  private saveHistoryToStorage(history: MindMapData[]): void {
    try {
      // Convert dates to ISO strings for storage
      const serialized = history.map(m => ({
        ...m,
        timestamp: m.timestamp.toISOString()
      }));
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(serialized));
    } catch (error) {
      console.error('Failed to save mind map history to storage:', error);
    }
  }
  
  /**
   * Load history from localStorage
   */
  private loadHistoryFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert ISO strings back to Date objects
        const history = parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }));
        this.historySubject.next(history);
      }
    } catch (error) {
      console.error('Failed to load mind map history from storage:', error);
      this.historySubject.next([]);
    }
  }
}
