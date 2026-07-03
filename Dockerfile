# Backend image, buildable from the REPO ROOT with default Render settings
# (no Root Directory, default Dockerfile path). The project lives in the
# fitai/ subfolder; this file reaches into it so Render needs no special
# path configuration. Mirrors fitai/server/Dockerfile, which docker-compose
# still uses for local dev.
FROM node:22-alpine

WORKDIR /app

# Workspace manifests first so the install layer stays cached until deps
# change. The only lockfile lives at the workspace root.
COPY fitai/package.json fitai/package-lock.json ./
COPY fitai/server/package.json server/package.json
COPY fitai/shared/package.json shared/package.json
COPY fitai/client/package.json client/package.json

# Install at the workspace root so dependencies land where BOTH server/
# and shared/ can resolve them. Client deps are excluded — this image
# only runs the backend.
RUN npm ci --omit=dev --workspace=server --workspace=shared --include-workspace-root --no-audit --no-fund

COPY fitai/shared ./shared
COPY fitai/server ./server

ENV NODE_ENV=production
EXPOSE 4000

WORKDIR /app/server
CMD ["node", "server.js"]
