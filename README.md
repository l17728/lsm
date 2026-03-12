# Laboratory Server Management System (LSM)

A comprehensive system for managing laboratory servers, GPU resources, and task scheduling.

## Features

### Backend
- **User Authentication & Authorization**
  - JWT-based authentication
  - Role-based access control (Admin, Manager, User)
  - Secure password hashing with bcrypt

- **Server Resource Management**
  - Add, edit, delete servers
  - Track server status (Online, Offline, Maintenance, Error)
  - Monitor CPU, memory, and GPU resources

- **GPU Resource Allocation**
  - Dynamic GPU allocation and release
  - Track GPU usage and availability
  - Support for multiple GPU models

- **Task Scheduling**
  - Create and manage computational tasks
  - Priority-based scheduling
  - Task status tracking (Pending, Running, Completed, Failed)

- **Real-time Monitoring**
  - WebSocket-based real-time updates
  - Server health monitoring
  - Resource usage metrics
  - Alert system for critical conditions

- **RESTful API**
  - OpenAPI/Swagger documentation
  - Comprehensive error handling
  - Rate limiting ready

### Frontend
- **Modern React Application**
  - Responsive design with Ant Design
  - Real-time updates via WebSocket
  - Interactive charts and visualizations

- **Dashboard**
  - System overview with key metrics
  - Resource usage charts
  - Active alerts display

- **Server Management**
  - Server list with status indicators
  - Add/edit/delete servers
  - GPU allocation tracking

- **GPU Management**
  - Allocate and release GPUs
  - View allocation history
  - Real-time GPU status

- **Task Management**
  - Create and monitor tasks
  - Priority management
  - Task cancellation

- **Monitoring**
  - Real-time server health
  - Resource usage trends
  - Alert management

## Tech Stack

### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: SQLite (via Prisma ORM)
- **Authentication**: JWT
- **Real-time**: Socket.IO
- **Documentation**: Swagger/OpenAPI

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Library**: Ant Design
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (React Query)
- **Charts**: Recharts
- **Real-time**: Socket.IO Client

## Project Structure

```
lsm-project/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── store/
│   │   ├── styles/
│   │   ├── utils/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev --name init

# Start development server
npm run dev
```

Backend will be available at `http://localhost:8080`
API documentation at `http://localhost:8080/api-docs`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend will be available at `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/password` - Change password

### Servers
- `GET /api/servers` - List all servers
- `GET /api/servers/:id` - Get server details
- `POST /api/servers` - Create server (Admin)
- `PUT /api/servers/:id` - Update server (Manager+)
- `DELETE /api/servers/:id` - Delete server (Admin)
- `GET /api/servers/stats` - Server statistics

### GPU
- `POST /api/gpu/allocate` - Allocate GPU
- `POST /api/gpu/release/:id` - Release GPU
- `GET /api/gpu/my-allocations` - Get user's allocations
- `GET /api/gpu/stats` - GPU statistics

### Tasks
- `GET /api/tasks` - List user's tasks
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id` - Update task
- `POST /api/tasks/:id/cancel` - Cancel task
- `GET /api/tasks/stats` - Task statistics

### Monitoring
- `GET /api/monitoring/health` - Server health status
- `GET /api/monitoring/cluster-stats` - Cluster statistics
- `GET /api/monitoring/alerts` - Active alerts
- `POST /api/monitoring/collect` - Trigger metrics collection

## Environment Variables

### Backend (.env)
```env
PORT=8080
NODE_ENV=development
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=24h
CORS_ORIGINS=http://localhost:3000
DATABASE_URL=file:./prisma/dev.db
SCHEDULER_ENABLED=true
SCHEDULER_INTERVAL_MS=5000
MONITORING_ENABLED=true
MONITORING_INTERVAL_MS=10000
```

## Default Admin Account

After first run, create an admin user via the registration endpoint or API:

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","email":"admin@example.com","password":"admin123"}'
```

Then manually update the role in the database or via API if you have access.

## WebSocket Events

### Client → Server
- `join:user` - Join user-specific room
- `subscribe:servers` - Subscribe to server updates
- `subscribe:gpus` - Subscribe to GPU updates
- `subscribe:tasks` - Subscribe to task updates

### Server → Client
- `servers:update` - Server status/metrics update
- `gpus:update` - GPU allocation update
- `tasks:update` - Task statistics update
- `task:update` - Individual task update
- `alerts:new` - New system alerts

## Development

### Backend Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test` - Run tests
- `npm run docs` - Generate Swagger docs

### Frontend Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Production Deployment

### Backend
```bash
cd backend
npm install --production
npx prisma migrate deploy
npm run build
npm start
```

### Frontend
```bash
cd frontend
npm install
npm run build
# Serve the dist/ directory with a static file server
```

## Security Considerations

1. Change the default JWT secret in production
2. Use HTTPS in production
3. Implement rate limiting for API endpoints
4. Enable CORS only for trusted origins
5. Regular security audits and dependency updates

## License

MIT

## Support

For issues and feature requests, please open an issue in the repository.
