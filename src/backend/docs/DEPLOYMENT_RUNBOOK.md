# LSM Project - Deployment Runbook

**Version**: 3.0.0  
**Last Updated**: 2026-03-12  
**Status**: Production Ready

---

## 📋 Pre-Deployment Checklist

### Environment Verification
- [ ] Node.js 20+ installed
- [ ] PostgreSQL 14+ running
- [ ] Redis 7+ running
- [ ] npm dependencies installed
- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] Backup strategy in place

### Code Verification
- [ ] All tests passing
- [ ] Code review completed
- [ ] No critical bugs open
- [ ] Documentation updated
- [ ] Changelog updated

---

## 🚀 Deployment Process

### 1. Development Deployment

```bash
# Navigate to project
cd /root/.openclaw/workspace/lsm-project

# Pull latest changes
git pull origin develop

# Install dependencies
cd src/backend && npm install
cd ../frontend && npm install

# Build applications
cd ../backend && npm run build
cd ../frontend && npm run build

# Run migrations
cd ../backend && npx prisma migrate dev

# Restart services
pm2 restart lsm-backend
pm2 restart lsm-frontend

# Verify deployment
curl http://localhost:4000/health
curl http://localhost:3000
```

### 2. Staging Deployment

```bash
# Pull latest from develop
git pull origin develop

# Create backup
./scripts/backup.sh

# Build and deploy
npm run deploy:staging

# Run smoke tests
npm run test:smoke

# Verify health
curl https://staging.lsm.local/health
```

### 3. Production Deployment

```bash
# Pull latest from main
git pull origin main

# Create backup
./scripts/backup.sh

# Build applications
npm run build:prod

# Run migrations
npx prisma migrate deploy

# Deploy with zero downtime
./scripts/deploy-prod.sh

# Health checks
./scripts/health-check.sh

# Monitor for 15 minutes
./scripts/monitor.sh
```

---

## 🔄 Rollback Procedure

### Emergency Rollback

```bash
# 1. Stop current deployment
pm2 stop lsm-backend
pm2 stop lsm-frontend

# 2. Restore from backup
./scripts/rollback.sh <backup-path>

# 3. Restart services
pm2 start lsm-backend
pm2 start lsm-frontend

# 4. Verify rollback
curl http://localhost:4000/health
```

### Database Rollback

```bash
# Restore database from backup
pg_restore -U lsm_admin -d lsm < backup-<timestamp>.sql

# Or use Prisma rollback
npx prisma migrate resolve --rolled-back <migration-name>
```

---

## 📊 Post-Deployment Verification

### Health Checks

```bash
# Backend health
curl -s http://localhost:4000/health | jq

# Frontend health
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000

# Database connection
psql -U lsm_admin -d lsm -c "SELECT 1"

# Redis connection
redis-cli ping

# Check service status
pm2 status
```

### Smoke Tests

```bash
# Run smoke test suite
npm run test:smoke

# API smoke tests
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Check key functionality
curl http://localhost:4000/api/servers
curl http://localhost:4000/api/gpus
curl http://localhost:4000/api/tasks
```

### Monitoring Verification

```bash
# Check logs
pm2 logs lsm-backend --lines 50
pm2 logs lsm-frontend --lines 50

# Check metrics
curl http://localhost:4000/metrics

# Check error rate
# Should be < 1% of requests
```

---

## 🔧 Troubleshooting

### Build Failures

```bash
# Clear cache and rebuild
rm -rf node_modules package-lock.json
npm install
npm run build

# Check Node.js version
node --version  # Should be 20+

# Check disk space
df -h  # Should have > 1GB free
```

### Database Issues

```bash
# Check database connection
psql -U lsm_admin -d lsm -c "SELECT 1"

# Check migration status
npx prisma migrate status

# Reset database (development only)
npx prisma migrate reset
```

### Service Issues

```bash
# Check service status
pm2 status

# Restart failed services
pm2 restart all

# Check logs for errors
pm2 logs --lines 100

# Monitor memory usage
pm2 monit
```

### Performance Issues

```bash
# Check system resources
top
htop
free -h

# Check slow queries
psql -U lsm_admin -d lsm -c "SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10"

# Check Redis performance
redis-cli --latency
redis-cli info stats
```

---

## 📈 Deployment Metrics

### Key Metrics to Monitor

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| API Response Time | < 200ms | > 500ms |
| Error Rate | < 1% | > 5% |
| CPU Usage | < 70% | > 90% |
| Memory Usage | < 80% | > 90% |
| Disk Usage | < 80% | > 90% |
| Database Connections | < 80% | > 95% |

### Monitoring Tools

```bash
# Prometheus metrics
http://localhost:9090

# Grafana dashboards
http://localhost:3001

# Application logs
pm2 logs

# System logs
journalctl -u postgresql
journalctl -u redis
```

---

## 🎯 Deployment Schedule

### Regular Deployment Window

- **Day**: Tuesday, Thursday
- **Time**: 10:00 - 12:00 CST
- **Duration**: 2 hours max
- **Freeze**: No deployments on weekends/holidays

### Emergency Deployment

- Requires approval from project lead
- Minimum 2 reviewers
- Rollback plan mandatory
- Post-deployment review required

---

## 📝 Deployment Log Template

```markdown
## Deployment - YYYY-MM-DD

**Deployed by**: [Name]
**Environment**: [Dev/Staging/Prod]
**Version**: [X.X.X]

### Changes
- [Change 1]
- [Change 2]

### Pre-Deployment Checks
- [ ] Tests passing
- [ ] Code review complete
- [ ] Backup created

### Deployment Steps
- [ ] Build completed
- [ ] Migrations run
- [ ] Services restarted
- [ ] Health checks passed

### Post-Deployment
- [ ] Smoke tests passed
- [ ] Monitoring verified
- [ ] No errors in logs

### Issues
[Any issues encountered]

### Rollback Plan
[If applicable]
```

---

## 🔐 Security Considerations

### Before Deployment
- [ ] Security scan completed
- [ ] No critical vulnerabilities
- [ ] Secrets rotated (if needed)
- [ ] SSL certificates valid

### After Deployment
- [ ] Security headers present
- [ ] Rate limiting active
- [ ] Audit logging working
- [ ] 2FA enforced (if applicable)

---

**Last Updated**: 2026-03-12  
**Version**: 3.0.0  
**Status**: Production Ready
