# Stage 1: Build stage
FROM node:24-alpine AS builder

WORKDIR /app

# Enable pnpm and disable supply-chain release-age check (required in CI)
RUN corepack enable && corepack prepare pnpm@latest --activate && \
    pnpm config set minimum-release-age 0

# Copy lock files and package definitions
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy project source
COPY . .

# Build application
RUN pnpm run build

# Stage 2: Production runner stage
FROM node:24-alpine AS runner

WORKDIR /app

# Enable pnpm and disable supply-chain release-age check (required in CI)
RUN corepack enable && corepack prepare pnpm@latest --activate && \
    pnpm config set minimum-release-age 0

# Copy lock files and package definitions
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built dist and server files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server

# Expose default port
ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

# Health check (Node fetch — alpine image has no wget by default)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]