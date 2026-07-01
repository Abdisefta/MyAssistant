const fs = require('fs');
const path = require('path');

/** @param {string} filePath */
function loadEnvFile(filePath) {
  /** @type {Record<string, string>} */
  const env = {};
  if (!fs.existsSync(filePath)) return env;

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
  }

  return env;
}

const env = loadEnvFile(path.join(__dirname, '.env'));
const appJson = require('./app.json');

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  ...appJson.expo,
  extra: {
    ...appJson.expo.extra,
    firebase: {
      apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
      androidApiKey: env.EXPO_PUBLIC_FIREBASE_ANDROID_API_KEY ?? '',
      authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
      projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
      storageBucket: env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
      messagingSenderId: env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
      appId: env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
    },
  },
};
