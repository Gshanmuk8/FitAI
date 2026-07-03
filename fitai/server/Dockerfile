# Build from the REPO ROOT (the server imports ../shared), e.g.:
#   docker build -f server/Dockerfile -t fitai-server .
# docker-compose.yml already sets this context correctly.
FROM node:22-alpine

WORKDIR /app/server

COPY server/package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY shared /app/shared
COPY server .

ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "server.js"]
