# LSM Frontend Dockerfile - Production Ready
# Multi-stage build with nginx for static file serving

# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:20-alpine AS dependencies

WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (use npm install for better compatibility)
RUN npm install

# ============================================
# Stage 2: Builder
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies from previous stage
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY tsconfig.node.json ./
COPY index.html ./
COPY public ./public
COPY src ./src

# Build arguments for environment-specific configuration
ARG VITE_API_BASE_URL=http://localhost:8080/api
ARG VITE_WS_URL=ws://localhost:8080
ARG VITE_APP_VERSION=1.0.0

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_APP_VERSION=$VITE_APP_VERSION

# Build application
RUN npm run build

# ============================================
# Stage 3: Production
# ============================================
FROM nginx:alpine AS production

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Graceful shutdown
STOPSIGNAL SIGTERM

# Start nginx
CMD ["nginx", "-g", "daemon off;"]