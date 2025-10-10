# Regalica Notebook Architecture

## System Overview

Regalica Notebook is a modern Retrieval-Augmented Generation (RAG) system with advanced Magic Studio features for document analysis and content generation.

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│                    (Angular 18 + TailwindCSS)               │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/WebSocket
┌──────────────────────▼──────────────────────────────────────┐
│                      Backend API                             │
│                    (Node.js/Express)                         │
├──────────────────────┬──────────────────────────────────────┤
│  - Ingest Routes     │  - RAG Routes   │  - Studio Routes   │
│  - Model Management  │  - WebSocket    │  - Config API      │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┬───────────────┐
        │              │              │               │
┌───────▼──────┐ ┌────▼─────┐ ┌──────▼──────┐ ┌─────▼──────┐
│  PostgreSQL  │ │ Embedder │ │  Reranker   │ │   Ollama   │
│  (pgvector)  │ │  Service │ │   Service   │ │    (LLM)   │
└──────────────┘ └──────────┘ └─────────────┘ └────────────┘
                                                      │
                                            ┌─────────▼────────┐
                                            │    Clusterer     │
                                            │ (Mind Map Gen)   │
                                            └──────────────────┘
```

## Service Details

### 1. Frontend (Angular 18)

**Technology Stack:**
- Angular 18 with standalone components
- TailwindCSS for styling
- RxJS for reactive programming
- TypeScript with strict mode enabled

**Key Features:**
- Document upload and management
- Real-time RAG query interface
- Magic Studio panel with three tabs:
  - Mind Map: Visual topic clustering
  - Podcast: Audio content generation
  - Actions: Contextual action suggestions
- Responsive design with mobile support
- WebSocket integration for real-time updates

**Directory Structure:**
```
frontend/src/app/
├── chat/               # Chat interface components
├── core/              # Core services and utilities
├── features/          # Feature modules
├── layout/            # Layout components
└── services/          # API and business logic services
```

### 2. Backend API (Node.js)

**Technology Stack:**
- Node.js v18+
- Express.js web framework
- Socket.IO for WebSocket
- Jest for testing

**API Endpoints:**

#### Health & Configuration
- `GET /health/ready` - Health check with service status
- `GET /api/config` - Public configuration

#### Document Ingestion
- `POST /api/ingest/upload` - Upload and process documents
- `GET /api/ingest/documents` - List all documents
- `GET /api/ingest/:docId/chunks` - Get document chunks
- `GET /api/ingest/documents/:docId/content` - Get document content

#### RAG Operations
- `POST /api/rag/query` - Retrieve relevant chunks
- `POST /api/rag/answer` - Generate RAG answer
- `GET /api/rag/stats` - Query statistics
- `GET /api/rag/models` - List available LLM models
- `POST /api/rag/model` - Switch active LLM model

#### Magic Studio
- `POST /api/studio/mindmap` - Generate mind map
- `POST /api/studio/podcast` - Generate podcast script
- `POST /api/studio/actions` - Get contextual actions
- WebSocket events for real-time updates

### 3. PostgreSQL with pgvector

**Purpose:** Primary data store with vector similarity search

**Schema Tables:**
- `documents` - Document metadata
- `pages` - Page-level content
- `chunks` - Text chunks with metadata
- `embeddings` - Vector embeddings (pgvector)
- `rag_logs` - Query history and analytics
- `mindmap_clusters` - Cached mind map data
- `workspaces` - User workspace management

**Key Features:**
- Vector similarity search via pgvector extension
- Efficient indexing with IVFFlat
- JSON support for metadata

### 4. Embedder Service (Python/FastAPI)

**Purpose:** Generate semantic embeddings for text

**Technology:**
- FastAPI framework
- Sentence Transformers
- Model: `sentence-transformers/all-MiniLM-L6-v2`

**Endpoints:**
- `POST /embed` - Generate embeddings
- `GET /health` - Health check

**Features:**
- Batch processing support
- Automatic model caching
- GPU acceleration (if available)

### 5. Reranker Service (Python/FastAPI)

**Purpose:** Re-rank retrieved candidates for better relevance

**Technology:**
- FastAPI framework
- Cross-encoder models
- Model: `cross-encoder/ms-marco-MiniLM-L-6-v2`

**Endpoints:**
- `POST /rerank` - Re-rank candidates
- `GET /health` - Health check

**Features:**
- Query-aware scoring
- Batch processing
- Configurable top-k selection

### 6. Ollama (LLM Service)

**Purpose:** Language model for answer generation

**Features:**
- Multiple model support (Llama, Mistral, etc.)
- Dynamic model switching
- Streaming responses
- Local inference (no cloud dependencies)

**API:**
- `POST /api/generate` - Generate text
- `GET /api/tags` - List available models
- `POST /api/pull` - Download new models

### 7. Clusterer Service (Python/FastAPI)

**Purpose:** Topic clustering for mind map generation

**Technology:**
- FastAPI framework
- HDBSCAN clustering algorithm
- scikit-learn for preprocessing

**Endpoints:**
- `POST /cluster` - Generate topic clusters
- `GET /health` - Health check

**Features:**
- Automatic topic detection
- Hierarchical clustering
- Noise filtering

## Data Flow

### Document Ingestion Pipeline

```
1. File Upload (Frontend)
   ↓
