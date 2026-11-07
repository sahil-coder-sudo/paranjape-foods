# Backend Dockerfile for Paranjape Foods Express API
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=4000

# Install dependencies required for healthcheck
RUN apk add --no-cache curl

# Copy dependency manifests
COPY package.json ./

# Install production dependencies only
RUN npm install --only=production --no-audit

# Copy application source code
COPY models/ ./models/
COPY utils/ ./utils/
COPY scripts/ ./scripts/
COPY server.js ./

# Create logs directory and ensure proper write permissions
RUN mkdir -p logs && chown -R node:node /app

# Switch to non-root user
USER node

# Expose backend port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fs http://localhost:4000/api/health || exit 1

CMD ["node", "server.js"]
