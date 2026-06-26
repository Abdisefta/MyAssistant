# My Assistant — projektstatus

**Senast uppdaterad:** 2025-06-25 · **Version:** 1.7.6 (versionCode 22)

**Läs först:** `SNART-KLART.md` (kort för Abdi) eller `HANDOFF-AGENT.md` (för Cursor-agent).

## Projekt

| | |
|--|--|
| App | My Assistant (Expo React Native, SDK 54) |
| Sökväg | `C:\Users\user\My-assistent\MyAssistant\MyAssistantFinal` |
| Paket | `com.abdisefta.myassistantfinal` |
| GitHub | https://github.com/Abdisefta/MyAssistant |
| Firebase | `my-assistant-7f68b` |
| Alma TTS | `http://195.201.128.118:3001` (Hetzner VPS) |
| EAS | `abdisefta` / projectId `22e289d9-e041-4b20-a6c8-ec007b28d559` |

## Fungerar på telefon (bekräftat)

- Gästläge, hem, kalender, uppgifter, assistent (text + röst)
- Alma TTS (v1.7.5 — Android cleartext + base64-fix)
- Profilbild från galleri
- 24 språk, notiser, sjuk-dag med bekräftelse
- Lokal release-APK via `build-175.ps1` → Desktop

## Blockerat — kräver användaren

1. **Gmail / Google Sign-In** — SHA-1 i Firebase för release-keystore
2. **Play Store-publicering** — developer-konto
3. **HTTPS TTS** — domän + Let's Encrypt på VPS (valfritt)

## Teknisk skuld / kan göras utan användaren

- [x] Uppdatera dokumentation (denna fil, SNART-KLART, README)
- [ ] EAS env sync (`scripts/push-eas-env.ps1`) — kräver Expo-inloggning
- [ ] HTTPS på TTS-server — kräver VPS/root
- [ ] Röst → skicka mail (feature, kod finns delvis)
- [x] Admin-dashboard (`analytics-server/` — deploy till VPS)

## Byggkommandon

```powershell
cd C:\Users\user\My-assistent\MyAssistant\MyAssistantFinal

# Lokal release-APK (rekommenderat)
powershell -ExecutionPolicy Bypass -File .\build-175.ps1

# EAS cloud build (alternativ)
.\scripts\push-eas-env.ps1
npx eas-cli build --platform android --profile preview
```

## Nycklar och hemligheter

- Alla API-nycklar i `.env` (gitignored)
- `.env.example` visar vilka variabler som behövs
- GitHub push protection — inga nycklar i kod

## Säg till Cursor

- *"Läs PROJEKT-STATUS.md och fortsätt"*
- *"Fixa Google-inloggning"* — guidar SHA-1-steg med användaren
- *"Bygg"* — kör `build-175.ps1`
