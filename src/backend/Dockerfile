# LSM Backend Dockerfile - Optimized Version
# 使用 node:20-slim 替代 node:20，镜像大小从 ~1.1GB 降到 ~240MB
# Prisma 兼容：slim 版本使用 glibc，与 Prisma 完全兼容

# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:20-slim AS dependencies

WORKDIR /app

# 安装编译依赖（Prisma 需要）
RUN apt-get update && apt-get install -y \
    openssl \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for build)
RUN npm ci

# ============================================
# Stage 2: Builder
# ============================================
FROM node:20-slim AS builder

WORKDIR /app

# 安装运行时依赖
RUN apt-get update && apt-get install -y \
    openssl \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Copy dependencies from previous stage
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY prisma ./prisma/
COPY tsconfig*.json ./

# Copy source code
COPY src ./src
COPY swagger.js swagger-output.json ./

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript to JavaScript
RUN npm run build

# ============================================
# Stage 3: Production (优化版)
# ============================================
FROM node:20-slim AS production

# 安装运行时依赖（Prisma 需要）
RUN apt-get update && apt-get install -y \
    openssl \
    libssl3 \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Add non-root user for security
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -m -s /bin/bash nodejs

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built files from builder
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/swagger-output.json ./
COPY --from=builder /app/swagger.js ./

# Change ownership to non-root user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 8080

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV PRISMA_CLI_QUERY_ENGINE_TYPE=binary

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Graceful shutdown
STOPSIGNAL SIGTERM

# Start application with migration
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]