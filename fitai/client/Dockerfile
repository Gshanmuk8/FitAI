# Dev-oriented image matching docker-compose (Vite dev server with the
# source mounted in). For production, run `npm run build` and serve dist/
# from any static host instead.
FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]
