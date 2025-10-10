import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { AppConfigService } from '../core/services/app-config.service';

export interface SocketEvent<T = any> {
  event: string;
  data: T;
}

export interface MindMapUpdate {
  nodeId: string;
  updates: {
    label?: string;
    summary?: string;
    position?: { x: number; y: number };
  };
  version?: number;
  updatedBy?: string;
  timestamp?: string;
}

export interface MindMapConflict {
  nodeId: string;
  currentVersion: number;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class SocketService implements OnDestroy {
  private socket: Socket | null = null;
  private connected$ = new BehaviorSubject<boolean>(false);
  private events$ = new Subject<SocketEvent>();
  
  // Mind map specific subjects
  private nodeUpdated$ = new Subject<MindMapUpdate>();
  private nodeAdded$ = new Subject<any>();
  private nodeDeleted$ = new Subject<{ nodeId: string; deletedBy?: string }>();
  private nodeMoved$ = new Subject<{ nodeId: string; position: { x: number; y: number }; movedBy?: string }>();
  private conflict$ = new Subject<MindMapConflict>();
  private userJoined$ = new Subject<{ userId: string; socketId: string }>();
  private userLeft$ = new Subject<{ userId: string; socketId: string }>();

  constructor(private appConfig: AppConfigService) {}

  /**
   * Connect to Socket.IO server
   */
  async connect(): Promise<void> {
    if (this.socket?.connected) {
      return;
    }

    const config = await this.appConfig.getConfig();
    const socketUrl = config.backendBaseUrl || 'http://localhost:5200';

    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    this.setupEventListeners();
  }

  /**
   * Disconnect from Socket.IO server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected$.next(false);
    }
  }

  /**
   * Setup Socket.IO event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[Socket.IO] Connected:', this.socket?.id);
      this.connected$.next(true);
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('[Socket.IO] Disconnected:', reason);
      this.connected$.next(false);
    });

    this.socket.on('error', (error: Error) => {
      console.error('[Socket.IO] Error:', error);
      this.events$.next({ event: 'error', data: error });
    });

    // Mind map events
    this.socket.on('mindmap:joined', (data: unknown) => {
      console.log('[Socket.IO] Joined mind map:', data);
      this.events$.next({ event: 'mindmap:joined', data });
    });

    this.socket.on('mindmap:node_updated', (data: MindMapUpdate) => {
      this.nodeUpdated$.next(data);
    });

    this.socket.on('mindmap:node_added', (data: unknown) => {
      this.nodeAdded$.next(data);
    });

    this.socket.on('mindmap:node_deleted', (data: { nodeId: string; deletedBy?: string }) => {
      this.nodeDeleted$.next(data);
    });

    this.socket.on('mindmap:node_moved', (data: { nodeId: string; position: { x: number; y: number }; movedBy?: string }) => {
      this.nodeMoved$.next(data);
    });

    this.socket.on('mindmap:conflict', (data: MindMapConflict) => {
      this.conflict$.next(data);
    });

    this.socket.on('mindmap:user_joined', (data: { userId: string; socketId: string }) => {
      this.userJoined$.next(data);
    });

    this.socket.on('mindmap:user_left', (data: { userId: string; socketId: string }) => {
      this.userLeft$.next(data);
    });

    this.socket.on('mindmap:update_confirmed', (data: unknown) => {
      this.events$.next({ event: 'mindmap:update_confirmed', data });
    });
  }

  /**
   * Join a mind map room
   */
  joinMindMap(mindmapId: string, userId: string): void {
    if (!this.socket) {
      console.error('[Socket.IO] Not connected');
      return;
    }

    this.socket.emit('mindmap:join', { mindmapId, userId });
  }

  /**
   * Leave a mind map room
   */
  leaveMindMap(): void {
    if (!this.socket) return;
    this.socket.emit('mindmap:leave');
  }

  /**
   * Update a node
   */
  updateNode(
    mindmapId: string,
    nodeId: string,
    updates: { label?: string; summary?: string; position?: { x: number; y: number } },
    version?: number
  ): void {
    if (!this.socket) return;
    this.socket.emit('mindmap:update_node', { mindmapId, nodeId, updates, version });
  }

  /**
   * Add a new node
   */
  addNode(mindmapId: string, node: any): void {
    if (!this.socket) return;
    this.socket.emit('mindmap:add_node', { mindmapId, node });
  }

  /**
   * Delete a node
   */
  deleteNode(mindmapId: string, nodeId: string): void {
    if (!this.socket) return;
    this.socket.emit('mindmap:delete_node', { mindmapId, nodeId });
  }

  /**
   * Move a node (optimistic position update)
   */
  moveNode(mindmapId: string, nodeId: string, position: { x: number; y: number }): void {
    if (!this.socket) return;
    this.socket.emit('mindmap:move_node', { mindmapId, nodeId, position });
  }

  // ============================================
  // Observables for components to subscribe to
  // ============================================

  get isConnected$(): Observable<boolean> {
    return this.connected$.asObservable();
  }

  get events(): Observable<SocketEvent> {
    return this.events$.asObservable();
  }

  get nodeUpdated(): Observable<MindMapUpdate> {
    return this.nodeUpdated$.asObservable();
  }

  get nodeAdded(): Observable<any> {
    return this.nodeAdded$.asObservable();
  }

  get nodeDeleted(): Observable<{ nodeId: string; deletedBy?: string }> {
    return this.nodeDeleted$.asObservable();
  }

  get nodeMoved(): Observable<{ nodeId: string; position: { x: number; y: number }; movedBy?: string }> {
    return this.nodeMoved$.asObservable();
  }

  get conflict(): Observable<MindMapConflict> {
    return this.conflict$.asObservable();
  }

  get userJoined(): Observable<{ userId: string; socketId: string }> {
    return this.userJoined$.asObservable();
  }

  get userLeft(): Observable<{ userId: string; socketId: string }> {
    return this.userLeft$.asObservable();
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.connected$.complete();
    this.events$.complete();
    this.nodeUpdated$.complete();
    this.nodeAdded$.complete();
    this.nodeDeleted$.complete();
    this.nodeMoved$.complete();
    this.conflict$.complete();
    this.userJoined$.complete();
    this.userLeft$.complete();
  }
}
