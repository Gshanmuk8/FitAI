# Build context must be the REPO ROOT (not server/) — this is a npm
# workspaces monorepo and server/ imports ../shared at runtime.
FROM node:22-alpine

WORKDIR /app

# Manifests first so the install layer stays cached until deps change.
# The only lockfile lives at the workspace root; per-workspace lockfiles
# do not exist and must not be referenced.
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY shared/package.json shared/package.json
COPY client/package.json client/package.json

# Install at the workspace root so dependencies hoist to /app/node_modules,
# which is on the resolution path for BOTH /app/server and /app/shared.
# Installing inside server/ breaks shared/'s require('zod'). Client deps
# are excluded — this image only runs the backend.
RUN npm ci --omit=dev --workspace=server --workspace=shared --include-workspace-root --no-audit --no-fund

COPY shared ./shared
COPY server ./server

ENV NODE_ENV=production
EXPOSE 4000

WORKDIR /app/server
CMD ["node", "server.js"]
