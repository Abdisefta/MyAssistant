# Handoff för ny Cursor-agent — läs detta först

**Datum:** 2025-06-18  
**Användare:** Abdi (abdisefta85@gmail.com)  
**Projekt:** My Assistant — Expo React Native app

---

## Sökväg och länkar

| Vad | Var |
|-----|-----|
| App-kod | `C:\Users\user\My-assistent\MyAssistant\MyAssistantFinal` |
| GitHub | https://github.com/Abdisefta/MyAssistant (branch `main`) |
| Expo/EAS | https://expo.dev/accounts/abdisefta/projects/MyAssistantFinal |
| Firebase | Projekt `my-assistant-7f68b` |
| Paketnamn Android | `com.abdisefta.myassistantfinal` |
| App-version i kod | **1.0.8** (senaste commit: Gemini key fix) |

---

## Vad fungerar på telefonen

- Appen **startar** (krasch fixad i v1.0.7 — tog bort `@google/genai`)
- **Mörk UI**, 5 flikar, kalender läser möten
- **Mikrofon + transkription** (röst in funkar — text syns i TRANSKRIPT)
- **Ingen inloggningsskärm** — `useAppAuth({ enabled: false })` + `guestMode` default

---

## Aktiva problem (prioritet)

### 1. Gemini — "Ogiltig API-nyckel"

- Användaren får fel i appen när assistenten ska svara
- **Orsak:** EAS `preview` har `EXPO_PUBLIC_GEMINI_API_KEY` som kan vara **gammal/fel** och överstyr inbakad nyckel vid build
- **Inbakad nyckel** i `constants/gemini.ts` → `EXPO_PUBLIC_GEMINI_API_KEY` i `.env` (committas aldrig)
- **Fix i kod (v1.0.8):** `getGeminiApiKeyCandidates()` provar inbakad nyckel **först**, sedan EAS-env
- **Om fortfarande fel:** Skapa **ny nyckel** i https://aistudio.google.com/apikey → uppdatera `BAKED_GEMINI_KEY` → bygg om
- **Alternativ:** Radera fel nyckel i EAS: `npx eas-cli env:delete --variable-name EXPO_PUBLIC_GEMINI_API_KEY --environment preview`

### 2. Gmail — DEVELOPER_ERROR (SHA-1)

- Email-fliken: "Google-inställning fel (DEVELOPER_ERROR). Kontrollera SHA-1"
- **Orsak:** Användaren **raderade** Expo Android credentials; ny keystore behöver SHA-1 i Firebase
- **Användaren svarade Y** på "Generate a new Android Keystore?" under senaste `eas build`
- **Efter build klart:**
  1. Expo → Credentials → `com.abdisefta.myassistantfinal` → kopiera **SHA-1**
  2. Firebase → Project settings → Android app → **Add fingerprint** (SHA-1)
  3. Vänta 5–10 min → testa "Koppla Google Mail" igen (ingen ny build behövs för SHA-1)

---

## Senaste EAS-build

- Användaren körde `npx eas-cli build --platform android --profile preview`
- Svarade **Y** på ny keystore
- **Vänta på Build finished** → installera APK på telefon
- Bygget inkluderar v1.0.8 om det startades efter senaste kodändringar — **verifiera** att commit `64baad7` (v1.0.8) är i build

---

## Firebase (redan konfigurerat)

- Web + Android app registrerade
- Auth: Email, Google, Apple enabled
- **Web client ID:** `194397490077-ufj8ubshkv7qjqubmmaptob7p6s680m1.apps.googleusercontent.com`
- Inbakad i `constants/firebase.ts` och `google-signin-config.ts`
- `.env` på datorn har alla värden (committa aldrig `.env`)

---

## EAS environment (preview)

Laddas vid build (kan vara ofullständigt):

- `EXPO_PUBLIC_GEMINI_API_KEY` — finns men kan vara **fel**
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` — finns
- **Saknas i EAS** (men inbakade i kod): övriga Firebase-variabler

Script för att pusha `.env` till EAS: `.\scripts\push-eas-env.ps1`

---

## Viktiga kodändringar (senaste session)

| Version | Vad |
|---------|-----|
| 1.0.7 | Tog bort `@google/genai` (krasch), `useAppAuth({ enabled: false })` |
| 1.0.8 | Gemini: inbakad nyckel först, Bearer header för AQ-nycklar |
| — | Firebase + Google client ID inbakade i kod |
| — | Guest mode — ingen auth-gate |

**INTE använda `@google/genai`** — kraschar React Native.

---

## Nästa steg för användaren (i ordning)

1. **Vänta** tills EAS build = **Build finished**
2. Skriv **`n`** om emulator-fråga
3. **Installera** APK på telefon (QR-kod)
4. **Testa assistenten** — säg "kan du påminna mig om att handla maten"
5. Om Gemini fortfarande fel → ny API-nyckel i AI Studio + uppdatera kod + rebuild
6. **SHA-1:** Expo Credentials → kopiera → Firebase Android app → Add fingerprint
7. Testa **Koppla Google Mail** i Email-fliken
8. Om allt funkar → `npx eas-cli env:delete` fel Gemini-nyckel ELLER uppdatera med rätt nyckel

---

## Planerat (inte gjort än)

- **Röst → skicka mail** — kommando: "bygg skicka mail via röst" (se `PROJEKT-STATUS.md`)
- Play Store publicering (`store/` finns)
- Admin-dashboard (senare)
- Firebase-inloggning i appen (kod finns, avstängd för MVP)

---

## Hur användaren vill bli guidad

- **Svenska**
- **2 steg i taget** — inte allt på en gång
- Exakt **knapptext** (t.ex. "Continue to console", "Next", "Y")
- PowerShell: `cd C:\Users\user\My-assistent\MyAssistant\MyAssistantFinal`

---

## Kommandon som ofta används

```powershell
cd C:\Users\user\My-assistent\MyAssistant\MyAssistantFinal
npx eas-cli build --platform android --profile preview
.\scripts\push-eas-env.ps1
```

---

## Säg till ny agent

> "Läs HANDOFF-AGENT.md och PROJEKT-STATUS.md i MyAssistantFinal. Fortsätt fixa Gemini API-nyckel och SHA-1 för Gmail. Användaren väntar på EAS-build eller har just installerat ny APK."
