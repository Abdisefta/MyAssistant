# My Assistant — Admin Analytics

Webb-dashboard för dig som ägare: användare, nedladdningar, aktivitet, utgifter och serverstatus.

## Vad du ser

- **Enheter** — hur många som installerat/använder appen
- **Aktiva idag / 7 dagar** — unika enheter
- **Öppningar & chattar** — diagram senaste 30 dagarna
- **App-versioner** — vilken APK folk kör
- **Utgifter** — lägg till Hetzner, domän, API m.m. (engång eller månadsvis)
- **Uppskattade API-kostnader** — baserat på Gemini/TTS-användning
- **Alma TTS-status** — ping mot TTS-servern

## Starta lokalt (test)

```bash
cd analytics-server
npm install
set ADMIN_PASSWORD=ditt-losenord
set ANALYTICS_API_KEY=myassistant-analytics-key
npm start
```

Öppna **http://localhost:3002** → logga in med `ADMIN_PASSWORD`.

## Produktion (Hetzner VPS)

På samma server som Alma TTS (195.201.128.118):

```bash
cd analytics-server
cp .env.example .env   # sätt starkt lösenord + API-nyckel
docker compose up -d --build
```

Öppna **http://195.201.128.118:3002**

Öppna port **3002** i Hetzner-brandväggen.

### Miljövariabler

| Variabel | Beskrivning |
|----------|-------------|
| `ADMIN_PASSWORD` | Lösenord till dashboard |
| `ANALYTICS_API_KEY` | Måste matcha appens `EXPO_PUBLIC_ANALYTICS_API_KEY` |
| `TTS_HEALTH_URL` | URL till Alma `/health` (default localhost:3001) |

## App-koppling

I appens `.env`:

```env
EXPO_PUBLIC_ANALYTICS_URL=http://195.201.128.118:3002
EXPO_PUBLIC_ANALYTICS_API_KEY=samma-som-servern
```

Bygg om APK efter ändring. Appen skickar anonymt:

- `install` — första gången
- `app_open` — varje start
- `assistant_message` — varje chatt
- `tts_request` / `gemini_request` — API-användning

Ingen personlig data (namn, e-post) skickas — bara anonym enhets-ID.

## Säkerhet

- Byt **ADMIN_PASSWORD** och **ANALYTICS_API_KEY** i produktion
- Överväg nginx + HTTPS + IP-begränsning för port 3002
- Data sparas i SQLite-volym (`analytics-data`)
