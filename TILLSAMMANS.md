# My Assistant — gör tillsammans (efter autonom körning)

Allt som kunde göras utan dig är klart. **Bara det här återstår.**

---

## 1. Testa på telefon (15 min)

1. Kopiera **`MyAssistant194.apk`** från Desktop till telefonen
2. Installera (tillåt okända källor om Android frågar)
3. Kontrollera:
   - Ny **ikon** (lila mikrofon, mörk bakgrund)
   - **Assistent** — prata, få svar
   - **Alma-röst** — Inställningar → Testa Alma
   - **Email** — Koppla Gmail, skicka testmail
   - **Kalender / uppgifter**

---

## 2. Firebase — Google-inloggning (10 min)

1. Gå till [Firebase Console](https://console.firebase.google.com) → projekt **my-assistant-7f68b**
2. Project settings → Android-app → **Add fingerprint**
3. Klistra in SHA-1 (se `KEYSTORE-LOCAL.txt` i projektet — senaste keystore)
4. Vänta 5–10 min → testa **Koppla Google Mail** i appen

---

## 3. Integritetspolicy (5 min)

1. Öppna `store/privacy-policy.md`
2. Ersätt **`[DIN E-POST@EXEMPEL.SE]`** med din riktiga support-e-post (2 ställen)
3. Publicera policyn (GitHub Pages / egen sida) och spara **URL** till Play Console

---

## 4. Play Console — publicering (30–60 min)

Filer på Desktop:
- **`MyAssistant194.aab`** — ladda upp till Play Console (Production eller Internal testing)
- **`MyAssistant194.apk`** — bara för manuell test på telefon

Checklista:
- [ ] Skapa app — paket `com.abdisefta.myassistantfinal`
- [ ] Store listing — texter finns i `store/app-description-*.txt`
- [ ] Skärmdumpar (minst 2, gärna 4–8)
- [ ] Feature graphic 1024×500
- [ ] Integritetspolicy-URL
- [ ] Data safety — se `store/data-safety-notes.md`
- [ ] Content rating (IARC)
- [ ] Ladda upp **AAB**
- [ ] Release-signering / Play App Signing

---

## 5. Play Billing — 199 kr/mån (efter app skapad)

1. Play Console → Monetization → **Subscriptions** → skapa produkt (199 kr/mån)
2. Kopiera **product ID** → säg till Cursor så kopplas det i appen
3. Testa med **license testers** innan produktion

---

## 6. GitHub-backup (valfritt)

Säg **`spara till github`** i Cursor så committas och pushas all kod.

---

## 7. Valfritt senare

- **HTTPS Alma TTS** (behövs för iOS) — domän + certifikat på VPS
- **Apple / App Store** — Apple Developer-konto

---

## Dashboard (admin)

- URL: http://195.201.128.118:3002
- Lösenord: `MyAssistant-Admin-2026` (om ej ändrat på servern)
- Här markerar du **Gratis abonnemang** — 35 kr API-gräns gäller fortfarande för alla
