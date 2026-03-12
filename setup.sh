#!/bin/bash

# LSM Project Setup Script

set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║   Laboratory Server Management System - Setup            ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✅ Node.js version: $(node -v)"
echo ""

# Setup Backend
echo "📦 Setting up Backend..."
cd backend

if [ ! -d "node_modules" ]; then
    echo "Installing backend dependencies..."
    npm install
fi

if [ ! -f ".env" ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env
fi

echo "Generating Prisma client..."
npx prisma generate

echo "Running database migrations..."
npx prisma migrate dev --name init

cd ..
echo "✅ Backend setup complete!"
echo ""

# Setup Frontend
echo "📦 Setting up Frontend..."
cd frontend

if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

if [ ! -f ".env" ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env
fi

cd ..
echo "✅ Frontend setup complete!"
echo ""

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║   Setup Complete! 🎉                                     ║"
echo "║                                                           ║"
echo "║   To start the development servers:                      ║"
echo "║                                                           ║"
echo "║   Terminal 1 (Backend):                                  ║"
echo "║   $ cd backend && npm run dev                            ║"
echo "║                                                           ║"
echo "║   Terminal 2 (Frontend):                                 ║"
echo "║   $ cd frontend && npm run dev                           ║"
echo "║                                                           ║"
echo "║   Or use Docker:                                         ║"
echo "║   $ docker-compose up -d                                 ║"
echo "║                                                           ║"
echo "║   Access:                                                ║"
echo "║   - Frontend: http://localhost:3000                      ║"
echo "║   - Backend API: http://localhost:8080                   ║"
echo "║   - API Docs: http://localhost:8080/api-docs             ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
