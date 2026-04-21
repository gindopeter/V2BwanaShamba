FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-pip python3-venv curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY requirements.txt ./
RUN python3 -m pip install --break-system-packages --no-cache-dir -r requirements.txt

COPY server.ts tsconfig.json ./
COPY server/ ./server/
COPY adk_service/ ./adk_service/
COPY --from=builder /app/dist ./dist

COPY docker-start.sh ./
RUN chmod +x docker-start.sh

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080
ENV ADK_PORT=8001
ENV GOOGLE_GENAI_USE_VERTEXAI=false

CMD ["./docker-start.sh"]
