# My Assistant — nästan klart

## Klart i koden (v1.2.3)

- Hem: hälsning, klocka, väder, möten, uppgifter
- Assistent: röst, minne, kalenderfrågor, påminnelser, boka möten
- Kalender: telefonkalender + lokala händelser, i18n
- Notiser: expo-notifications (native), mötes- och uppgiftspåminnelser
- Språk: 24 språk + auto från telefon
- Gästläge: ingen inloggning krävs (`local-guest`)

## Det som återstår (gör vi tillsammans)

### Steg 1 — Windows långa sökvägar (2 min, admin)

PowerShell **som administratör**:

```powershell
reg add "HKLM\SYSTEM\CurrentControlSet\Control\FileSystem" /v LongPathsEnabled /t REG_DWORD /d 1 /f
```

Starta om datorn.

### Steg 2 — Bygg APK (jag kör eller du dubbelklickar)

Dubbelklicka:

`MyAssistantFinal\build-apk.bat`

Eller säg **"bygg"** — jag kör det.

APK hamnar här:

`MyAssistantFinal\android\app\build\outputs\apk\debug\app-debug.apk`

### Steg 3 — Installera på Realme (~5 min)

1. Kopiera APK till telefonen
2. Inställningar → Säkerhet → Installera okända appar → tillåt
3. Öppna APK → Installera
4. Tillåt **Kalender** och **Notiser** i appen

### Steg 4 — Testa utan inloggning

- **Hem** — namn, väder, möten
- **Kalender** → Tillåt kalender
- **Assistent** — prata, påminnelse, boka möte
- **Notiser** — ska fråga vid start

### Senare (medvetet sist)

- **Gmail / Google-inloggning** — SHA-1 finns redan i Firebase

## Felsökning

| Problem | Lösning |
|---------|---------|
| Filename longer than 260 | Steg 1 (långa sökvägar) |
| Åtkomst nekad i PowerShell | Kör som administratör |
| Kalender tom | Tillåt kalender i appen + telefonens inställningar |
| Notiser funkar inte | Ny APK + tillåt notiser |
