# My Assistant — projektstatus (uppdaterad 2025-06-18)

Sammanfattning av vad som gjorts och vad som återstår. Läs denna fil när du fortsätter.

## Projekt
- **App:** My Assistant (Expo React Native)
- **Sökväg:** `C:\Users\user\My-assistent\MyAssistant\MyAssistantFinal`
- **Paket:** `com.abdisefta.myassistantfinal`
- **Expo/EAS:** inloggad som `abdisefta`, projectId `22e289d9-e041-4b20-a6c8-ec007b28d559`
- **Version på telefon (senaste lyckade bygge):** 1.0.2 — build `5bafa766-2309-4eef-9696-d3fa0c099ac2`

## Vad fungerar ✅
- Mörk UI, lila orb, 5 flikar (Email, Kalender, Assistent, Uppgifter, Inställningar)
- **Kalender** — läser möten från telefonen (fix: `device-calendar.ts`, inte `NativeModules`)
- **Email** — Gmail (logga in med Google i Email-fliken; 14495 olästa syns)
- **EAS build** — `npx eas-cli build --platform android --profile preview`
- **Personligt minne** — sparas per Firebase `uid` (namn, jobb, preferenser)
- **Röst in (kod)** — `expo-speech-recognition`, håll inne mikrofon
- **Röst ut (kod)** — `expo-speech` när Gemini svarar
- **Mötesnotiser (kod)** — 15 min innan möte, Inställningar → på/av
- Microsoft-inloggning borttagen från UI (inte behövs nu)

## Vad INTE fungerar än ❌
- **Assistenten svarar/pratar inte** — fel: "Gemini API-nyckel saknas"
  - `.env` på datorn har nyckel, men **EAS molnet bygger utan den**
  - Användaren råkade sätta `DIN_NYCKEL_HÄR` som env i Expo — måste fixas med **riktig** nyckel
- **Firebase inloggning** — `.env` saknar Firebase-nycklar (bara Gemini finns lokalt)
- **Play Store / App Store** — inte publicerat än (production build + privacy policy)

## Imorgon — fixa assistenten (3 steg)
PowerShell, först `cd` till projektet:
```powershell
cd C:\Users\user\My-assistent\MyAssistant\MyAssistantFinal
```

1. Kopiera nyckel från `.env` (rad `EXPO_PUBLIC_GEMINI_API_KEY=...`)
   - Om ogiltig: skapa ny på https://aistudio.google.com/apikey

2. Lägg nyckel i Expo (byt ut med riktig nyckel):
```powershell
npx eas-cli env:delete --name EXPO_PUBLIC_GEMINI_API_KEY --environment preview
npx eas-cli env:create --name EXPO_PUBLIC_GEMINI_API_KEY --value "RIKTIG_NYCKEL_HÄR" --environment preview --visibility plaintext
```

3. Bygg och installera:
```powershell
npx eas-cli build --platform android --profile preview
```
→ Build finished → QR/länk → installera APK på telefon → testa "Vet du vad jag heter?"

## Viktiga kommandon
| Vad | Kommando |
|-----|----------|
| Bygga APK | `npx eas-cli build --platform android --profile preview` |
| Emulator-fråga | Skriv `n` |
| EAS inloggning | `npx eas-cli login` (redan abdisefta) |

## Nycklar & config
- **Gemini:** `EXPO_PUBLIC_GEMINI_API_KEY` i `.env` + måste finnas i EAS `preview` environment
- **Firebase (saknas i .env):** `EXPO_PUBLIC_FIREBASE_API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`, `APP_ID`
- **Google (Gmail):** Web Client ID i projektet, SHA-1: `7A:02:F4:E4:7D:E3:16:99:C6:AD:53:A6:2F:6A:8E:3D:0F:C6:39:C5`

## Kvar efter assistenten funkar
1. Firebase Web-app + Android-app i Console → fyll `.env` → ny build → testa inloggning (e-post, Google, Apple)
2. `eas build --profile production` → Play Store
3. Privacy policy (krävs för butiker)
4. iOS / App Store + Apple-inloggning i Firebase
5. Förbättringar: uppgifter sparas per användare, riktig körtid i briefing, Outlook-mail

## Cursor / tema
- Mörkt tema: `Default High Contrast` i settings.json
- Breadcrumbs avstängda

## Säg till Cursor imorgon
> "Läs PROJEKT-STATUS.md och hjälp mig fixa Gemini-nyckeln"
