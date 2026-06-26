#!/bin/bash
# Klistra in detta i Hetzner Web Console (root-login) om SSH-lösenord inte fungerar ännu.
set -euo pipefail

ADMIN_PASSWORD="${ADMIN_PASSWORD:-MyAssistant-Admin-2026}"
ANALYTICS_API_KEY="${ANALYTICS_API_KEY:-myassistant-analytics-key}"

echo "==> Docker"
docker --version || (apt-get update && apt-get install -y docker.io docker-compose-plugin)

echo "==> Hämta analytics-server"
rm -rf /tmp/ma-repo /opt/myassistant-analytics
git clone --depth 1 https://github.com/Abdisefta/MyAssistant.git /tmp/ma-repo
cp -r /tmp/ma-repo/analytics-server /opt/myassistant-analytics
rm -rf /tmp/ma-repo

cat > /opt/myassistant-analytics/.env << EOF
ADMIN_PASSWORD=${ADMIN_PASSWORD}
ANALYTICS_API_KEY=${ANALYTICS_API_KEY}
TTS_HEALTH_URL=http://127.0.0.1:3001/health
EOF

echo "==> Starta dashboard"
cd /opt/myassistant-analytics
docker compose up -d --build

echo "==> Brandvägg (ufw)"
if command -v ufw >/dev/null; then
  ufw allow 3002/tcp || true
fi

sleep 3
curl -fsS http://127.0.0.1:3002/health && echo ""
echo ""
echo "KLAR: http://195.201.128.118:3002"
echo "Lösenord: ${ADMIN_PASSWORD}"
