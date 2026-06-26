FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y python3 make g++ curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY src ./src
COPY public ./public

RUN mkdir -p /data
ENV DATA_DIR=/data
ENV PORT=3002

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=8s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3002/health || exit 1

CMD ["node", "src/server.js"]
