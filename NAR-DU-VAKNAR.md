> **FÖRÅLDRAD** — gäller v1.2.1 via Expo Go. Nu: installera APK från `build-175.ps1`. Se `SNART-KLART.md`.

# När du vaknar — 3 steg (Google-inloggning fixad)

Jag har fixat Google-inloggning för din **v1.2.1 USB-app**. Du behöver **inte** göra något i Firebase.

## Steg 1 — starta servern (PowerShell)

```powershell
cd C:\Users\user\My-assistent\MyAssistant\MyAssistantFinal
npx expo start
```

Låt fönstret vara öppet.

## Steg 2 — ladda om appen på telefonen

1. Öppna **My Assistant** (v1.2.1)
2. Skaka telefonen → **Reload** (eller stäng appen och öppna igen)

## Steg 3 — logga in med Google

1. Tryck **Fortsätt med Google**
2. Välj **abdisefta85@gmail.com**
3. Tryck **Tillåt**

---

## Testa sedan

- **Kalender** → **Boka möte**
- **Assistent** → *"Boka möte imorgon kl 15"*
- **Email** → Koppla Google Mail

---

## Om Google fortfarande strular

Lägg till denna SHA-1 i Firebase → Android-app → Add fingerprint:

```
5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
```

(Den behövs bara för framtida release-builds, inte för USB-test.)
