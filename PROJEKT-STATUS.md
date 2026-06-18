# My Assistant — projektstatus (uppdaterad 2025-06-19)

Sammanfattning av vad som gjorts och vad som återstår. Läs denna fil när du fortsätter.

## Projekt
- **App:** My Assistant (Expo React Native)
- **Sökväg:** `C:\Users\user\My-assistent\MyAssistant\MyAssistantFinal`
- **Paket:** `com.abdisefta.myassistantfinal`
- **Expo/EAS:** inloggad som `abdisefta`, projectId `22e289d9-e041-4b20-a6c8-ec007b28d559`
- **GitHub:** https://github.com/Abdisefta/MyAssistant

## Vad fungerar ✅
- Mörk UI, lila orb, 5 flikar (Email, Kalender, Assistent, Uppgifter, Inställningar)
- **Kalender** — läser möten från telefonen
- **Email** — Gmail läsa + skicka (Email-fliken; `gmail.send` finns)
- **EAS build** — preview APK
- **Personligt minne** — per Firebase `uid`
- **Röst in/ut + mötesnotiser** — kod finns (kräver APK med Gemini-nyckel)

## Gemini (pågående)
- Nyckelformat: `AQ....` (inte `AIzaSy`) — från Google AI Studio
- Modell i app: `gemini-flash-latest`, header `X-goog-api-key`
- EAS: `EXPO_PUBLIC_GEMINI_API_KEY` i `preview` environment (overwrite med rätt nyckel)
- Efter build: testa "Vet du vad jag heter?" + mikrofon

## NÄSTA FEATURE — sparad av användaren (bygg exakt så)

**Kommando:** *"bygg skicka mail via röst"* eller *"läs PROJEKT-STATUS.md och bygg mail via assistenten"*

**Exempel:** Användaren säger: *"Skicka ett mail till Magnus att vi ska träffas och ha möte på onsdag."*

**Flöde (obligatoriskt — alltid bekräftelse innan skick):**
1. Assistenten **förstår** person (Magnus), innehåll (möte), tid (onsdag)
2. **Hittar e-post** för personen (från tidigare Gmail / kontakter)
3. **Gemini skriver** professionellt mail på svenska
4. **Visar förhandsgranskning** + frågar: *"Ska jag skicka till magnus@...?"*
5. Användaren säger **ja** (röst eller knapp) → **skicka via Gmail API**
6. Assistenten bekräftar: *"Mailet är skickat."*

**Tekniskt (redan delvis i appen):**
- `sendGmailMessage` i `email-tab.tsx` — flytta till `services/gmail-send.ts`
- `gmail.send` scope finns i `google-auth.ts`
- Koppla `useAssistant` + Google `accessToken` från `index.tsx`
- **ALDRIG** skicka utan bekräftelse (användaren valde detta)

**Bonus senare:** skapa kalenderhändelse samma dag (onsdag) när mailet skickas.

## PLAN — Egen admin-dashboard (bygg sen)

**Kommando:** *"bygg admin-dashboard"* eller *"läs PROJEKT-STATUS.md och bygg dashboard"*

**Mål:** En **snygg, smidig och enkel** webbsida på datorn — **allt viktigt på ett ställe** (inte hoppa mellan Firebase, Play, Expo, AI Studio).

**Design:** Samma mörk + lila stil som appen. Stor överblick, få klick, svenska.

**Vad dashboarden ska visa (endast du som ägare):**
| Ruta | Innehåll |
|------|----------|
| **Användare** | Hur många registrerade, nya idag/veckan (Firebase Auth) |
| **Appen** | Aktiva användare, kraschar (Firebase Analytics + Play) |
| **Intäkter** | Prenumerationer, månadens summa (Play / RevenueCat) |
| **AI** | Gemini-anrop / ungefärlig kostnad (AI Studio eller egen logg) |
| **Byggen** | Senaste APK, status (Expo EAS) |
| **Snabbstatus** | Grön/gul/röd: API, Firebase, app live |

**Vad den INTE ska visa (integritet):**
- Användares mail, chattar, kalenderinnehåll
- Bara **statistik och affär** — inte privata data

**Teknik (förslag när vi bygger):**
- Webb: Next.js eller enkel React-sida (mörkt tema)
- Data: Firebase Admin + Play API + Expo API (read-only)
- Inloggning: bara **din** Google-konto / lösenord
- Hosting: Firebase Hosting eller Vercel

**Bygg efter:** Firebase inloggning + Play Store publicerad (så data finns att visa).

## Kvar efter assistenten funkar
1. **Röst → skicka mail** (se NÄSTA FEATURE ovan)
2. Firebase inloggning → `.env` + ny build
3. Production build → Play Store + privacy policy
4. App Store + Apple
5. **Egen admin-dashboard** (ovan)
6. Uppgifter per användare, riktig körtid i briefing, Outlook

## Säg till Cursor
- Gemini: *"Läs PROJEKT-STATUS.md och hjälp mig med Gemini"*
- Mail via röst: *"bygg skicka mail via röst"*
- Dashboard: *"bygg admin-dashboard"*
