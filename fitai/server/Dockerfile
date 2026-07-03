FROM node:22-alpine

WORKDIR /app/server

COPY server/package.json ./
COPY server/package-lock.json ./

RUN npm install --omit=dev --no-audit --no-fund

COPY shared /app/shared
COPY server .

ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "server.js"]
