FROM node:22 AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN npm run build

RUN rm -rf node_modules && npm ci --omit=dev && npm cache clean --force

FROM node:22-slim

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

COPY server.ts ./
COPY server/ ./server/
COPY metadata.json ./

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080

CMD ["node", "node_modules/.bin/tsx", "server.ts"]
