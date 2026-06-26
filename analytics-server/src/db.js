import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR ?? join(__dirname, '..', 'data');
mkdirSync(dataDir, { recursive: true });

const dbPath = join(dataDir, 'analytics.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    type TEXT NOT NULL,
    device_id TEXT NOT NULL,
    app_version TEXT,
    platform TEXT,
    meta TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
  CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
  CREATE INDEX IF NOT EXISTS idx_events_device ON events(device_id);

  CREATE TABLE IF NOT EXISTS devices (
    device_id TEXT PRIMARY KEY,
    first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    app_version TEXT,
    platform TEXT,
    opens INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    label TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    recurring TEXT NOT NULL DEFAULT 'once',
    note TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

const DEFAULT_LIMITS = {
  limit_chats_day: Number(process.env.LIMIT_CHATS_DAY ?? 30),
  limit_gemini_day: Number(process.env.LIMIT_GEMINI_DAY ?? 30),
  limit_tts_day: Number(process.env.LIMIT_TTS_DAY ?? 40),
};

const LIMIT_KEY_FOR_TYPE = {
  assistant_message: 'limit_chats_day',
  gemini_request: 'limit_gemini_day',
  tts_request: 'limit_tts_day',
};

function startOfUtcDayMs() {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function getSetting(key, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!row) return fallback;
  const n = Number(row.value);
  return Number.isFinite(n) ? n : fallback;
}

export function getUsageLimits() {
  return {
    chatsPerDay: getSetting('limit_chats_day', DEFAULT_LIMITS.limit_chats_day),
    geminiPerDay: getSetting('limit_gemini_day', DEFAULT_LIMITS.limit_gemini_day),
    ttsPerDay: getSetting('limit_tts_day', DEFAULT_LIMITS.limit_tts_day),
  };
}

export function setUsageLimits({ chatsPerDay, geminiPerDay, ttsPerDay }) {
  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  );
  if (chatsPerDay != null) upsert.run('limit_chats_day', String(chatsPerDay));
  if (geminiPerDay != null) upsert.run('limit_gemini_day', String(geminiPerDay));
  if (ttsPerDay != null) upsert.run('limit_tts_day', String(ttsPerDay));
  return getUsageLimits();
}

export function getDeviceUsageToday(deviceId, type) {
  const since = startOfUtcDayMs();
  const row = db
    .prepare(
      'SELECT COUNT(*) AS c FROM events WHERE device_id = ? AND type = ? AND ts >= ?',
    )
    .get(deviceId, type, since);
  return row?.c ?? 0;
}

export function checkUsageLimit(deviceId, type) {
  const limitKey = LIMIT_KEY_FOR_TYPE[type];
  if (!limitKey) {
    return { allowed: true, used: 0, limit: 0, type };
  }
  const limits = getUsageLimits();
  const limitMap = {
    limit_chats_day: limits.chatsPerDay,
    limit_gemini_day: limits.geminiPerDay,
    limit_tts_day: limits.ttsPerDay,
  };
  const limit = limitMap[limitKey];
  const used = getDeviceUsageToday(deviceId, type);
  const allowed = used < limit;
  return { allowed, used, limit, type, limitKey };
}

const insertEvent = db.prepare(`
  INSERT INTO events (ts, type, device_id, app_version, platform, meta)
  VALUES (@ts, @type, @deviceId, @appVersion, @platform, @meta)
`);

const upsertDevice = db.prepare(`
  INSERT INTO devices (device_id, first_seen, last_seen, app_version, platform, opens)
  VALUES (@deviceId, @ts, @ts, @appVersion, @platform, 1)
  ON CONFLICT(device_id) DO UPDATE SET
    last_seen = @ts,
    app_version = COALESCE(@appVersion, app_version),
    platform = COALESCE(@platform, platform),
    opens = opens + CASE WHEN @countOpen = 1 THEN 1 ELSE 0 END
`);

export function recordEvent({ type, deviceId, appVersion, platform, meta = {} }) {
  const billable = LIMIT_KEY_FOR_TYPE[type];
  if (billable) {
    const check = checkUsageLimit(deviceId, type);
    if (!check.allowed) {
      const err = new Error('limit_exceeded');
      err.code = 'limit_exceeded';
      err.details = check;
      throw err;
    }
  }
  const ts = Date.now();
  const metaJson = JSON.stringify(meta);
  insertEvent.run({
    ts,
    type,
    deviceId,
    appVersion: appVersion ?? null,
    platform: platform ?? null,
    meta: metaJson,
  });
  upsertDevice.run({
    deviceId,
    ts,
    appVersion: appVersion ?? null,
    platform: platform ?? null,
    countOpen: type === 'app_open' || type === 'install' ? 1 : 0,
  });
  return { ok: true, ts };
}

export function listExpenses() {
  return db
    .prepare('SELECT id, ts, label, amount, category, recurring, note FROM expenses ORDER BY ts DESC')
    .all();
}

export function addExpense({ label, amount, category, recurring, note }) {
  const ts = Date.now();
  const result = db
    .prepare(
      'INSERT INTO expenses (ts, label, amount, category, recurring, note) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(ts, label, amount, category ?? 'other', recurring ?? 'once', note ?? null);
  return { id: Number(result.lastInsertRowid), ts };
}

export function deleteExpense(id) {
  db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
}

function dayKey(ts) {
  return new Date(ts).toISOString().slice(0, 10);
}

export function getOverview() {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const weekAgo = now - 7 * day;
  const monthAgo = now - 30 * day;

  const totalDevices = db.prepare('SELECT COUNT(*) AS c FROM devices').get().c;
  const activeToday = db
    .prepare('SELECT COUNT(*) AS c FROM devices WHERE last_seen >= ?')
    .get(now - day).c;
  const activeWeek = db
    .prepare('SELECT COUNT(*) AS c FROM devices WHERE last_seen >= ?')
    .get(weekAgo).c;
  const opensWeek = db
    .prepare("SELECT COUNT(*) AS c FROM events WHERE type = 'app_open' AND ts >= ?")
    .get(weekAgo).c;
  const messagesWeek = db
    .prepare("SELECT COUNT(*) AS c FROM events WHERE type = 'assistant_message' AND ts >= ?")
    .get(weekAgo).c;
  const ttsWeek = db
    .prepare("SELECT COUNT(*) AS c FROM events WHERE type = 'tts_request' AND ts >= ?")
    .get(weekAgo).c;
  const installsWeek = db
    .prepare("SELECT COUNT(*) AS c FROM events WHERE type = 'install' AND ts >= ?")
    .get(weekAgo).c;

  const installsByDay = db
    .prepare(
      "SELECT ts FROM events WHERE type = 'install' AND ts >= ? ORDER BY ts ASC",
    )
    .all(monthAgo);
  const installChart = {};
  for (const row of installsByDay) {
    const k = dayKey(row.ts);
    installChart[k] = (installChart[k] ?? 0) + 1;
  }

  const opensByDay = db
    .prepare(
      "SELECT ts FROM events WHERE type = 'app_open' AND ts >= ? ORDER BY ts ASC",
    )
    .all(monthAgo);
  const opensChart = {};
  for (const row of opensByDay) {
    const k = dayKey(row.ts);
    opensChart[k] = (opensChart[k] ?? 0) + 1;
  }

  const versionRows = db
    .prepare(
      'SELECT app_version AS version, COUNT(*) AS count FROM devices WHERE app_version IS NOT NULL GROUP BY app_version ORDER BY count DESC',
    )
    .all();

  const platformRows = db
    .prepare(
      'SELECT platform, COUNT(*) AS count FROM devices WHERE platform IS NOT NULL GROUP BY platform ORDER BY count DESC',
    )
    .all();

  const recentDevices = db
    .prepare(
      'SELECT device_id, first_seen, last_seen, app_version, platform, opens FROM devices ORDER BY last_seen DESC LIMIT 20',
    )
    .all();

  const expenses = listExpenses();
  const expenseTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
  const monthlyRecurring = expenses
    .filter((e) => e.recurring === 'monthly')
    .reduce((sum, e) => sum + e.amount, 0);

  const geminiEst = messagesWeek * 0.002;
  const ttsEst = ttsWeek * 0.0001;

  return {
    generatedAt: now,
    totals: {
      devices: totalDevices,
      activeToday,
      activeWeek,
      opensWeek,
      messagesWeek,
      ttsWeek,
      installsWeek,
    },
    charts: {
      installs: installChart,
      opens: opensChart,
    },
    versions: versionRows,
    platforms: platformRows,
    recentDevices,
    expenses: {
      items: expenses,
      totalRecorded: expenseTotal,
      monthlyRecurring,
      estimated: {
        geminiWeekSek: Math.round(geminiEst * 100) / 100,
        ttsWeekSek: Math.round(ttsEst * 100) / 100,
        note: 'Uppskattning baserat på användning — inte exakta fakturor.',
      },
    },
    limits: getUsageLimits(),
  };
}
