# Regalica Notebook Deployment Guide

## Deployment Options

This guide covers different deployment strategies for Regalica Notebook.

## Prerequisites

### System Requirements

**Minimum:**
- CPU: 4 cores
- RAM: 8 GB
- Storage: 50 GB
- OS: Linux (Ubuntu 20.04+), Windows 10+, macOS

**Recommended:**
- CPU: 8 cores
- RAM: 16 GB
- Storage: 100 GB SSD
- GPU: NVIDIA GPU (for faster ML inference)

### Software Requirements

- Docker 24.0+
- Docker Compose 2.20+
- Git
- Node.js 18+ (for development)
- PostgreSQL 15+ (if running natively)

## Quick Start (Docker)

### 1. Clone Repository

```bash
git clone https://github.com/your-org/regalica-notebook.git
cd regalica-notebook
```

### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit configuration
nano .env
```

**Required Variables:**
```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/regalica
DB_SCHEMA=public

# Services
EMBED_SERVICE_URL=http://embedder:8000
RERANK_SERVICE_URL=http://reranker:8001
LLM_API_URL=http://ollama:11434
CLUSTERER_SERVICE_URL=http://clusterer:8002

# Backend
PORT=3000
CORS_ALLOWED_ORIGINS=http://localhost:4200,http://localhost:80

# File Upload
MAX_UPLOAD_MB=50
ALLOWED_MIME_TYPES=application/pdf,text/plain,text/html
```

### 3. Start Services

```bash
# Start all services
docker-compose -f deploy/docker/docker-compose.yml up -d

# Check status
docker-compose -f deploy/docker/docker-compose.yml ps

# View logs
docker-compose -f deploy/docker/docker-compose.yml logs -f
```

### 4. Verify Deployment

```bash
# Check backend health
curl http://localhost:3000/health/ready

# Access frontend
open http://localhost:80
```

### 5. Initialize Ollama Model

```bash
# Pull default model
docker exec -it regalica-ollama ollama pull llama3.2:3b

# Verify model is available
curl http://localhost:11434/api/tags
```

## Production Deployment

### Docker Compose Production

**Configuration:** `deploy/docker/docker-compose.prod.yml`

```yaml
services:
  frontend:
    build:
      context: ../../frontend
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=production
    restart: always
    
  backend:
    build:
      context: ../../backend
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
    restart: always
    
  # ... other services
```

**Deploy:**
```bash
# Build production images
docker-compose -f deploy/docker/docker-compose.prod.yml build

# Start services
docker-compose -f deploy/docker/docker-compose.prod.yml up -d

# Scale backend if needed
docker-compose -f deploy/docker/docker-compose.prod.yml up -d --scale backend=3
```

### SSL/TLS Configuration

**Using Nginx with Let's Encrypt:**

1. **Install Certbot:**
```bash
sudo apt-get install certbot python3-certbot-nginx
```

2. **Obtain Certificate:**
```bash
sudo certbot --nginx -d your-domain.com
```

3. **Update Nginx Configuration:**
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # ... rest of configuration
}
```

### Environment-Specific Configuration

**Development:**
```bash
NODE_ENV=development
LOG_LEVEL=debug
CORS_ALLOWED_ORIGINS=*
```

**Staging:**
```bash
NODE_ENV=staging
LOG_LEVEL=info
CORS_ALLOWED_ORIGINS=https://staging.example.com
```

**Production:**
```bash
NODE_ENV=production
LOG_LEVEL=warn
CORS_ALLOWED_ORIGINS=https://example.com
```

## Native Deployment (Non-Docker)

### Backend Setup

```bash
# Install dependencies
cd backend
npm install --production

# Run migrations
npm run migrate

# Start server
NODE_ENV=production npm start
```

### Frontend Setup

```bash
# Install dependencies
cd frontend
npm install

# Build production bundle
npm run build

# Serve with nginx or serve
npx serve -s dist/frontend -l 80
```

### Database Setup

```bash
# Create database
createdb regalica

# Install extensions
psql regalica -c "CREATE EXTENSION IF NOT EXISTS vector;"
psql regalica -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"

# Run migrations
cd backend && npm run migrate
```

### Python Services

**Embedder:**
```bash
cd embedder
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000
```

**Reranker:**
```bash
cd reranker
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8001
```

**Clusterer:**
```bash
cd clusterer
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8002
```

