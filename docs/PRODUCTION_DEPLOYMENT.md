# LSM Project - Production Deployment Guide

**Version**: 3.2.0  
**Last Updated**: 2026-03-13 (Day 6 - Week 2)  
**Status**: Production Ready ✅

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Configuration](#configuration)
5. [Docker Deployment](#docker-deployment)
6. [Database Migration](#database-migration)
7. [Monitoring Setup](#monitoring-setup)
8. [Security Checklist](#security-checklist)
9. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

This guide covers the complete production deployment process for the LSM Project using Docker Compose. The deployment includes:

- **PostgreSQL 14** - Primary database
- **Redis 7** - Caching layer
- **Backend Service** - Node.js API server
- **Frontend Service** - Static web server (nginx)
- **Prometheus** - Metrics collection
- **Grafana** - Monitoring dashboards
- **Node Exporter** - System metrics
- **Redis Exporter** - Redis metrics

---

## 📦 Prerequisites

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 4 cores | 8+ cores |
| Memory | 8 GB | 16+ GB |
| Storage | 50 GB SSD | 100+ GB SSD |
| Network | 100 Mbps | 1 Gbps |

### Software Requirements

```bash
# Docker 24.0+
docker --version

# Docker Compose 2.20+
docker-compose --version

# Git
git --version
```

### Installation

```bash
# Install Docker (Ubuntu/Debian)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker $USER
```

---

## 🚀 Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/your-org/lsm-project.git
cd lsm-project
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Generate secure secrets
echo "JWT_SECRET=$(openssl rand -base64 64)" >> .env
echo "DB_PASSWORD=$(openssl rand -base64 32)" >> .env
echo "REDIS_PASSWORD=$(openssl rand -base64 32)" >> .env
echo "GRAFANA_ADMIN_PASSWORD=$(openssl rand -base64 32)" >> .env

# Edit .env file with your production values
nano .env
```

### 3. Deploy Services

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check service status
docker-compose ps
```

### 4. Run Database Migrations

```bash
# Execute migrations
docker-compose exec backend npx prisma migrate deploy

# Generate Prisma Client
docker-compose exec backend npx prisma generate

# Seed database (optional)
docker-compose exec backend npx prisma db seed
```

### 5. Verify Deployment

```bash
# Health check
curl http://localhost:8080/health

# Frontend
curl http://localhost/

# Metrics
curl http://localhost:9090/targets
```

---

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `DB_USER` | PostgreSQL username | `lsm` |
| `DB_PASSWORD` | PostgreSQL password | _required_ |
| `DB_NAME` | Database name | `lsm` |
| `REDIS_PASSWORD` | Redis password | _required_ |
| `JWT_SECRET` | JWT signing key | _required_ |
| `CORS_ORIGINS` | Allowed origins | `http://localhost:3000` |
| `SMTP_HOST` | SMTP server | - |
| `SMTP_PORT` | SMTP port | `587` |
| `LOG_LEVEL` | Logging level | `info` |

### Resource Limits

Services are configured with resource limits in `docker-compose.yml`:

```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 1G
    reservations:
      cpus: '0.5'
      memory: 512M
```

Adjust based on your infrastructure.

---

## 🐳 Docker Deployment

### Build Images

```bash
# Build all images
docker-compose build

# Build with no cache
docker-compose build --no-cache

# Build specific service
docker-compose build backend
```

### Start Services

```bash
# Start all services
docker-compose up -d

# Start specific services
docker-compose up -d backend frontend

# Start with rebuild
docker-compose up -d --build
```

### Stop Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Stop and remove images
docker-compose down --rmi all
```

### Update Deployment

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose up -d --build

# Run migrations
docker-compose exec backend npx prisma migrate deploy
```

### Backup & Restore

```bash
# Create backup
./scripts/backup.sh backup full

# List backups
./scripts/backup.sh list

# Restore from backup
./scripts/backup.sh restore backups/backup-full-20260313-120000.sql.gz
```

---

## 🗄️ Database Migration

### Migration Scripts

The project includes comprehensive migration scripts:

```bash
# Run all pending migrations
./scripts/migrate.sh up

# Rollback last migration
./scripts/migrate.sh down

# Check migration status
./scripts/migrate.sh status

# Seed database
./scripts/migrate.sh seed

# Create backup
./scripts/migrate.sh backup
```

### Manual Migration

```bash
# Access backend container
docker-compose exec backend sh

# Run migrations
npx prisma migrate deploy

# Check status
npx prisma migrate status

# Reset database (development only)
npx prisma migrate reset
```

---

## 📊 Monitoring Setup

### Access Monitoring Tools

| Service | URL | Credentials |
|---------|-----|-------------|
| Grafana | http://localhost:3000 | admin / (from .env) |
| Prometheus | http://localhost:9090 | - |
| Node Exporter | http://localhost:9100 | - |
| Redis Exporter | http://localhost:9121 | - |

### Configure Grafana

1. Login to Grafana
2. Add Prometheus data source:
   - URL: `http://prometheus:9090`
   - Access: `Server`
3. Import dashboards from `monitoring/grafana/dashboards/`

### Alerting

Alert rules are configured in `monitoring/alerts.yml`:

- High CPU usage (>90%)
- High memory usage (>90%)
- Database down
- Redis down
- Low cache hit rate (<80%)
- High error rate (>5%)

---

## 🔒 Security Checklist

### Pre-Deployment

- [ ] All default passwords changed
- [ ] JWT_SECRET is cryptographically random
- [ ] Environment file (.env) not committed to git
- [ ] Firewall rules configured
- [ ] SSL/TLS certificates obtained

### Post-Deployment

- [ ] Health checks passing
- [ ] Monitoring dashboards configured
- [ ] Alerts configured and tested
- [ ] Backup schedule configured
- [ ] Log rotation enabled

### Ongoing

- [ ] Regular security updates
- [ ] Dependency vulnerability scans
- [ ] Certificate expiration monitoring
- [ ] Backup restoration tests
- [ ] Performance monitoring

---

## 🔧 Troubleshooting

### Service Won't Start

```bash
# Check logs
docker-compose logs backend

# Check container status
docker-compose ps

# Restart service
docker-compose restart backend
```

### Database Connection Issues

```bash
# Test database connection
docker-compose exec backend npx prisma db execute --stdin "SELECT 1;"

# Check PostgreSQL logs
docker-compose logs postgres

# Verify credentials
docker-compose exec postgres psql -U lsm -d lsm -c "\conninfo"
```

### High Memory Usage

```bash
# Check container stats
docker stats

# Restart service
docker-compose restart backend

# Check for memory leaks in logs
docker-compose logs backend | grep -i "memory\|leak"
```

### Cache Issues

```bash
# Check Redis connection
docker-compose exec redis redis-cli -a $REDIS_PASSWORD ping

# View Redis stats
docker-compose exec redis redis-cli -a $REDIS_PASSWORD info stats

# Clear cache
docker-compose exec redis redis-cli -a $REDIS_PASSWORD FLUSHDB
```

---

## 📞 Support

For issues and questions:

- **Documentation**: `/docs` directory
- **Issues**: GitHub Issues
- **Emergency**: Contact DevOps team

---

**Document Version**: 3.2.0  
**Last Updated**: 2026-03-13  
**Maintained By**: DevOps Team