2. Multer Processing (Backend)
   ↓
3. PDF/Text Extraction
   ↓
4. Text Normalization & Chunking
   ↓
5. Embedding Generation (Embedder Service)
   ↓
6. Database Storage (PostgreSQL)
```

### RAG Query Pipeline

```
1. User Query (Frontend)
   ↓
2. Language Detection (Backend)
   ↓
3. Query Embedding (Embedder Service)
   ↓
4. Vector Similarity Search (PostgreSQL/pgvector)
   ↓
5. Candidate Re-ranking (Reranker Service)
   ↓
6. Context Assembly (Backend)
   ↓
7. Answer Generation (Ollama)
   ↓
8. Response with Citations (Frontend)
```

### Magic Studio Mind Map Pipeline

```
1. RAG Answer Context
   ↓
2. Topic Extraction (Backend)
   ↓
3. Clustering Request (Clusterer Service)
   ↓
4. Topic Groups Generation
   ↓
5. Visualization (Frontend D3.js)
   ↓
6. Real-time Updates (WebSocket)
```

## Configuration

### Environment Variables

**Backend:**
- `PORT` - Server port (default: 3000)
- `DATABASE_URL` - PostgreSQL connection string
- `DB_SCHEMA` - Database schema name
- `EMBED_SERVICE_URL` - Embedder service URL
- `RERANK_SERVICE_URL` - Reranker service URL
- `LLM_API_URL` - Ollama API URL
- `CORS_ALLOWED_ORIGINS` - Allowed CORS origins
- `MAX_UPLOAD_MB` - Max file upload size

**Services:**
- `EMBEDDER_PORT` - Embedder service port (8000)
- `RERANKER_PORT` - Reranker service port (8001)
- `CLUSTERER_PORT` - Clusterer service port (8002)
- `OLLAMA_PORT` - Ollama service port (11434)

## Security Considerations

### Current Implementation
- CORS protection with configurable origins
- File type validation
- Size limits on uploads
- Input sanitization
- SQL injection protection (parameterized queries)

### Future Enhancements
- User authentication (JWT)
- Rate limiting
- API key management
- Role-based access control (RBAC)
- Audit logging

## Performance Optimization

### Current Optimizations
- Connection pooling (PostgreSQL)
- Batch embedding generation
- Vector index optimization (IVFFlat)
- Response caching (mind maps)
- Chunked processing

### Monitoring
- Health checks for all services
- Query logging and analytics
- Processing time metrics
- Error tracking

## Scalability

### Horizontal Scaling
- Stateless backend design
- Database connection pooling
- Service-oriented architecture
- Docker containerization

### Vertical Scaling
- GPU support for ML services
- Configurable batch sizes
- Memory-efficient chunking
- Index optimization

## Development Workflow

### Local Development
```bash
# Start all services
docker-compose up -d

# Access frontend
http://localhost:4200

# Access backend API
http://localhost:3000
```

### Testing
```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test

# E2E tests
npm run test:e2e
```

### Code Quality
- ESLint for JavaScript/TypeScript
- Prettier for code formatting
- Jest for unit testing
- Strict TypeScript compilation
- Git pre-commit hooks

## Deployment

### Docker Deployment
All services are containerized and orchestrated via Docker Compose:

```bash
docker-compose -f deploy/docker/docker-compose.yml up -d
```

### Service Health
Monitor service health via:
- Backend: `http://localhost:3000/health/ready`
- Individual service health endpoints

### Database Migrations
Migrations run automatically on backend startup via `db/init.js`

## Technology Decisions

### Why Angular?
- Strong TypeScript support
- Comprehensive framework
- Built-in dependency injection
- Active community and ecosystem

### Why pgvector?
- Native vector similarity in PostgreSQL
- Eliminates need for separate vector DB
- ACID compliance
- Mature tooling

### Why Ollama?
- Local LLM deployment
- No cloud dependencies
- Model flexibility
- Cost-effective

### Why Microservices?
- Language flexibility (Python for ML, Node.js for API)
- Independent scaling
- Service isolation
- Technology optimization per task

## Future Enhancements

### Planned Features
- Multi-user support with authentication
- Workspace collaboration
- Document versioning
- Advanced search filters
- Export functionality improvements
- Mobile app (React Native)

### Infrastructure
- Kubernetes deployment
- Service mesh (Istio)
- Distributed tracing
- Advanced monitoring (Prometheus/Grafana)

## Support & Maintenance

### Logs
- Backend: Console output via winston logger
- Services: Standard output
- Database: PostgreSQL logs

### Troubleshooting
- Check service health endpoints
- Review Docker logs: `docker-compose logs [service]`
- Verify network connectivity between services
- Check environment variables

### Updates
- Keep dependencies updated regularly
- Monitor security advisories
- Test updates in staging environment
- Maintain backward compatibility

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

## License

[Add your license information here]
