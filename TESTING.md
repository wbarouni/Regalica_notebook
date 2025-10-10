# Regalica Notebook Testing Guide

## Testing Overview

This document describes the testing strategy, procedures, and guidelines for Regalica Notebook.

## Test Pyramid

```
           ┌─────────────────┐
           │   E2E Tests     │  <- Browser automation
           │   (Playwright)  │
           └─────────────────┘
          ┌───────────────────┐
          │ Integration Tests │  <- API + DB
          │     (Jest)        │
          └───────────────────┘
       ┌──────────────────────────┐
       │    Unit Tests (Jest)     │  <- Individual functions
       └──────────────────────────┘
```

## Backend Testing

### Unit Tests

**Location:** `backend/src/**/*.spec.js`

**Coverage Areas:**
- Text chunking algorithms (`ingest/chunk.spec.js`)
- Language detection (`rag/lang.spec.js`)
- Tokenization (`rag/tokenizer.spec.js`)
- Reranking logic (`rag/rerank.spec.js`)
- URL utilities (`utils/url.spec.js`)

**Running Tests:**
```bash
cd backend
npm test                    # Run all tests
npm test -- --coverage      # With coverage report
npm test -- chunk.spec.js   # Run specific test file
npm test -- --watch         # Watch mode
```

**Example Test Structure:**
```javascript
describe('chunkSections', () => {
  it('should create chunks with proper token limits', () => {
    const sections = [
      { heading: 'Introduction', text: 'Lorem ipsum...' }
    ];
    const chunks = chunkSections(sections);
    
    expect(chunks).toHaveLength(1);
    expect(chunks[0].tokens).toBeLessThanOrEqual(512);
  });
});
```

### Integration Tests

**Location:** `backend/src/**/*.integration.spec.js`

**Coverage Areas:**
- RAG pipeline end-to-end (`rag/integration.spec.js`)
- Database operations
- Service communication

**Running Tests:**
```bash
cd backend
npm run test:integration
```

**Requirements:**
- Running PostgreSQL instance
- Running microservices (embedder, reranker, ollama)

### API Tests

**Location:** `scripts/smoke.sh`

**Purpose:** Verify all API endpoints are functional

**Running Tests:**
```bash
./scripts/smoke.sh
```

**Checks:**
- Health endpoints
- Document upload
- RAG query
- Model management
- Studio features

## Frontend Testing

### Unit Tests

**Location:** `frontend/src/**/*.spec.ts`

**Coverage Areas:**
- Component logic
- Service methods
- Utility functions
- Pipes and directives

**Running Tests:**
```bash
cd frontend
npm test                    # Run all tests
npm test -- --code-coverage # With coverage
npm test -- --watch         # Watch mode
```

**Example Test:**
```typescript
describe('RagService', () => {
  it('should submit query successfully', async () => {
    const service = TestBed.inject(RagService);
    const result = await service.submitQuery('test question');
    
    expect(result.answer).toBeDefined();
    expect(result.sources).toBeArray();
  });
});
```

### Component Tests

**Testing Approach:**
- Isolated component testing with TestBed
- Mock services and dependencies
- Test user interactions
- Verify DOM updates

**Example:**
```typescript
describe('ChatComponent', () => {
  it('should send message on button click', () => {
    const fixture = TestBed.createComponent(ChatComponent);
    const component = fixture.componentInstance;
    
    component.messageInput = 'Hello';
    fixture.detectChanges();
    
    const button = fixture.debugElement.query(By.css('button'));
    button.nativeElement.click();
    
    expect(mockRagService.submitQuery).toHaveBeenCalledWith('Hello');
  });
});
```

### E2E Tests

**Location:** `frontend/tests/e2e/`

**Framework:** Playwright

**Coverage Areas:**
- Document upload workflow
- RAG query workflow
- Magic Studio interactions
- Navigation and routing

**Running Tests:**
```bash
cd frontend
npm run test:e2e           # Run all E2E tests
npm run test:e2e:ui        # Run with UI
npm run test:e2e -- --headed # Run in headed mode
```

