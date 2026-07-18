FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Firebase web-app config (public client identifiers) — must be present at
# build time because Vite bakes VITE_* vars into the JS bundle. Defaults are
# set here because the Cloud Run source-deploy trigger builds this Dockerfile
# directly and passes no build args (cloudbuild.yaml is not used by it).
ARG VITE_FIREBASE_API_KEY=AIzaSyCZgJlddSr3ae_VGFOGkJFK8lcEbaoRHWw
ARG VITE_FIREBASE_AUTH_DOMAIN=bwanashamba-80509.firebaseapp.com
ARG VITE_FIREBASE_PROJECT_ID=bwanashamba-80509
ARG VITE_FIREBASE_APP_ID=1:858030531593:web:aa1f8197d340eea77744d8
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
# Public Firebase web API key — the server validates phone-auth ID tokens with
# it via accounts:lookup. A FIREBASE_API_KEY service env var overrides this.
ENV VITE_FIREBASE_API_KEY=AIzaSyCZgJlddSr3ae_VGFOGkJFK8lcEbaoRHWw

CMD ["./docker-start.sh"]