### Ollama Setup

```bash
# Install Ollama (Linux)
curl -fsSL https://ollama.com/install.sh | sh

# Start service
ollama serve

# Pull model
ollama pull llama3.2:3b
```

## Cloud Deployment

### AWS Deployment

**Architecture:**
- EC2 instances or ECS for containers
- RDS for PostgreSQL
- S3 for document storage (optional)
- CloudFront for CDN
- ALB for load balancing

**Example EC2 Deployment:**

```bash
# Launch EC2 instance (Ubuntu 22.04, t3.xlarge or larger)
# SSH into instance
ssh -i your-key.pem ubuntu@your-instance-ip

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# Clone and deploy
git clone https://github.com/your-org/regalica-notebook.git
cd regalica-notebook
docker-compose -f deploy/docker/docker-compose.yml up -d
```

**RDS Setup:**
```bash
# Update .env with RDS connection
DATABASE_URL=postgresql://username:password@your-rds-endpoint:5432/regalica
```

### Google Cloud Platform

**Architecture:**
- Cloud Run for containers
- Cloud SQL for PostgreSQL
- Cloud Storage for documents
- Cloud CDN
- Cloud Load Balancing

**Deploy to Cloud Run:**
```bash
# Build and push images
gcloud builds submit --tag gcr.io/project-id/backend
gcloud builds submit --tag gcr.io/project-id/frontend

# Deploy services
gcloud run deploy backend --image gcr.io/project-id/backend
gcloud run deploy frontend --image gcr.io/project-id/frontend
```

### Azure Deployment

**Architecture:**
- Azure Container Instances
- Azure Database for PostgreSQL
- Azure Blob Storage
- Azure CDN
- Azure Load Balancer

**Deploy with Azure CLI:**
```bash
# Create resource group
az group create --name regalica-rg --location eastus

# Create container instances
az container create \
  --resource-group regalica-rg \
  --name backend \
  --image your-registry/backend:latest \
  --ports 3000
```

### Kubernetes Deployment

**Prerequisites:**
- Kubernetes cluster (EKS, GKE, AKS, or self-managed)
- kubectl configured
- Helm (optional)

**Deployment Files:**

`k8s/backend-deployment.yaml`:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: backend
        image: your-registry/backend:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
```

**Deploy:**
```bash
# Apply configurations
kubectl apply -f k8s/

# Check status
kubectl get pods
kubectl get services

# Scale if needed
kubectl scale deployment backend --replicas=5
```

## Database Management

### Backups

**Automated Backup Script:**
```bash
#!/bin/bash
# backup-db.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
DB_NAME="regalica"

# Create backup
docker exec postgres pg_dump -U postgres $DB_NAME | gzip > "$BACKUP_DIR/backup_$DATE.sql.gz"

# Keep only last 7 days
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: backup_$DATE.sql.gz"
```

**Schedule with cron:**
```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /path/to/backup-db.sh
```

### Restore from Backup

```bash
# Restore from backup
gunzip -c backup_20250107_020000.sql.gz | docker exec -i postgres psql -U postgres regalica

# Or with direct file
docker exec -i postgres psql -U postgres regalica < backup.sql
```

### Database Migrations

**Apply Migrations:**
```bash
cd backend
npm run migrate
```

**Rollback Migration:**
```bash
# Manually run down migration
psql -d regalica -f deploy/sql/0006_workspaces_down.sql
```

## Monitoring & Logging

### Health Checks

**Backend Health:**
```bash
curl http://localhost:3000/health/ready
```

**Service Health Script:**
```bash
#!/bin/bash
# health-check.sh

services=("backend:3000" "embedder:8000" "reranker:8001" "ollama:11434")

for service in "${services[@]}"; do
    IFS=':' read -r name port <<< "$service"
    if curl -sf http://localhost:$port/health > /dev/null 2>&1; then
        echo "✓ $name is healthy"
    else
        echo "✗ $name is unhealthy"
    fi
done
```

### Logging

**View Logs:**
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail=100 backend
```

**Log Aggregation (Production):**

Use tools like:
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Grafana Loki
- CloudWatch (AWS)
- Stackdriver (GCP)

### Performance Monitoring

**Prometheus + Grafana:**

1. **Add Prometheus exporters**
2. **Configure Grafana dashboards**
3. **Set up alerts**

