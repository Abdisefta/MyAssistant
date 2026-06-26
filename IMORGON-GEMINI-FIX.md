# Imorgon — fixa Gemini (läs detta först)

**Datum paus:** 2025-06-18 kväll  
**Problem hela dagen:** "Ogiltig Gemini API-nyckel" trots 3+ nycklar och flera builds.

---

## Behöver vi bygga om appen från scratch? **NEJ**

| Del | Status |
|-----|--------|
| App, UI, mikrofon, röst, mail-kod, kalender | ✅ Klart (v1.1.2) |
| Gemini-nyckel | ❌ Enda blockeraren |
| Gmail SHA-1 | ⏸️ Efter Gemini funkar |

**Bygg inte om projektet från noll.** En fungerande `AIzaSy`-nyckel + **en** EAS build räcker.

---

## Vad som gick snett (rotorsak)

1. **Alla nycklar var AQ-typ** från Google AI Studio — dessa ger 401 i React Native-appen mot `generativelanguage.googleapis.com`.
2. **Samma misstag upprepades** — ny AQ-nyckel → ny build → samma fel.
3. **EAS preview** kan ha gammal `EXPO_PUBLIC_GEMINI_API_KEY` (AQ) inbakad vid build.
4. **Google Cloud Console** — användaren aktiverade Gemini API i `myassistant-499522` men skapade aldrig en `AIzaSy`-nyckel med "Don't restrict key".
5. **Inte mikrofon, inte röst, inte appen** — bara nyckeltypen.

---

## Morgonplan (30 min totalt)

### Steg 1 — Skapa RÄTT nyckel (5 min)

1. https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com?project=myassistant-499522  
   → ska stå **Enabled**
2. https://console.cloud.google.com/apis/credentials?project=myassistant-499522  
   → **+ Create credentials** → **API key**
3. **Don't restrict key** → **Create**
4. Kopiera — måste börja med **`AIzaSy`**

**INTE** aistudio.google.com (ger AQ).

### Steg 2 — Testa nyckel INNAN build (10 sek)

```powershell
cd C:\Users\user\My-assistent\MyAssistant\MyAssistantFinal
.\scripts\test-gemini-key.ps1 -Key "AIzaSy..."
```

Måste visa: `OK — Gemini svarade:`

### Steg 3 — Uppdatera kod

I `constants/gemini.ts`:

```typescript
export const BAKED_GEMINI_KEY = 'AIzaSy...';
```

Radera gammal EAS-nyckel (valfritt men rekommenderat):

```powershell
npx eas-cli env:delete --variable-name EXPO_PUBLIC_GEMINI_API_KEY --environment preview
```

### Steg 4 — En build

```powershell
npx eas-cli build --platform android --profile preview
```

Keystore → **n**, emulator → **n**

### Steg 5 — Test + SHA-1

1. Installera APK
2. Säg: "Kan du påminna mig om att handla?"
3. Om OK → SHA-1 från Expo Credentials → Firebase Android app → testa Gmail

---

## Kodändringar gjorda kvällen 2025-06-18

- AQ-nycklar **ignoreras** helt i `constants/gemini.ts`
- Tydligare felmeddelanden
- `scripts/test-gemini-key.ps1` — testa nyckel utan build
- `BAKED_GEMINI_KEY` tom tills AIzaSy sätts imorgon

---

## Om det FORTFARANDE strular efter AIzaSy

Kolla i ordning:

1. Körde du `test-gemini-key.ps1` OK? Om nej — nyckel/projektfel, inte appfel.
2. Byggdes APK **efter** nyckeln lades i `BAKED_GEMINI_KEY`?
3. Raderades gammal EAS `EXPO_PUBLIC_GEMINI_API_KEY`?
4. Gemini API enabled på **samma projekt** som nyckeln (`myassistant-499522`)?
5. Billing/API quota — gratis tier räcker för test.

Sista utväg (sällan behövs): nytt GCP-projekt, enable API, ny AIzaSy-nyckel.
