# Play Console — Data safety (anteckningar)

App: **My Assistant**  
Paket: `com.abdisefta.myassistantfinal`  
Utvecklare: Abdi / Abdisefta

Använd denna fil som stöd när du fyller i **Data safety** i Google Play Console.

## Sammanfattning

| Fråga | Rekommenderat svar |
|-------|-------------------|
| Samlar appen in data? | Ja |
| Delas data med tredje part? | Ja (Google Firebase, Google APIs, Gemini) |
| Krypteras data under transport? | Ja (HTTPS) |
| Kan användaren begära radering? | Ja (kontakta utvecklare; lokal data via app/avinstallera) |

## Datatyper att deklarera

### Personlig information

| Datatyp | Samlas in | Delas | Syfte | Obligatorisk |
|---------|-----------|-------|-------|--------------|
| **E-postadress** | Ja | Ja (Firebase, Google) | Konto, Gmail, autentisering | Ja (för inloggning) |
| **Namn** | Ja | Ja (Firebase, Google) | Kontoprofil, assistent | Nej (valfritt) |
| **Användar-ID** | Ja | Ja (Firebase) | Konto, per-användare lagring | Ja |

### Appaktivitet

| Datatyp | Samlas in | Delas | Syfte |
|---------|-----------|-------|-------|
| **Appinteraktioner** | Ja (lokalt) | Nej* | Konversationshistorik, preferenser |
| **Övrigt användarinnehåll** | Ja | Ja (Gemini) | AI-frågor/svar skickas till Gemini API |

\* Lokalt på enheten; delas inte med annonsörer.

### Meddelanden

| Datatyp | Samlas in | Delas | Syfte |
|---------|-----------|-------|-------|
| **E-post** | Ja (via Gmail API) | Ja (Google) | Visa/skicka mail |

### Kalender

| Datatyp | Samlas in | Delas | Syfte |
|---------|-----------|-------|-------|
| **Kalenderhändelser** | Ja (enheten) | Nej* | Möten, påminnelser |

\* Läses via expo-calendar; lagras inte på egna servrar.

### Ljud

| Datatyp | Samlas in | Delas | Syfte |
|---------|-----------|-------|-------|
| **Röstinspelning / tal** | Ja (tillfälligt) | Nej* | Röstinmatning till assistent |

\* Behandlas via enhetens taligenkänning; skickas inte till egen backend.

## Tredjepartstjänster (deklarera i formuläret)

1. **Google Firebase Authentication** — inloggning, uid, e-post
2. **Google Sign-In / Gmail API** — OAuth, mailåtkomst
3. **Google Gemini API** — AI-genererade svar
4. **Expo** — apputveckling (ingen direkt insamling av slutanvändardata utöver standard SDK)

## Säkerhetspraxis

- Data krypteras under transport (TLS/HTTPS).
- Lösenord hanteras av Firebase Auth (hashed).
- Lokal data (AsyncStorage) ligger på användarens enhet.
- Ingen försäljning av personuppgifter.
- Ingen reklam-/spårnings-SDK i appen enligt nuvarande kodbas.

## Behörigheter (Android)

| Behörighet | Varför |
|------------|--------|
| INTERNET | Firebase, Gemini, Gmail |
| Mikrofon | Röstassistent |
| Kalender (READ) | Visa möten |
| Notiser | Mötespåminnelser |

## Integritetspolicy-URL

Ladda upp `store/privacy-policy.md` som webbsida (GitHub Pages, Firebase Hosting, etc.) och ange URL i Play Console.

Ersätt platshållaren `[DIN E-POST@EXEMPEL.SE]` innan publicering.

## Data safety — vanliga val

- **Data collection:** Optional for some fields (name); required for account (email/uid).
- **Data usage:** App functionality, Account management.
- **Data sharing:** Service providers only (not sold).
- **Encryption in transit:** Yes.
- **Deletion request:** Email developer; user can clear history in app and uninstall.
