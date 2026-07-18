FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Firebase web-app config (public client identifiers) — must be present at
# build time because Vite bakes VITE_* vars into the JS bundle.
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_APP_ID
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
    VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN \
    VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID \
    VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID

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