**Key Metrics:**
- Request rate (req/s)
- Response time (ms)
- Error rate (%)
- CPU usage (%)
- Memory usage (MB)
- Database connections
- Queue length

## Security

### Firewall Configuration

```bash
# Allow only necessary ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### Environment Variables Security

**Never commit .env files!**

Use secrets management:
- AWS Secrets Manager
- GCP Secret Manager
- Azure Key Vault
- HashiCorp Vault

**Example with Docker secrets:**
```yaml
services:
  backend:
    secrets:
      - db_password
      - jwt_secret

secrets:
  db_password:
    file: ./secrets/db_password.txt
  jwt_secret:
    file: ./secrets/jwt_secret.txt
```

### SSL/TLS Best Practices

- Use TLS 1.2 or higher
- Strong cipher suites
- HSTS headers
- Certificate pinning (for apps)

## Scaling

### Horizontal Scaling

**Load Balancer Configuration:**
```nginx
upstream backend {
    least_conn;
    server backend1:3000;
    server backend2:3000;
    server backend3:3000;
}

server {
    location / {
        proxy_pass http://backend;
    }
}
```

**Docker Compose Scaling:**
```bash
docker-compose up -d --scale backend=3
```

### Vertical Scaling

**Increase Resources:**
```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
```

### Caching Strategy

- Redis for session caching
- CDN for static assets
- Database query caching
- Result caching for expensive operations

## Maintenance

### Update Procedure

```bash
# 1. Backup database
./backup-db.sh

# 2. Pull latest code
git pull origin main

# 3. Rebuild images
docker-compose build

# 4. Stop services
docker-compose down

# 5. Start services
docker-compose up -d

# 6. Verify health
./health-check.sh
```

### Zero-Downtime Deployment

**Blue-Green Deployment:**
1. Deploy new version alongside old
2. Test new version
3. Switch traffic to new version
4. Keep old version running briefly
5. Shut down old version

**Rolling Updates (Kubernetes):**
```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
```

## Troubleshooting

### Common Issues

**Services Not Starting:**
```bash
# Check logs
docker-compose logs

# Check port conflicts
netstat -tulpn | grep LISTEN

# Restart services
docker-compose restart
```

**Database Connection Issues:**
```bash
# Test connection
psql "postgresql://user:pass@host:5432/db"

# Check PostgreSQL logs
docker-compose logs postgres
```

**High Memory Usage:**
```bash
# Check container stats
docker stats

# Increase limits in docker-compose.yml
```

**Slow Performance:**
- Check database indexes
- Review query plans
- Monitor resource usage
- Scale horizontally

### Recovery Procedures

**Complete System Recovery:**
```bash
# 1. Stop all services
docker-compose down

# 2. Clear volumes (if needed)
docker-compose down -v

# 3. Restore database
# (restore from backup)

# 4. Restart services
docker-compose up -d
```

## Best Practices

### Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Database backed up
- [ ] SSL certificates valid
- [ ] Health checks configured
- [ ] Monitoring set up
- [ ] Logging configured
- [ ] Firewall rules applied
- [ ] Documentation updated

### Post-Deployment Checklist

- [ ] Services are healthy
- [ ] Application is accessible
- [ ] Database connections working
- [ ] File uploads working
- [ ] RAG queries working
- [ ] Magic Studio features working
- [ ] Monitoring dashboards showing data
- [ ] Logs are being collected
- [ ] SSL certificate valid and working

### Regular Maintenance

**Daily:**
- Check service health
- Review error logs
- Monitor disk space

**Weekly:**
- Review performance metrics
- Check security updates
- Test backups

**Monthly:**
- Update dependencies
- Review and optimize database
- Security audit
- Capacity planning

## Support

### Getting Help

- Documentation: [GitHub Wiki](https://github.com/your-org/regalica-notebook/wiki)
- Issues: [GitHub Issues](https://github.com/your-org/regalica-notebook/issues)
- Discussions: [GitHub Discussions](https://github.com/your-org/regalica-notebook/discussions)

### Emergency Contacts

- DevOps Lead: [contact info]
- Security Team: [contact info]
- On-Call Engineer: [PagerDuty/phone]

## Additional Resources

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [TESTING.md](./TESTING.md) - Testing procedures
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Development guide
- [Docker Documentation](https://docs.docker.com/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
