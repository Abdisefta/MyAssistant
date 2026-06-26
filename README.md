# My Assistant

Personlig assistent-app för Android — kalender, uppgifter, röst (Alma TTS) och Gemini AI.

**Version:** 1.7.5 · **Paket:** `com.abdisefta.myassistantfinal`

## Funktioner

- Hem med väder, möten och profilbild
- Assistent med röst in/ut, boka möten, påminnelser
- Kalender (telefon + lokala händelser)
- Uppgifter med notiser
- 24 språk, gästläge utan inloggning

## Kom igång (utveckling)

```bash
npm install
cp .env.example .env   # fyll i EXPO_PUBLIC_*
npx expo start
```

## Bygg release-APK (Windows)

```powershell
powershell -ExecutionPolicy Bypass -File .\build-175.ps1
```

APK: `C:\Users\user\Desktop\MyAssistant175.apk`

## Alma TTS-server

Se `tts-server/README.md` — Docker-baserad Piper TTS.

## Dokumentation

| Fil | Innehåll |
|-----|----------|
| `SNART-KLART.md` | Status + vad som återstår |
| `PROJEKT-STATUS.md` | Teknisk översikt för utvecklare |
| `HANDOFF-AGENT.md` | Handoff till Cursor-agent |
| `.env.example` | Alla miljövariabler |

## Länkar

- GitHub: https://github.com/Abdisefta/MyAssistant
- Expo: https://expo.dev/accounts/abdisefta/projects/MyAssistantFinal
