# Handoff för Cursor-agent

**Senast uppdaterad:** 2025-06-25 · **Version:** 1.7.5

## Snabbstart

| | |
|--|--|
| Kod | `C:\Users\user\My-assistent\MyAssistant\MyAssistantFinal` |
| GitHub | https://github.com/Abdisefta/MyAssistant (`main`) |
| Användare | Abdi — abdisefta85@gmail.com, föredrar enkla steg på svenska |
| Expo SDK | 54 — läs https://docs.expo.dev/versions/v54.0.0/ |
| Bygg APK | `build-175.ps1` → `MyAssistant175.apk` på Desktop |

## Vad fungerar

- Gästläge (`local-guest`), alla flikar utom full Gmail-koppling
- Alma TTS via `http://195.201.128.118:3001` (cleartext fix i v1.7.5)
- Gemini via `EXPO_PUBLIC_GEMINI_API_KEY` i `.env` (AIzaSy, inte AQ)
- Profilbild, sjuk-dag, i18n, notiser, kalender

## Aktiva blockerare (kräver användaren)

### Gmail — DEVELOPER_ERROR

- Release-APK SHA-1 saknas i Firebase
- Användaren måste: Firebase → Android app → Add fingerprint
- Ingen ny build behövs efter SHA-1 — bara vänta 5–10 min

### Play Store / HTTPS TTS

- Medvetet pausat tills användaren vill

## Viktiga filer

| Område | Filer |
|--------|-------|
| Assistent-UI | `components/assistant-screen.tsx` |
| Alma TTS | `services/alma-tts.ts`, `constants/alma-tts.ts` |
| Hem / profil | `components/home-tab.tsx`, `services/profile-photo.ts` |
| Version | `constants/app-version.ts`, `app.json` |
| Bygg | `build-175.ps1`, `scripts/prefetch-android-minimal.ps1` |
| Nätverk Android | `plugins/with-android-cleartext.js` |

## Byggflöde (Windows)

1. `robocopy` → `C:\b`
2. `npm ci` + prefetch-skript (Maven SSL-problem på build-PC)
3. `newArchEnabled=true` i gradle.properties
4. Gradle retry-loop med `local-maven`
5. Kopiera APK till Desktop

## Regler

- Committa aldrig `.env` eller API-nycklar
- Committa bara när användaren ber om det
- Minimera diff — matcha befintlig kodstil

## Säg till agenten

> "Läs HANDOFF-AGENT.md och SNART-KLART.md. Fortsätt med [uppgift]."
