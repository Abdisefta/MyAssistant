# Alma TTS (Piper)

Självhostad svensk röst **sv_SE-alma-medium** för My Assistant. Gratis att köra — ingen Azure/Google TTS.

## Krav

- Docker + Docker Compose
- ~300 MB disk (Piper + röstmodell)

## Starta lokalt

```bash
cd tts-server
docker compose up --build
```

Servern lyssnar på **http://localhost:3001**

- Hälsa: `GET /health`
- TTS: `POST /api/tts` med JSON `{ "text": "Hej!" }` → WAV

## App-inställning

I projektroten, fil `.env`:

```env
# Emulator (Android): http://10.0.2.2:3001
# Telefon på samma WiFi: http://192.168.x.x:3001  (din dators IP)
# VPS: https://tts.dindoman.se
EXPO_PUBLIC_ALMA_TTS_URL=http://localhost:3001
```

Bygg om appen efter ändring av `.env`.

## VPS (produktion)

1. Kopiera mappen `tts-server` till servern.
2. `docker compose up -d --build`
3. Sätt `EXPO_PUBLIC_ALMA_TTS_URL` till serverns URL (HTTPS rekommenderas via nginx/Caddy).
4. Öppna port **3001** i brandväggen om appen anropar direkt, eller proxya via 443.

Valfri miljövariabel i `docker-compose.yml`:

- `TTS_PORT` — extern port (standard 3001)

## HTTPS (valfritt — kräver domän)

HTTP funkar i appen idag (v1.7.5+ med cleartext). För produktion rekommenderas HTTPS:

1. Peka domän (t.ex. `tts.example.com`) till VPS IP
2. Installera Caddy eller nginx + Let's Encrypt
3. Proxy till `localhost:3001`
4. Sätt `EXPO_PUBLIC_ALMA_TTS_URL=https://tts.example.com` och bygg om appen

Exempel (Caddy):

```
tts.example.com {
  reverse_proxy localhost:3001
}
```

## Felsökning

- `503` på `/health` — rösten laddades inte; bygg om imagen.
- Appen hör inget — `localhost` fungerar inte från fysisk telefon; använd datorns LAN-IP.
- Timeout — kontrollera att servern körs och att telefonen når den.
