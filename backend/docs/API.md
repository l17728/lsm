# API Documentation

## Base URL

```
http://localhost:8080/api
```

## Authentication

All API endpoints (except login/register) require JWT authentication.

Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### Authentication

#### Register User
```
POST /auth/register
```

**Request Body:**
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "johndoe",
    "email": "john@example.com",
    "role": "USER",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

#### Login
```
POST /auth/login
```

**Request Body:**
```json
{
  "username": "johndoe",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "jwt-token-here",
    "user": {
      "id": "uuid",
      "username": "johndoe",
      "email": "john@example.com",
      "role": "USER"
    }
  }
}
```

#### Logout
```
POST /auth/logout
```

**Headers:**
```
Authorization: Bearer <token>
```

#### Get Current User
```
GET /auth/me
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "johndoe",
    "email": "john@example.com",
    "role": "USER"
  }
}
```

---

### Servers

#### Get All Servers
```
GET /servers
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "GPU-Server-01",
      "hostname": "gpu01.lab.local",
      "ipAddress": "192.168.1.100",
      "status": "ONLINE",
      "cpuCores": 32,
      "totalMemory": 128,
      "gpuCount": 4,
      "gpus": [...],
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### Get Server by ID
```
GET /servers/:id
```

#### Create Server (Admin)
```
POST /servers
```

**Request Body:**
```json
{
  "name": "GPU-Server-02",
  "hostname": "gpu02.lab.local",
  "ipAddress": "192.168.1.101",
  "cpuCores": 64,
  "totalMemory": 256,
  "gpuCount": 8,
  "gpus": [
    {
      "deviceId": 0,
      "model": "NVIDIA A100",
      "memory": 40
    }
  ]
}
```

#### Update Server (Manager+)
```
PUT /servers/:id
```

#### Delete Server (Admin)
```
DELETE /servers/:id
```

#### Get Server Stats
```
GET /servers/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 5,
    "online": 4,
    "offline": 1,
    "maintenance": 0,
    "error": 0,
    "totalGpus": 20,
    "availableGpus": 15
  }
}
```

---

### GPU

#### Allocate GPU
```
POST /gpu/allocate
```

**Request Body (optional):**
```json
{
  "gpuModel": "NVIDIA A100",
  "minMemory": 40
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "allocationId": "uuid",
    "gpuId": "uuid",
    "serverId": "uuid",
    "serverName": "GPU-Server-01",
    "gpuModel": "NVIDIA A100",
    "gpuMemory": 40,
    "deviceId": 0,
    "startTime": "2024-01-01T00:00:00Z"
  }
}
```

#### Release GPU
```
POST /gpu/release/:allocationId
```

#### Get My Allocations
```
GET /gpu/my-allocations
```

#### Get GPU Stats
```
GET /gpu/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 20,
    "available": 15,
    "allocated": 5,
    "error": 0,
    "maintenance": 0,
    "byModel": {
      "NVIDIA A100": 10,
      "NVIDIA V100": 10
    }
  }
}
```

---

### Tasks

#### Get My Tasks
```
GET /tasks
```

**Query Parameters:**
- `status` (optional): Filter by status (PENDING, RUNNING, COMPLETED, FAILED, CANCELLED)
- `limit` (optional): Number of tasks to return (default: 50)

#### Create Task
```
POST /tasks
```

**Request Body:**
```json
{
  "name": "Model Training",
  "description": "Train ResNet-50 on ImageNet",
  "priority": 5
}
```

#### Cancel Task
```
POST /tasks/:id/cancel
```

#### Delete Task
```
DELETE /tasks/:id
```

#### Get Task Stats
```
GET /tasks/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 100,
    "pending": 10,
    "running": 5,
    "completed": 80,
    "failed": 3,
    "cancelled": 2
  }
}
```

---

### Monitoring

#### Get Server Health
```
GET /monitoring/health
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "serverId": "uuid",
      "serverName": "GPU-Server-01",
      "status": "ONLINE",
      "cpuUsage": 45.5,
      "memoryUsage": 62.3,
      "gpuUsage": 78.2,
      "temperature": 65.4,
      "lastUpdate": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### Get Cluster Stats
```
GET /monitoring/cluster-stats
```

#### Get Alerts
```
GET /monitoring/alerts
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "type": "warning",
      "serverId": "uuid",
      "serverName": "GPU-Server-01",
      "message": "High CPU usage",
      "value": 85.5,
      "threshold": 80
    }
  ]
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

### Common HTTP Status Codes

- `200 OK` - Successful request
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

---

## Rate Limiting

Rate limiting is not implemented in the current version but is recommended for production deployments.

---

## WebSocket API

### Connection

Connect to WebSocket endpoint:
```
ws://localhost:8080
```

Include authentication token:
```javascript
const socket = io({
  auth: { token: 'your-jwt-token' }
});
```

### Client Events

#### Join User Room
```javascript
socket.emit('join:user', userId);
```

#### Subscribe to Updates
```javascript
socket.emit('subscribe:servers');
socket.emit('subscribe:gpus');
socket.emit('subscribe:tasks');
```

### Server Events

#### Server Updates
```javascript
socket.on('servers:update', (data) => {
  console.log('Server update:', data);
});
```

#### GPU Updates
```javascript
socket.on('gpus:update', (data) => {
  console.log('GPU update:', data);
});
```

#### Task Updates
```javascript
socket.on('tasks:update', (data) => {
  console.log('Task update:', data);
});
```

#### Alerts
```javascript
socket.on('alerts:new', (data) => {
  console.log('New alerts:', data);
});
```
