FROM node:22

RUN apt-get update && apt-get install -y python3 python3-pip python3-venv && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY requirements.txt ./
RUN python3 -m pip install --break-system-packages -r requirements.txt

COPY . .

RUN npm run build

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080
ENV ADK_PORT=8001
ENV GOOGLE_GENAI_USE_VERTEXAI=false

COPY docker-start.sh ./
RUN chmod +x docker-start.sh

CMD ["./docker-start.sh"]
