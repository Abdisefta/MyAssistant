# Integritetspolicy för My Assistant

**Senast uppdaterad:** 18 juni 2026  
**App:** My Assistant  
**Utvecklare:** Abdi / Abdisefta  
**Paket:** com.abdisefta.myassistantfinal

Denna integritetspolicy beskriver hur My Assistant samlar in, använder och skyddar dina personuppgifter när du använder mobilappen.

## 1. Vem vi är

My Assistant utvecklas av Abdi / Abdisefta. Om du har frågor om denna policy eller dina uppgifter kan du kontakta oss på:

**E-post:** [DIN E-POST@EXEMPEL.SE]

## 2. Vilka uppgifter samlas in

### 2.1 Kontoinloggning (Firebase Authentication)

När du loggar in samlas följande in via Firebase Authentication:

- E-postadress (vid e-post/lösenord eller Google/Apple-inloggning)
- Visningsnamn (om du anger det eller får det från Google/Apple)
- Unikt användar-ID (Firebase uid)

Vi lagrar inte ditt lösenord i klartext; det hanteras av Firebase enligt deras säkerhetsstandarder.

### 2.2 Google Mail (Gmail API)

Om du kopplar Google Mail i appen begär vi behörighet att:

- Läsa dina e-postmeddelanden (read-only)
- Skicka e-post å dina vägnar

Appen använder dessa uppgifter för att visa mail, sammanfatta innehåll och skicka svar som du godkänner. Vi lagrar inte hela din inkorg på våra servrar; åtkomst sker via Googles API med ditt samtycke.

### 2.3 Kalender

Med ditt tillstånd kan appen läsa kalenderhändelser från enheten (t.ex. Google-, Apple- eller andra kalendrar som synkas lokalt). Detta används för att visa möten, ge påminnelser och ge kontext till assistenten.

### 2.4 Röst och konversationer

- Röstinmatning och transkription behandlas på enheten eller via operativsystemets taligenkänning.
- Konversationshistorik, preferenser och personligt minne sparas lokalt på din enhet (AsyncStorage), kopplat till ditt Firebase-användar-ID.
- Text du skickar till AI-assistenten skickas till Google Gemini API för att generera svar.

### 2.5 Teknisk information

Appen kan behandla grundläggande teknisk information som behövs för att appen ska fungera (t.ex. nätverksanslutning, enhetstyp). Vi säljer inte denna information till tredje part.

## 3. Hur uppgifterna används

Vi använder uppgifterna för att:

- Skapa och hantera ditt konto
- Tillhandahålla AI-assistenten, e-post-, kalender- och uppgiftsfunktioner
- Spara dina preferenser och konversationshistorik per användare
- Skicka lokala notiser om kommande möten (om du aktiverar det)
- Förbättra stabilitet och felsökning

## 4. Var uppgifterna lagras

| Typ av data | Lagring |
|-------------|---------|
| Inloggning (Firebase uid, e-post) | Google Firebase (molnet) |
| Minne, konversationer, preferenser | Lokalt på enheten (AsyncStorage) |
| Gmail-innehåll | Hämtas via Google; lagras inte permanent på våra servrar |
| Kalenderhändelser | Läses från enheten; lagras inte på våra servrar |
| AI-förfrågningar | Skickas till Google Gemini enligt Googles villkor |

## 5. Tredje parter

Vi använder följande tjänster:

- **Google Firebase** — autentisering och projektkonfiguration
- **Google Cloud / Gmail API** — e-post vid koppling av Google-konto
- **Google Gemini API** — AI-svar i assistenten
- **Google Sign-In** — inloggning och OAuth
- **Expo** — apputveckling, byggen och vissa utvecklingsverktyg
- **Apple Sign-In** (iOS) — valfri inloggning på iPhone

Dessa leverantörer har egna integritetspolicys. Vi rekommenderar att du läser dem på respektive webbplats.

## 6. Delning av uppgifter

Vi säljer inte dina personuppgifter. Uppgifter delas endast med tjänsteleverantörer som behövs för att appen ska fungera (enligt ovan), och när lagen kräver det.

## 7. Dina rättigheter

Beroende på var du bor kan du ha rätt att:

- Begära tillgång till uppgifter vi har om dig
- Begära rättelse eller radering
- Återkalla samtycke (t.ex. koppla bort Google Mail eller logga ut)
- Radera lokalt sparad data via appens inställningar (rensa konversationshistorik) eller genom att avinstallera appen
- Radera ditt Firebase-konto genom att kontakta oss

För att utöva dina rättigheter, kontakta oss på e-postadressen ovan.

## 8. Barn

My Assistant är inte avsedd för barn under 13 år. Vi samlar inte medvetet in uppgifter från barn.

## 9. Säkerhet

Vi använder branschstandarder via Firebase och HTTPS. Ingen metod är 100 % säker; vi arbetar kontinuerligt för att skydda dina uppgifter.

## 10. Ändringar

Vi kan uppdatera denna policy. Väsentliga ändringar meddelas i appen eller via uppdaterad text här. Fortsatt användning efter ändringar innebär att du accepterar den uppdaterade policyn.

## 11. Kontakt

**Abdi / Abdisefta**  
E-post: [DIN E-POST@EXEMPEL.SE]
