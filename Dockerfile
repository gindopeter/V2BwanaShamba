FROM node:20-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN npm run build

FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev && npm install tsx

COPY --from=builder /app/dist ./dist

COPY server.ts ./
COPY server/ ./server/
COPY metadata.json ./

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080

CMD ["npx", "tsx", "server.ts"]