**Example Test:**
```typescript
test('upload and query document', async ({ page }) => {
  await page.goto('http://localhost:4200');
  
  // Upload document
  await page.setInputFiles('input[type="file"]', 'test.pdf');
  await page.click('button:has-text("Upload")');
  await expect(page.locator('.success-message')).toBeVisible();
  
  // Query document
  await page.fill('textarea', 'What is this document about?');
  await page.click('button:has-text("Ask")');
  await expect(page.locator('.answer')).toBeVisible();
});
```

## Service Testing

### Embedder Service

**Test Script:** `scripts/test_embedder.sh`

**Tests:**
- Model loading
- Embedding generation
- Batch processing
- Response format validation

**Running:**
```bash
./scripts/test_embedder.sh
```

### Reranker Service

**Test Approach:**
- Direct API calls with curl
- Verify scoring accuracy
- Test edge cases

**Example:**
```bash
curl -X POST http://localhost:8001/rerank \
  -H "Content-Type: application/json" \
  -d '{
    "query": "machine learning",
    "candidates": [
      {"id": "1", "text": "Deep learning is..."},
      {"id": "2", "text": "Cooking recipes..."}
    ]
  }'
```

### RAG Pipeline

**Test Script:** `scripts/test_rag.sh`

**End-to-End RAG Test:**
```bash
./scripts/test_rag.sh
```

**Validates:**
1. Document upload
2. Chunk extraction
3. Embedding generation
4. Query processing
5. Answer generation
6. Citation accuracy

## Manual Testing Checklist

### Document Upload

- [ ] PDF upload works
- [ ] Text file upload works
- [ ] Duplicate detection works
- [ ] Large file handling (>10MB)
- [ ] Invalid file type rejection
- [ ] Progress indication
- [ ] Error messages are clear

### RAG Query

- [ ] Simple questions work
- [ ] Complex questions work
- [ ] Multi-language queries
- [ ] No results scenario
- [ ] Citations are accurate
- [ ] Response time is acceptable (<5s)
- [ ] Error handling

### Magic Studio

#### Mind Map
- [ ] Generates after first response
- [ ] Clusters are meaningful
- [ ] Visualization renders correctly
- [ ] Interactive features work
- [ ] Loading states
- [ ] Error handling

#### Podcast
- [ ] Script generation works
- [ ] Audio generation works
- [ ] Playback controls function
- [ ] Download works
- [ ] Progress indication
- [ ] Error handling

#### Actions
- [ ] Suggestions appear
- [ ] Actions are contextual
- [ ] Action execution works
- [ ] Loading states
- [ ] Error handling

### WebSocket

- [ ] Connection establishes
- [ ] Real-time updates work
- [ ] Reconnection on disconnect
- [ ] No memory leaks
- [ ] Multiple clients supported

### Cross-Browser Testing

Test on:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile browsers (iOS Safari, Chrome Mobile)

### Responsive Design

Test on:
- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)

## Performance Testing

### Load Testing

**Tool:** Apache Bench or k6

**Test Scenarios:**
```bash
# Concurrent uploads
ab -n 100 -c 10 -T 'multipart/form-data' \
   http://localhost:3000/api/ingest/upload

# Concurrent queries
ab -n 1000 -c 50 -T 'application/json' \
   -p query.json \
   http://localhost:3000/api/rag/answer
```

### Benchmarks

**Expected Performance:**
- Document upload: <10s for 5MB PDF
- Embedding generation: <2s per document
- RAG query (with reranking): <5s
- Mind map generation: <3s
- Concurrent users: 50+ simultaneous

### Memory Profiling

**Node.js Backend:**
```bash
node --inspect backend/src/server.js
# Use Chrome DevTools for profiling
```

**Frontend:**
```bash
# Use Chrome DevTools Performance tab
# Check for memory leaks with Heap Snapshots
```

## Continuous Integration

### GitHub Actions Workflow

**File:** `.github/workflows/test.yml`

**Pipeline:**
```yaml
1. Checkout code
2. Setup Node.js
3. Install dependencies
4. Run linters
5. Run unit tests
6. Build Docker images
7. Start services
8. Run integration tests
9. Run E2E tests
10. Generate coverage reports
11. Upload artifacts
```

