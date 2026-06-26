# My Assistant — status (v1.7.5)

Senast uppdaterad: 2025-06-25

## Klart och testat på telefon

- **Hem** — hälsning, klocka, väder, möten, uppgifter, profilbild (galleri + ikoner)
- **Assistent** — röst in/ut (Alma TTS), transkript, boka möten, påminnelser, snabbfraser
- **Kalender** — telefonkalender + lokala händelser
- **Uppgifter** — skapa, påminnelser
- **Notiser** — mötes- och uppgiftspåminnelser
- **Språk** — 24 språk + auto från telefon
- **Gästläge** — ingen inloggning krävs (`local-guest`)
- **"Jag är sjuk"** — bekräftelse innan avbokning
- **GitHub** — kod på `main`: https://github.com/Abdisefta/MyAssistant

## Bygg ny APK (Windows)

Senaste skript: `build-175.ps1`

```powershell
cd C:\Users\user\My-assistent\MyAssistant\MyAssistantFinal
powershell -ExecutionPolicy Bypass -File .\build-175.ps1
```

APK hamnar på skrivbordet: `MyAssistant175.apk`

Kräver `.env` med `EXPO_PUBLIC_*` (kopiera från `.env.example`). Committa aldrig `.env`.

## Kvar — behöver Abdi (5–15 min vardera)

| Uppgift | Varför jag inte kan göra det själv |
|---------|-------------------------------------|
| **Google-inloggning + Gmail** | SHA-1 från release-keystore måste läggas i Firebase Console |
| **Testa e-post på telefon** | Kräver att du loggar in med Google och trycker Tillåt |
| **Play Store** | Kräver Google Play Developer-konto och betalning |
| **HTTPS på TTS** | Kräver domän + certifikat på VPS (valfritt — HTTP funkar nu) |

### Google / Gmail — när du vill fixa

1. Bygg/installera senaste APK (`build-175.ps1`)
2. Firebase → Project settings → Android app → **Add fingerprint**
3. SHA-1 från din release-keystore (samma som APK-signeringen)
4. Vänta 5–10 min → öppna appen → **Email** → **Koppla Google Mail**

## Felsökning

| Problem | Lösning |
|---------|---------|
| Ingen Alma-röst | Inställningar → Testa Alma-röst. Höj **mediavolym**. Installera senaste APK. |
| Network request failed (TTS) | v1.7.5+ — cleartext fix. Bygg om med `build-175.ps1`. |
| Gemini svarar inte | Kontrollera `EXPO_PUBLIC_GEMINI_API_KEY` i `.env` (måste vara `AIzaSy...`). |
| Kalender tom | Tillåt kalender i appen + telefonens inställningar |
| Google DEVELOPER_ERROR | Lägg till SHA-1 i Firebase (se ovan) |
| Gradle byggfel | Kör `scripts/prefetch-android-minimal.ps1`, aktivera långa sökvägar i Windows |

## Föråldrade filer

- `IMORGON-GEMINI-FIX.md` — historik från juni, Gemini är fixat
- `NAR-DU-VAKNAR.md` — gammal USB/Expo Go-guide
