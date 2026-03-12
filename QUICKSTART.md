# Quick Start Guide

## Option 1: Development Setup (Recommended for Development)

### 1. Run Setup Script

```bash
cd /root/.openclaw/workspace/lsm-project
./setup.sh
```

### 2. Start Backend

```bash
cd backend
npm run dev
```

Backend will start on `http://localhost:8080`

### 3. Start Frontend (in a new terminal)

```bash
cd frontend
npm run dev
```

Frontend will start on `http://localhost:3000`

### 4. Create First User

Open your browser to `http://localhost:3000` and register a new account.

To make the first user an admin, you'll need to update the database:

```bash
cd backend
npx prisma studio
```

Find your user in the User table and change the role from `USER` to `ADMIN`.

---

## Option 2: Docker Deployment (Recommended for Production)

### 1. Build and Start

```bash
cd /root/.openclaw/workspace/lsm-project
docker-compose up -d --build
```

### 2. Access the Application

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8080`
- API Documentation: `http://localhost:8080/api-docs`

### 3. Stop the Application

```bash
docker-compose down
```

---

## First Steps After Installation

### 1. Register an Account

Visit `http://localhost:3000` and register with:
- Username: Your choice
- Email: Your email
- Password: Your password

### 2. Make Yourself Admin (Optional)

```bash
cd backend
npx prisma studio
```

1. Click on the `User` table
2. Find your user
3. Double-click the `role` field
4. Change from `USER` to `ADMIN`
5. Click "Save"

### 3. Add Your First Server

1. Login to the application
2. Navigate to "Servers" in the sidebar
3. Click "Add Server"
4. Fill in the server details:
   - Name: e.g., "GPU-Server-01"
   - Hostname: e.g., "gpu01.lab.local"
   - IP Address: e.g., "192.168.1.100"
   - CPU Cores: e.g., 32
   - Total Memory: e.g., 128 (GB)
   - GPU Count: e.g., 4
5. Click "OK"

### 4. Allocate a GPU

1. Navigate to "GPUs" in the sidebar
2. Click "Allocate GPU"
3. Confirm the allocation
4. Your GPU allocation will appear in the table

### 5. Create a Task

1. Navigate to "Tasks" in the sidebar
2. Click "Create Task"
3. Fill in task details:
   - Task Name: e.g., "Model Training"
   - Description: Optional description
   - Priority: 0-10 (higher = more important)
4. Click "OK"

---

## API Testing

### Using cURL

```bash
# Register a new user
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"password123"}'

# Use the token from login response for authenticated requests
TOKEN="your-jwt-token-here"

# Get servers
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/servers

# Allocate GPU
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  http://localhost:8080/api/gpu/allocate
```

### Using Swagger UI

Visit `http://localhost:8080/api-docs` to explore and test all API endpoints interactively.

---

## Troubleshooting

### Backend won't start

1. Check if port 8080 is already in use:
   ```bash
   lsof -i :8080
   ```

2. Check database migrations:
   ```bash
   cd backend
   npx prisma migrate dev
   ```

3. Check logs for errors

### Frontend won't start

1. Check if port 3000 is already in use:
   ```bash
   lsof -i :3000
   ```

2. Clear node_modules and reinstall:
   ```bash
   rm -rf node_modules
   npm install
   ```

### WebSocket not connecting

1. Ensure backend is running
2. Check browser console for errors
3. Verify CORS settings in backend `.env`

### Database errors

1. Reset the database (development only):
   ```bash
   cd backend
   npx prisma migrate reset
   ```

---

## Next Steps

- Read the full [README.md](./README.md) for detailed documentation
- Explore the API documentation at `/api-docs`
- Customize the system for your lab's needs
- Set up monitoring alerts
- Configure production deployment

## Support

For issues or questions, check the documentation or contact the development team.