### Coverage Requirements

**Minimum Coverage:**
- Backend: 80% line coverage
- Frontend: 75% line coverage
- Critical paths: 100% coverage

**Check Coverage:**
```bash
# Backend
cd backend && npm run test:coverage

# Frontend
cd frontend && npm run test:coverage
```

## Test Data Management

### Fixtures

**Location:** `tests/fixtures/`

**Available Files:**
- `sample.pdf` - Sample PDF document
- `test.txt` - Plain text file
- `test.html` - HTML document
- `test_doc.txt` - Test document content

### Test Database

**Setup:**
```bash
# Create test database
createdb regalica_test

# Run migrations
DB_SCHEMA=test npm run migrate
```

**Teardown:**
```bash
# Clean test data
psql regalica_test -c "TRUNCATE TABLE test.documents CASCADE;"
```

## Debugging Tests

### Backend

**Enable Debug Logs:**
```bash
LOG_LEVEL=debug npm test
```

**Debug Specific Test:**
```bash
node --inspect-brk node_modules/.bin/jest chunk.spec.js
```

### Frontend

**Debug in VS Code:**
```json
{
  "type": "chrome",
  "request": "launch",
  "name": "Debug Tests",
  "url": "http://localhost:9876/debug.html",
  "webRoot": "${workspaceFolder}/frontend"
}
```

## Test Environment Setup

### Prerequisites

```bash
# Install dependencies
npm install

# Start PostgreSQL
docker-compose up -d postgres

# Start services
docker-compose up -d

# Wait for services to be healthy
./scripts/healthcheck.sh
```

### Environment Variables

```bash
# Test environment
export NODE_ENV=test
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/regalica_test
export DB_SCHEMA=test
export LOG_LEVEL=error
```

## Common Issues

### Tests Failing Intermittently

**Cause:** Race conditions, network timeouts
**Solution:** 
- Increase timeout values
- Add proper wait conditions
- Use deterministic test data

### Database Tests Failing

**Cause:** Schema mismatch, stale data
**Solution:**
```bash
# Reset test database
./scripts/dev-reset.sh
npm run migrate
```

### E2E Tests Timing Out

**Cause:** Slow services, network issues
**Solution:**
- Increase Playwright timeout
- Check service health
- Run services locally

## Best Practices

### Unit Tests
- Test one thing at a time
- Use descriptive test names
- Mock external dependencies
- Keep tests fast (<1s each)
- Follow AAA pattern (Arrange, Act, Assert)

### Integration Tests
- Test real interactions
- Use test database
- Clean up after tests
- Test happy and error paths

### E2E Tests
- Test critical user journeys
- Use Page Object pattern
- Make tests resilient
- Run in CI environment

### General
- Write tests before fixing bugs
- Maintain test documentation
- Review test coverage regularly
- Keep tests maintainable

## Reporting

### Coverage Reports

**Generate Reports:**
```bash
# Backend
npm run test:coverage
open backend/coverage/index.html

# Frontend
npm run test:coverage
open frontend/coverage/index.html
```

### Test Results

**CI Integration:**
- Test results posted to PR
- Coverage trends tracked
- Failing tests block merge

**Local Review:**
```bash
# Generate HTML report
npm test -- --coverage --coverageReporters=html
```

## Maintenance

### Regular Tasks

**Weekly:**
- Review test failures
- Update test fixtures
- Check coverage trends

**Monthly:**
- Update testing dependencies
- Review test performance
- Refactor slow tests
- Update documentation

**Quarterly:**
- Audit test coverage
- Remove obsolete tests
- Performance optimization
- Security testing

## Resources

### Documentation
- [Jest Documentation](https://jestjs.io/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)

### Tools
- Jest: Unit and integration testing
- Playwright: E2E testing
- SuperTest: API testing
- k6: Load testing
- Chrome DevTools: Performance profiling

## Support

For testing issues or questions:
- Check existing test files for examples
- Review this documentation
- Consult team lead
- Create issue in project tracker
