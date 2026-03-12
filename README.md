# LSM Project - Complete Documentation

**Version**: 3.0.0  
**Last Updated**: 2026-03-12  
**Status**: Production Ready

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
11. [Troubleshooting](#troubleshooting)

---

## Overview

Laboratory Server Management System (LSM) is a comprehensive platform for managing laboratory server resources, GPU allocation, and task scheduling.

### Key Capabilities

- 🖥️ **Server Management** - Manage multiple servers with status tracking
- 🎮 **GPU Allocation** - Dynamic GPU resource allocation and recycling
- 📋 **Task Scheduling** - Priority-based task scheduling system
- 📊 **Real-time Monitoring** - Live monitoring with WebSocket updates
- 🔐 **Security** - JWT authentication, 2FA, audit logging
- 📧 **Notifications** - Email notifications for events
- 📱 **Mobile Ready** - Responsive design for mobile devices

---

## Features

### Core Features

| Feature | Status | Description |
|---------|--------|-------------|
| User Authentication | ✅ | JWT-based auth with 2FA |
| Server Management | ✅ | CRUD operations for servers |
| GPU Allocation | ✅ | Dynamic allocation with filtering |
| Task Scheduling | ✅ | Priority-based scheduling |
| Real-time Monitoring | ✅ | WebSocket-based updates |
| Email Notifications | ✅ | Event-driven email alerts |
| Data Export | ✅ | CSV/Excel export |
| Mobile Responsive | ✅ | Mobile-first design |
| Audit Logging | ✅ | Complete audit trail |
| Redis Caching | ✅ | Performance optimization |

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

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Redis 7+
- npm or yarn

### Backend Setup

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

### Frontend Setup

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

---

## Support

For issues and questions:
- GitHub Issues: [Link]
- Documentation: [Link]
- Email: support@lsm.local

---

**Last Updated**: 2026-03-12  
**Version**: 3.0.0  
**Status**: Production Ready
