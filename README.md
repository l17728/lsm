# LSM Project - Complete Documentation

**Version**: 3.2.2
**Last Updated**: 2026-03-28
**Status**: Production Ready ✅

---

## 📚 Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Installation](#installation)
5. [Configuration](#configuration)
6. [API Reference](#api-reference)
7. [Frontend Guide](#frontend-guide)
8. [Deployment](#deployment)
9. [Monitoring](#monitoring)
10. [Security](#security)
11. [Testing](#testing)
12. [Troubleshooting](#troubleshooting)

---

## Overview

Laboratory Server Management System (LSM) is a comprehensive platform for managing laboratory server resources, GPU allocation, task scheduling, and AI-assisted operations.

### Key Capabilities

- 🖥️ **Server Management** - Manage multiple servers with status tracking
- 🎮 **GPU Allocation** - Dynamic GPU resource allocation and recycling
- 📋 **Task Scheduling** - Priority-based task scheduling with AI optimization
- 📊 **Real-time Monitoring** - Live monitoring with WebSocket updates
- 🔐 **Security** - JWT authentication, 2FA, structured audit logging with requestId
- 📧 **Notifications** - Multi-channel notifications (email, WebSocket)
- 📱 **Mobile Ready** - Responsive design for mobile devices
- 🤖 **AI Agent** - LSM Agent powered by OpenClaw for natural language operations
- 📅 **Reservations** - GPU/server resource reservation and scheduling
- 📈 **Analytics** - Resource utilization analytics and cost reports
- 🔄 **Auto-scaling** - Intelligent auto-scaling and self-healing (v3.1.0+)
- 🧠 **AI Scheduling** - Intelligent time slot recommendations for cluster reservations (v3.2.2+)

---

## Features

### Core Features

| Feature | Status | Description |
|---------|--------|-------------|
| User Authentication | ✅ | JWT-based auth with 2FA |
| Server Management | ✅ | CRUD operations with batch operations |
| GPU Allocation | ✅ | Dynamic allocation with filtering |
| Task Scheduling | ✅ | Priority-based scheduling with AI assist |
| Real-time Monitoring | ✅ | WebSocket-based live metrics |
| Email Notifications | ✅ | Event-driven email alerts |
| Data Export | ✅ | CSV/Excel/JSON export |
| Mobile Responsive | ✅ | Mobile-first design |
| Audit Logging | ✅ | Structured audit trail with requestId |
| Redis Caching | ✅ | Performance optimization |
| Resource Reservations | ✅ | Calendar-based GPU/server booking (v3.2.0+) |
| AI Agent (LSM Agent) | ✅ | Natural language operations via OpenClaw |
| Analytics Dashboard | ✅ | Cost & utilization analysis (v3.2.0+) |
| Cluster Management | ✅ | Create/manage clusters with server groups |
| Cluster Reservations | ✅ | Reserve clusters with approval workflow |
| **AI Time Slot Recommendations** | ✅ | **Smart scheduling suggestions (v3.2.2+)** |
| Auto-scaling | ✅ | Reactive/predictive scaling (v3.1.0+) |
| Self-healing | ✅ | Automated fault detection & repair (v3.1.0+) |
| Alert Deduplication | ✅ | Intelligent alert noise reduction (v3.1.0+) |
| MCP Integration | ✅ | Model Context Protocol for AI tooling |

---

## Architecture

### Technology Stack

**Backend**:
- Node.js 20 + TypeScript
- Express.js framework
- PostgreSQL database
- Prisma ORM
- Redis caching
- Socket.IO for WebSocket

**Frontend**:
- React 18 + TypeScript
- Vite build tool
- Ant Design UI
- Zustand state management
- Recharts for visualization

**DevOps**:
- GitHub Actions CI/CD
- Docker containerization
- Prometheus monitoring
- Grafana dashboards

### System Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Backend    │────▶│  PostgreSQL │
│  (React)    │     │  (Express)   │     │  Database   │
└─────────────┘     └──────────────┘     └─────────────┘
       │                   │
       │                   ▼
       │            ┌──────────────┐
       └───────────▶│    Redis     │
                    │    Cache     │
                    └──────────────┘
```

---

## Installation

> 📘 **完整安装指南**: [INSTALL.md](INSTALL.md)

### Quick Start (Docker) 🚀

**推荐方式** - 使用 Docker 一键部署：

```bash
# Clone the repository
git clone https://github.com/l17728/lsm.git
cd lsm

# Quick start (development mode)
./quickstart.sh dev
```

**访问服务**:

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8080 |
| API Docs | http://localhost:8080/api/docs |
| Grafana | http://localhost:3001 |

**默认账号**: `admin / Pass@865342`

### Prerequisites (Manual Installation)

- Docker 24.0+ (推荐) 或 Node.js 20+
- PostgreSQL 14+ (Docker 部署无需手动安装)
- Redis 7+ (Docker 部署无需手动安装)
- Git 2.x+

### Backend Setup (Manual)

```bash
cd src/backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Start development server
npm run dev
```

### Frontend Setup (Manual)

```bash
cd src/frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start development server
npm run dev
```

---

## Configuration

### Environment Variables

#### Backend (.env)

```env
# Server
NODE_ENV=development
PORT=4000

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/lsm"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="15m"

# Email
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASSWORD=password
```

#### Frontend (.env)

```env
VITE_API_BASE_URL=http://localhost:4000/api
VITE_WS_URL=ws://localhost:4000
```

---

## API Reference

### Authentication

#### POST /api/auth/register
Register new user

```json
{
  "username": "john",
  "email": "john@example.com",
  "password": "password123"
}
```

#### POST /api/auth/login
Login user

```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

### Servers

#### GET /api/servers
Get all servers

#### POST /api/servers
Create server

#### PUT /api/servers/:id
Update server

#### DELETE /api/servers/:id
Delete server

### GPUs

#### POST /api/gpu/allocate
Allocate GPU

#### POST /api/gpu/release/:id
Release GPU

### Tasks

#### GET /api/tasks
Get all tasks

#### POST /api/tasks
Create task

#### POST /api/tasks/:id/cancel
Cancel task

---

## Frontend Guide

### Component Structure

```
src/
├── components/     # Reusable components
├── pages/         # Page components
├── services/      # API clients
├── store/         # State management
├── styles/        # CSS styles
└── utils/         # Utilities
```

### State Management

Using Zustand for state management:

```typescript
import { create } from 'zustand';

interface AuthStore {
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  login: (user, token) => set({ user, token }),
  logout: () => set({ user: null, token: null }),
}));
```

---

## Deployment

### Docker Deployment

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f
```

### Production Checklist

- [ ] Update environment variables
- [ ] Configure SSL/TLS
- [ ] Set up database backups
- [ ] Configure monitoring
- [ ] Set up log rotation
- [ ] Configure firewall rules
- [ ] Enable rate limiting
- [ ] Test 2FA functionality

---

## Monitoring

### Metrics

- System metrics (CPU, memory, disk)
- Database metrics (connections, queries)
- Cache metrics (hits, misses)
- Application metrics (requests, errors)

### Alerts

- High CPU usage (>90%)
- High memory usage (>90%)
- Database connection pool exhausted
- High API error rate (>5%)

---

## Security

### Authentication

- JWT-based authentication
- 2FA support (TOTP)
- Session management
- Password hashing (bcrypt)

### Authorization

- Role-based access control (RBAC)
- Permission checks on all endpoints
- Audit logging for sensitive operations

### Best Practices

- Use HTTPS in production
- Rotate JWT secrets regularly
- Enable rate limiting
- Validate all inputs
- Sanitize outputs
- Keep dependencies updated

---

## Troubleshooting

### Common Issues

#### Database Connection Failed
```bash
# Check PostgreSQL is running
pg_isready

# Check connection string
echo $DATABASE_URL
```

#### Redis Connection Failed
```bash
# Check Redis is running
redis-cli ping

# Should return: PONG
```

#### Port Already in Use
```bash
# Find process using port
lsof -i :4000

# Kill process
kill -9 <PID>
```

#### Debugging with requestId

Every API response (especially errors) includes a `requestId` field. Use it to correlate frontend errors with backend logs:

```bash
# Find all log entries for a specific request
grep "requestId=abc-123" /var/log/lsm/backend.log

# Error responses include requestId in the JSON body:
# { "success": false, "error": { "code": "...", "requestId": "abc-123", ... } }
```

---

## Testing

### Test Suite Overview

| Suite | Framework | Tests | Pass Rate |
|-------|-----------|-------|-----------|
| Backend Unit + Integration | Jest | 783/832 | 94% |
| Frontend Pages | Vitest | 58/60 | 97% |
| E2E (Playwright) | Playwright | 98/98 | 100% |

### Running Tests

```bash
# Backend tests (with coverage)
cd src/backend
npm test -- --coverage

# Frontend tests
cd src/frontend
npm run test:run

# E2E tests (requires running app)
cd e2e
npx playwright test
```

### Coverage

| Metric | Current |
|--------|---------|
| Backend Statements | ~34% |
| Backend Branches | ~26% |
| Backend Functions | ~33% |
| Backend Lines | ~35% |

### Test File Locations

- **Backend integration**: `src/backend/src/__tests__/integration/`
- **Backend services**: `src/backend/src/__tests__/services/`
- **Frontend pages**: `src/frontend/src/pages/__tests__/`
- **E2E specs**: `e2e/tests/`

---

## Documentation

### User Documentation

- **User Manual** (`docs/USER_MANUAL.md`) - Complete user guide covering all features
  - Chapter 18: Resource Reservation Management (Server & Cluster)
  - Chapter 19: Requirements Management

### Operations Documentation

- **Operations Manual** (`docs/OPERATIONS_MANUAL.md`) - DevOps guide
  - Chapter 20: Reservation System Operations

### API Documentation

- **Backend API** (`backend/docs/API.md`) - REST API reference
- **OpenAPI Spec** - Available at `/api/docs` when running

---

## Support

For issues and questions:
- GitHub Issues: [Link]
- Documentation: [Link]
- Email: support@lsm.local

---

**Last Updated**: 2026-03-28
**Version**: 3.2.2
**Status**: Production Ready ✅
