FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV PIPER_VERSION=1.2.0
ENV PIPER_BIN=/opt/piper/piper
ENV PIPER_MODEL=/voices/sv_SE-alma-medium.onnx
ENV NODE_ENV=production
ENV PORT=3001
ENV LD_LIBRARY_PATH=/opt/piper

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    libespeak-ng1 \
    libgomp1 \
    libstdc++6 \
    nodejs \
    npm \
  && rm -rf /var/lib/apt/lists/*

# Piper binary and bundled libraries (Linux x86_64)
RUN curl -fsSL "https://github.com/rhasspy/piper/releases/download/v${PIPER_VERSION}/piper_amd64.tar.gz" \
  | tar -xz -C /opt \
  && chmod +x /opt/piper/piper

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY src ./src
COPY scripts/download-voice.sh /usr/local/bin/download-voice.sh
RUN chmod +x /usr/local/bin/download-voice.sh \
  && /usr/local/bin/download-voice.sh /voices

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3001/health | grep -q '"ok":true'

CMD ["node", "src/server.js"]