import { Component, ElementRef, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as d3 from 'd3';
import { Subject, takeUntil } from 'rxjs';
import { MindMapService } from './mindmap.service';
import { MindMapNode, MindMapEdge, MindMapState } from './mindmap.model';
import { RagService } from '../../../services/rag.service';

@Component({
  selector: 'app-mindmap',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mindmap.component.html',
  styleUrls: ['./mindmap.component.scss']
})
export class MindMapComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('svgContainer', { static: false }) svgContainer!: ElementRef<HTMLDivElement>;

  state: MindMapState = {
    data: null,
    selectedNode: null,
    loading: false,
    error: null,
    searchTerm: ''
  };

  searchQuery = '';
  private destroy$ = new Subject<void>();
  private svg: any;
  private simulation: any;
  private g: any;
  private width = 0;
  private height = 0;

  constructor(
    public mindMapService: MindMapService,
    private ragService: RagService
  ) {}

  ngOnInit(): void {
    // Subscribe to state changes
    this.mindMapService.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.state = state;
        if (state.data && this.svg) {
          this.renderGraph();
        }
      });

    // Auto-generate mind map from chat responses
    this.ragService.messages$
      .pipe(takeUntil(this.destroy$))
      .subscribe(messages => {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.content) {
          // Extract query from first sentence or content
          const query = lastMessage.content.split('.')[0] || lastMessage.content.substring(0, 100);
          
          // Auto-generate mind map
          this.generateMindMap(query);
        }
      });
  }

  ngAfterViewInit(): void {
    this.initSvg();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.simulation) {
      this.simulation.stop();
    }
  }

  /**
   * Initialize SVG canvas
   */
  private initSvg(): void {
    const container = this.svgContainer.nativeElement;
    this.width = container.clientWidth;
    this.height = container.clientHeight;

    // Create SVG
    this.svg = d3.select(container)
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height)
      .attr('class', 'mindmap-svg');

    // Create group for zoom/pan
    this.g = this.svg.append('g');

    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        this.g.attr('transform', event.transform);
      });

    this.svg.call(zoom);

    // Handle window resize
    window.addEventListener('resize', () => this.handleResize());
  }

  /**
   * Render force-directed graph
   */
  private renderGraph(): void {
    if (!this.state.data || !this.g) return;

    // Clear previous graph
    this.g.selectAll('*').remove();

    const nodes = [...this.state.data.nodes];
    const edges = this.state.data.edges.map(d => ({ ...d }));

    // Stop previous simulation
    if (this.simulation) {
      this.simulation.stop();
    }

    // Create force simulation
    this.simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(edges)
        .id((d: any) => d.id)
        .distance(150)
        .strength(0.5))
      .force('charge', d3.forceManyBody()
        .strength(-400)
        .distanceMax(400))
      .force('center', d3.forceCenter(this.width / 2, this.height / 2))
      .force('collision', d3.forceCollide().radius(60));

    // Create edges
    const link = this.g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(edges)
      .enter()
      .append('line')
      .attr('class', 'link')
      .attr('stroke-width', (d: any) => Math.sqrt(d.weight * 10))
      .style('opacity', (d: any) => 0.3 + d.weight * 0.7);

    // Create node groups
    const node = this.g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .call(this.drag(this.simulation));

    // Add circles to nodes (CERCLES clickables)
    node.append('circle')
      .attr('class', (d: any) => `node-circle node-level-${Math.min(d.clusterId || 0, 3)}`)
      .attr('r', 35)
      .on('click', (event: any, d: any) => this.onNodeClick(event, d))
      .on('mouseover', (event: any, d: any) => this.onNodeHover(event, d, true))
      .on('mouseout', (event: any, d: any) => this.onNodeHover(event, d, false));

    // Add labels to nodes (inside rectangles)
    node.append('text')
      .text((d: any) => this.truncateLabel(d.label, 25))
      .attr('class', 'node-label')
      .attr('text-anchor', 'middle')
      .attr('dy', 4)
      .style('pointer-events', 'none');

    // Add citation badges
    node.append('circle')
      .attr('class', 'citation-badge')
      .attr('r', 8)
      .attr('cx', (d: any) => this.calculateNodeWidth(d.label) / 2 - 5)
      .attr('cy', -12)
      .attr('fill', 'rgba(0, 0, 0, 0.2)')
      .style('display', (d: any) => d.citations && d.citations.length > 0 ? 'block' : 'none');

    node.append('text')
      .text((d: any) => d.citations ? d.citations.length : '')
      .attr('class', 'node-badge')
      .attr('x', (d: any) => this.calculateNodeWidth(d.label) / 2 - 5)
      .attr('y', -8)
      .attr('text-anchor', 'middle')
      .style('display', (d: any) => d.citations && d.citations.length > 0 ? 'block' : 'none');

    // Update positions on tick
    this.simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });
  }

  /**
   * Drag behavior for nodes
   */
  private drag(simulation: any): any {
    const dragstarted = (event: any): void => {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    };

    const dragged = (event: any): void => {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    };

    const dragended = (event: any): void => {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    };

    return d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended);
  }

  /**
   * Handle node click - Trigger AI analysis in chat
   */
  private onNodeClick(event: Event, node: MindMapNode): void {
    event.stopPropagation();
    
    // Select node to show details panel
    this.mindMapService.selectNode(node);
    
    // Generate intelligent prompt for AI analysis
    this.analyzeNodeInChat(node);
  }

  /**
   * Send node analysis request to chat
   */
  private analyzeNodeInChat(node: MindMapNode): void {
    // Build contextual prompt based on node data
    let prompt = `Analysez en détail le concept suivant :\n\n`;
    prompt += `📌 **${node.label}**\n\n`;
    
    if (node.summary) {
      prompt += `📄 Résumé : ${node.summary}\n\n`;
    }
    
    if (node.citations && node.citations.length > 0) {
      prompt += `📚 Basé sur ${node.citations.length} source(s) :\n`;
      node.citations.slice(0, 3).forEach((citation, i) => {
        prompt += `${i + 1}. ${citation.docTitle}${citation.page ? ` (page ${citation.page})` : ''}\n`;
      });
      prompt += `\n`;
    }
    
    prompt += `Fournissez une analyse approfondie incluant :\n`;
    prompt += `• Explication détaillée du concept\n`;
    prompt += `• Contexte et implications\n`;
    prompt += `• Liens avec d'autres concepts connexes\n`;
    prompt += `• Points clés à retenir`;
    
    // Send to RAG service for analysis
    this.ragService.askQuestion(prompt, 5).subscribe({
      next: (response) => {
        console.log('Node analysis completed:', response);
      },
      error: (error) => {
        console.error('Failed to analyze node:', error);
      }
    });
  }

  /**
   * Handle node hover
   */
  private onNodeHover(event: any, node: MindMapNode, isEnter: boolean): void {
    const rect = d3.select(event.target as any);
    
    if (isEnter) {
      rect
        .transition()
        .duration(200)
        .style('filter', 'drop-shadow(0 6px 20px rgba(0, 0, 0, 0.2))');
      
      // Highlight connected nodes
      this.highlightConnections(node.id, true);
    } else {
      rect
        .transition()
        .duration(200)
        .style('filter', 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.1))');
      
      this.highlightConnections(node.id, false);
    }
  }

  /**
   * Highlight connections for a node
   */
  private highlightConnections(nodeId: string, highlight: boolean): void {
    if (!this.state.data) return;

    const connectedNodeIds = new Set<string>();
    
    // Find connected nodes
    this.state.data.edges.forEach(edge => {
      const sourceId = typeof edge.source === 'string' ? edge.source : (edge.source as MindMapNode).id;
      const targetId = typeof edge.target === 'string' ? edge.target : (edge.target as MindMapNode).id;
      
      if (sourceId === nodeId) {
        connectedNodeIds.add(targetId);
      } else if (targetId === nodeId) {
        connectedNodeIds.add(sourceId);
      }
    });

    // Highlight edges
    this.g.selectAll('.link')
      .style('opacity', (d: any) => {
        const sourceId = typeof d.source === 'string' ? d.source : d.source.id;
        const targetId = typeof d.target === 'string' ? d.target : d.target.id;
        
        if (!highlight) {
          return 0.3 + d.weight * 0.7;
        }
        
        if (sourceId === nodeId || targetId === nodeId) {
          return 1;
        }
        return 0.1;
      });

    // Highlight connected node rectangles
    this.g.selectAll('.node-rect')
      .style('opacity', (d: any) => {
        if (!highlight) return 1;
        return d.id === nodeId || connectedNodeIds.has(d.id) ? 1 : 0.3;
      });
  }

  /**
   * Calculate node width based on label length
   */
  private calculateNodeWidth(label: string): number {
    // Base width calculation: ~8px per character, min 120px, max 250px
    const baseWidth = label.length * 8;
    return Math.max(120, Math.min(250, baseWidth + 32)); // +32 for padding
  }

  /**
   * Truncate label text
   */
  private truncateLabel(label: string, maxLength: number): string {
    return label.length > maxLength ? label.substring(0, maxLength) + '...' : label;
  }

  /**
   * Handle window resize
   */
  private handleResize(): void {
    if (!this.svgContainer) return;

    const container = this.svgContainer.nativeElement;
    this.width = container.clientWidth;
    this.height = container.clientHeight;

    if (this.svg) {
      this.svg
        .attr('width', this.width)
        .attr('height', this.height);
    }

    if (this.simulation) {
      this.simulation.force('center', d3.forceCenter(this.width / 2, this.height / 2));
      this.simulation.alpha(0.3).restart();
    }
  }

  /**
   * Handle search
   */
  onSearch(): void {
    const results = this.mindMapService.searchNodes(this.searchQuery);
    
    if (results.length > 0) {
      // Focus on first result
      this.focusOnNode(results[0]);
    }
  }

  /**
   * Focus on specific node
   */
  private focusOnNode(node: MindMapNode): void {
    if (!this.svg || !node.x || !node.y) return;

    const scale = 1.5;
    const x = -node.x * scale + this.width / 2;
    const y = -node.y * scale + this.height / 2;

    this.svg
      .transition()
      .duration(750)
      .call(
        d3.zoom().transform,
        d3.zoomIdentity.translate(x, y).scale(scale)
      );

    // Select the node
    this.mindMapService.selectNode(node);
  }

  /**
   * Reset graph view
   */
  resetView(): void {
    if (!this.svg) return;

    this.svg
      .transition()
      .duration(750)
      .call(
        d3.zoom().transform,
        d3.zoomIdentity
      );

    this.mindMapService.selectNode(null);
    this.searchQuery = '';
  }

  /**
   * Close details panel
   */
  closeDetails(): void {
    this.mindMapService.selectNode(null);
  }

  /**
   * Generate mind map from current query
   */
  generateMindMap(query: string): void {
    if (!query.trim()) return;
    
    this.mindMapService.generateFromQuery(query).subscribe({
      error: (error) => {
        console.error('Failed to generate mind map:', error);
      }
    });
  }
}
