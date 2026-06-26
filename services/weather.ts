import * as Location from 'expo-location';

import type { AppLocale } from '@/constants/i18n/types';

export type WeatherSnapshot = {
  temperature: number;
  description: string;
  emoji: string;
  city: string;
};

const LOCALE_COORDS: Record<AppLocale, { lat: number; lon: number; city: string }> = {
  en: { lat: 51.51, lon: -0.13, city: 'London' },
  sv: { lat: 59.33, lon: 18.07, city: 'Stockholm' },
  fi: { lat: 60.17, lon: 24.94, city: 'Helsinki' },
  da: { lat: 55.68, lon: 12.57, city: 'Copenhagen' },
  no: { lat: 59.91, lon: 10.75, city: 'Oslo' },
  de: { lat: 52.52, lon: 13.41, city: 'Berlin' },
  es: { lat: 40.42, lon: -3.7, city: 'Madrid' },
  fr: { lat: 48.86, lon: 2.35, city: 'Paris' },
  zh: { lat: 39.9, lon: 116.4, city: 'Beijing' },
  hi: { lat: 28.61, lon: 77.21, city: 'New Delhi' },
  ar: { lat: 24.71, lon: 46.67, city: 'Riyadh' },
  bn: { lat: 23.81, lon: 90.41, city: 'Dhaka' },
  pt: { lat: -23.55, lon: -46.63, city: 'São Paulo' },
  ru: { lat: 55.76, lon: 37.62, city: 'Moscow' },
  ur: { lat: 33.69, lon: 73.04, city: 'Islamabad' },
  id: { lat: -6.21, lon: 106.85, city: 'Jakarta' },
  ja: { lat: 35.68, lon: 139.65, city: 'Tokyo' },
  sw: { lat: -1.29, lon: 36.82, city: 'Nairobi' },
  mr: { lat: 19.08, lon: 72.88, city: 'Mumbai' },
  te: { lat: 17.39, lon: 78.49, city: 'Hyderabad' },
  tr: { lat: 41.01, lon: 28.98, city: 'Istanbul' },
  ta: { lat: 13.08, lon: 80.27, city: 'Chennai' },
  vi: { lat: 21.03, lon: 105.85, city: 'Hanoi' },
  ko: { lat: 37.57, lon: 126.98, city: 'Seoul' },
};

const WEATHER_SV: Record<string, string> = {
  Clear: 'Klart',
  Cloudy: 'Molnigt',
  Fog: 'Dimma',
  Rain: 'Regn',
  Snow: 'Snö',
  Showers: 'Skurar',
  Thunder: 'Åska',
};

let cachedCoords: { lat: number; lon: number; city: string; at: number } | null = null;
const COORD_CACHE_MS = 30 * 60 * 1000;

function weatherFromCode(code: number): { description: string; emoji: string } {
  if (code === 0) return { description: 'Clear', emoji: '☀️' };
  if (code <= 3) return { description: 'Cloudy', emoji: '⛅' };
  if (code <= 48) return { description: 'Fog', emoji: '🌫️' };
  if (code <= 67) return { description: 'Rain', emoji: '🌧️' };
  if (code <= 77) return { description: 'Snow', emoji: '❄️' };
  if (code <= 82) return { description: 'Showers', emoji: '🌦️' };
  if (code >= 95) return { description: 'Thunder', emoji: '⛈️' };
  return { description: 'Cloudy', emoji: '☁️' };
}

async function resolveCoords(
  locale: AppLocale,
): Promise<{ lat: number; lon: number; city: string }> {
  if (cachedCoords && Date.now() - cachedCoords.at < COORD_CACHE_MS) {
    return cachedCoords;
  }

  const fallback = LOCALE_COORDS[locale] ?? LOCALE_COORDS.en;

  try {
    let permission = await Location.getForegroundPermissionsAsync();
    if (permission.status === 'undetermined') {
      permission = await Location.requestForegroundPermissionsAsync();
    }
    if (permission.status === 'granted') {
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown) {
        const places = await Location.reverseGeocodeAsync({
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
        });
        const city = places[0]?.city ?? places[0]?.region ?? fallback.city;
        cachedCoords = {
          lat: lastKnown.coords.latitude,
          lon: lastKnown.coords.longitude,
          city,
          at: Date.now(),
        };
        return cachedCoords;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const places = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      const city = places[0]?.city ?? places[0]?.region ?? fallback.city;
      cachedCoords = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        city,
        at: Date.now(),
      };
      return cachedCoords;
    }
  } catch {
    // fallback below
  }

  cachedCoords = { ...fallback, at: Date.now() };
  return cachedCoords;
}

export async function fetchWeather(locale: AppLocale): Promise<WeatherSnapshot | null> {
  try {
    const { lat, lon, city } = await resolveCoords(locale);
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      '&current=temperature_2m,weather_code&timezone=auto';

    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    const temp = data?.current?.temperature_2m;
    const code = data?.current?.weather_code;
    if (typeof temp !== 'number' || typeof code !== 'number') return null;

    const { description, emoji } = weatherFromCode(code);
    const localizedDescription =
      locale === 'sv' ? (WEATHER_SV[description] ?? description) : description;

    return {
      temperature: Math.round(temp),
      description: localizedDescription,
      emoji,
      city,
    };
  } catch {
    return null;
  }
}
