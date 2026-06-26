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

function ensureDeviceColumn(name, type = 'TEXT') {
  const cols = db.prepare('PRAGMA table_info(devices)').all();
  if (!cols.some((c) => c.name === name)) {
    db.exec(`ALTER TABLE devices ADD COLUMN ${name} ${type}`);
  }
}
ensureDeviceColumn('country');
ensureDeviceColumn('locale');
ensureDeviceColumn('timezone');

/**
 * Kostantaganden per händelse (SEK) — används för budgetgräns per enhet.
 *
 * Gemini (Google API, betal-per-anrop):
 *   ~0.06 kr/request — baserat på Gemini 2.0 Flash (~$0.10/1M input + $0.40/1M output).
 *   Typiskt assistentsvar ≈ 500 in + 300 ut tokens → ~$0.00017 ≈ 0.002 kr.
 *   Vi räknar högre (0.06) för att täcka längre kontext, flera försök och marginal.
 *
 * Alma TTS (egen Hetzner VPS):
 *   ~0.002 kr/request — nästan bara marginal elkostnad/CPU per kort ljudfil.
 *   Fast kostnad (Hetzner CX22 m.m.) ~50–120 kr/mån — registreras under Utgifter, inte per anrop.
 *
 * Målbudget 35 kr/mån/enhet vid pris 199 kr → ~82% bruttomarginal efter variabla API-kostnader.
 * Fast Hetzner (TTS + analytics) dras av separat i dashboardens utgiftslista.
 */
const DEFAULT_LIMITS = {
  limit_chats_day: Number(process.env.LIMIT_CHATS_DAY ?? 15),
  limit_gemini_day: Number(process.env.LIMIT_GEMINI_DAY ?? 15),
  limit_tts_day: Number(process.env.LIMIT_TTS_DAY ?? 20),
  limit_chats_month: Number(process.env.LIMIT_CHATS_MONTH ?? 400),
  limit_gemini_month: Number(process.env.LIMIT_GEMINI_MONTH ?? 400),
  limit_tts_month: Number(process.env.LIMIT_TTS_MONTH ?? 500),
  monthly_budget_sek: Number(process.env.MONTHLY_BUDGET_SEK ?? 35),
  cost_gemini_sek: Number(process.env.COST_GEMINI_SEK ?? 0.06),
  cost_tts_sek: Number(process.env.COST_TTS_SEK ?? 0.002),
};

const LIMIT_TYPE_CONFIG = {
  assistant_message: {
    dayKey: 'limit_chats_day',
    monthKey: 'limit_chats_month',
    costSek: 0,
  },
  gemini_request: {
    dayKey: 'limit_gemini_day',
    monthKey: 'limit_gemini_month',
    costKey: 'cost_gemini_sek',
  },
  tts_request: {
    dayKey: 'limit_tts_day',
    monthKey: 'limit_tts_month',
    costKey: 'cost_tts_sek',
  },
};

function startOfUtcMonthMs() {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

function getSetting(key, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!row) return fallback;
  const n = Number(row.value);
  return Number.isFinite(n) ? n : fallback;
}

function startOfUtcDayMs() {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function getUsageLimits() {
  return {
    chatsPerDay: getSetting('limit_chats_day', DEFAULT_LIMITS.limit_chats_day),
    geminiPerDay: getSetting('limit_gemini_day', DEFAULT_LIMITS.limit_gemini_day),
    ttsPerDay: getSetting('limit_tts_day', DEFAULT_LIMITS.limit_tts_day),
    chatsPerMonth: getSetting('limit_chats_month', DEFAULT_LIMITS.limit_chats_month),
    geminiPerMonth: getSetting('limit_gemini_month', DEFAULT_LIMITS.limit_gemini_month),
    ttsPerMonth: getSetting('limit_tts_month', DEFAULT_LIMITS.limit_tts_month),
    monthlyBudgetSek: getSetting('monthly_budget_sek', DEFAULT_LIMITS.monthly_budget_sek),
    costGeminiSek: getSetting('cost_gemini_sek', DEFAULT_LIMITS.cost_gemini_sek),
    costTtsSek: getSetting('cost_tts_sek', DEFAULT_LIMITS.cost_tts_sek),
    targetPriceSek: getSetting('target_price_sek', 199),
  };
}

export function setUsageLimits({
  chatsPerDay,
  geminiPerDay,
  ttsPerDay,
  chatsPerMonth,
  geminiPerMonth,
  ttsPerMonth,
  monthlyBudgetSek,
  costGeminiSek,
  costTtsSek,
  targetPriceSek,
}) {
  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  );
  const pairs = [
    ['limit_chats_day', chatsPerDay],
    ['limit_gemini_day', geminiPerDay],
    ['limit_tts_day', ttsPerDay],
    ['limit_chats_month', chatsPerMonth],
    ['limit_gemini_month', geminiPerMonth],
    ['limit_tts_month', ttsPerMonth],
    ['monthly_budget_sek', monthlyBudgetSek],
    ['cost_gemini_sek', costGeminiSek],
    ['cost_tts_sek', costTtsSek],
    ['target_price_sek', targetPriceSek],
  ];
  for (const [key, val] of pairs) {
    if (val != null) upsert.run(key, String(val));
  }
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

export function getDeviceUsageMonth(deviceId, type) {
  const since = startOfUtcMonthMs();
  const row = db
    .prepare(
      'SELECT COUNT(*) AS c FROM events WHERE device_id = ? AND type = ? AND ts >= ?',
    )
    .get(deviceId, type, since);
  return row?.c ?? 0;
}

export function getDeviceEstimatedCostMonth(deviceId) {
  const since = startOfUtcMonthMs();
  const limits = getUsageLimits();
  const gemini = db
    .prepare(
      "SELECT COUNT(*) AS c FROM events WHERE device_id = ? AND type = 'gemini_request' AND ts >= ?",
    )
    .get(deviceId, since)?.c ?? 0;
  const tts = db
    .prepare(
      "SELECT COUNT(*) AS c FROM events WHERE device_id = ? AND type = 'tts_request' AND ts >= ?",
    )
    .get(deviceId, since)?.c ?? 0;
  return gemini * limits.costGeminiSek + tts * limits.costTtsSek;
}

function eventCost(type, limits) {
  const cfg = LIMIT_TYPE_CONFIG[type];
  if (!cfg?.costKey) return 0;
  return limits[cfg.costKey === 'cost_gemini_sek' ? 'costGeminiSek' : 'costTtsSek'] ?? 0;
}

export function checkUsageLimit(deviceId, type) {
  const cfg = LIMIT_TYPE_CONFIG[type];
  if (!cfg) {
    return { allowed: true, used: 0, limit: 0, type };
  }
  const limits = getUsageLimits();
  const usedDay = getDeviceUsageToday(deviceId, type);
  const usedMonth = getDeviceUsageMonth(deviceId, type);
  const dayLimitMap = {
    limit_chats_day: limits.chatsPerDay,
    limit_gemini_day: limits.geminiPerDay,
    limit_tts_day: limits.ttsPerDay,
  };
  const monthLimitMap = {
    limit_chats_month: limits.chatsPerMonth,
    limit_gemini_month: limits.geminiPerMonth,
    limit_tts_month: limits.ttsPerMonth,
  };
  const dayCap = dayLimitMap[cfg.dayKey];
  const monthCap = monthLimitMap[cfg.monthKey];
  const costMonth = getDeviceEstimatedCostMonth(deviceId);
  const nextCost = eventCost(type, limits);
  const budget = limits.monthlyBudgetSek;

  if (usedDay >= dayCap) {
    return {
      allowed: false,
      used: usedDay,
      limit: dayCap,
      type,
      period: 'day',
      message: 'Du har nått dagens gräns. Försök igen imorgon.',
    };
  }
  if (usedMonth >= monthCap) {
    return {
      allowed: false,
      used: usedMonth,
      limit: monthCap,
      type,
      period: 'month',
      message: 'Du har nått månadens gräns. Försök igen nästa månad.',
    };
  }
  if (costMonth + nextCost > budget) {
    return {
      allowed: false,
      used: Math.round(costMonth * 100) / 100,
      limit: budget,
      type,
      period: 'budget',
      message: 'Månadens kostnadsgräns är nådd. Försök igen nästa månad.',
    };
  }
  return {
    allowed: true,
    used: usedDay,
    limit: dayCap,
    usedMonth,
    monthLimit: monthCap,
    costMonth: Math.round(costMonth * 100) / 100,
    budget,
    type,
  };
}

const insertEvent = db.prepare(`
  INSERT INTO events (ts, type, device_id, app_version, platform, meta)
  VALUES (@ts, @type, @deviceId, @appVersion, @platform, @meta)
`);

const upsertDevice = db.prepare(`
  INSERT INTO devices (device_id, first_seen, last_seen, app_version, platform, opens, country, locale, timezone)
  VALUES (@deviceId, @ts, @ts, @appVersion, @platform, 1, @country, @locale, @timezone)
  ON CONFLICT(device_id) DO UPDATE SET
    last_seen = @ts,
    app_version = COALESCE(@appVersion, app_version),
    platform = COALESCE(@platform, platform),
    country = COALESCE(@country, country),
    locale = COALESCE(@locale, locale),
    timezone = COALESCE(@timezone, timezone),
    opens = opens + CASE WHEN @countOpen = 1 THEN 1 ELSE 0 END
`);

export function recordEvent({
  type,
  deviceId,
  appVersion,
  platform,
  meta = {},
  country = null,
  locale = null,
  timezone = null,
}) {
  const billable = LIMIT_TYPE_CONFIG[type];
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
  const geoCountry =
    country ?? meta.country ?? meta.region ?? null;
  const geoLocale = locale ?? meta.locale ?? null;
  const geoTimezone = timezone ?? meta.timezone ?? null;

  upsertDevice.run({
    deviceId,
    ts,
    appVersion: appVersion ?? null,
    platform: platform ?? null,
    country: geoCountry ? String(geoCountry).toUpperCase().slice(0, 8) : null,
    locale: geoLocale ? String(geoLocale).slice(0, 32) : null,
    timezone: geoTimezone ? String(geoTimezone).slice(0, 64) : null,
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
      `SELECT device_id, first_seen, last_seen, app_version, platform, opens, country, locale, timezone
       FROM devices ORDER BY last_seen DESC LIMIT 20`,
    )
    .all();

  const limits = getUsageLimits();
  const monthStart = startOfUtcMonthMs();
  const topDevices = db
    .prepare(
      `SELECT d.device_id, d.country, d.locale, d.platform, d.opens, d.last_seen,
        SUM(CASE WHEN e.type = 'assistant_message' THEN 1 ELSE 0 END) AS chats_month,
        SUM(CASE WHEN e.type = 'gemini_request' THEN 1 ELSE 0 END) AS gemini_month,
        SUM(CASE WHEN e.type = 'tts_request' THEN 1 ELSE 0 END) AS tts_month
       FROM devices d
       LEFT JOIN events e ON e.device_id = d.device_id AND e.ts >= ?
       GROUP BY d.device_id
       ORDER BY chats_month DESC, gemini_month DESC, d.opens DESC
       LIMIT 15`,
    )
    .all(monthStart);

  const geminiWeekCount = db
    .prepare("SELECT COUNT(*) AS c FROM events WHERE type = 'gemini_request' AND ts >= ?")
    .get(weekAgo)?.c ?? 0;
  const geminiEst = geminiWeekCount * limits.costGeminiSek;
  const ttsEst = ttsWeek * limits.costTtsSek;

  const expenses = listExpenses();
  const expenseTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
  const monthlyRecurring = expenses
    .filter((e) => e.recurring === 'monthly')
    .reduce((sum, e) => sum + e.amount, 0);

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
    topDevices,
    expenses: {
      items: expenses,
      totalRecorded: expenseTotal,
      monthlyRecurring,
      estimated: {
        geminiWeekSek: Math.round(geminiEst * 100) / 100,
        ttsWeekSek: Math.round(ttsEst * 100) / 100,
        geminiPerRequestSek: limits.costGeminiSek,
        ttsPerRequestSek: limits.costTtsSek,
        note: 'Variabla kostnader (7d). Fast Hetzner m.m. under Utgifter.',
      },
    },
    limits,
    costAssumptions: {
      geminiPerRequestSek: limits.costGeminiSek,
      ttsPerRequestSek: limits.costTtsSek,
      monthlyBudgetPerDeviceSek: limits.monthlyBudgetSek,
      targetPriceSek: limits.targetPriceSek,
      hetznerNote: 'Fast serverkostnad (Alma TTS + analytics) — lägg till under Utgifter, typ ~50–120 kr/mån.',
    },
  };
}

const EVENT_TYPES = ['app_open', 'assistant_message', 'gemini_request', 'tts_request', 'install'];

const TRIAL_DAYS = 60;
const ACTIVE_WINDOW_DAYS = 30;
const VAT_RATE = 0.25;

function roundSek(n) {
  return Math.round(n * 100) / 100;
}

function deviceFinanceStatus(firstSeen, lastSeen, now) {
  const day = 24 * 60 * 60 * 1000;
  const trialMs = TRIAL_DAYS * day;
  const activeSince = now - ACTIVE_WINDOW_DAYS * day;
  const isActive = lastSeen >= activeSince;
  const isPastTrial = now - firstSeen >= trialMs;
  if (!isPastTrial) {
    return {
      status: isActive ? 'trial' : 'trial_inactive',
      isActive,
      isPaying: false,
      trialDaysLeft: Math.max(0, Math.ceil((trialMs - (now - firstSeen)) / day)),
    };
  }
  return {
    status: isActive ? 'paying' : 'paying_inactive',
    isActive,
    isPaying: true,
    trialDaysLeft: 0,
  };
}

function buildFinanceWarnings({ profitInklMoms, marginPercent, paying, trial, apiCost, revenue, expenses }) {
  const warnings = [];
  if (revenue === 0 && trial > 0) {
    warnings.push({
      level: 'info',
      text: `${trial} användare i gratisperiod — ingen MRR ännu.`,
    });
  }
  if (profitInklMoms < 0) {
    warnings.push({
      level: 'danger',
      text: `Negativ vinst (${roundSek(profitInklMoms)} kr/mån). Kontrollera utgifter och API-kostnader.`,
    });
  } else if (marginPercent != null && marginPercent < 20) {
    warnings.push({
      level: 'danger',
      text: `Låg marginal (${marginPercent}%). MRR täcker knappt kostnaderna.`,
    });
  } else if (marginPercent != null && marginPercent < 50) {
    warnings.push({
      level: 'warn',
      text: `Marginal ${marginPercent}% — överväg att höja pris eller sänka gränser.`,
    });
  }
  if (apiCost > revenue && revenue > 0) {
    warnings.push({
      level: 'warn',
      text: 'Variabla API-kostnader överstiger intäkter denna månad.',
    });
  }
  if (expenses > 0 && paying === 0) {
    warnings.push({
      level: 'warn',
      text: 'Fasta utgifter registrerade men inga betalande aktiva användare.',
    });
  }
  return warnings;
}

export function getFinanceOverview() {
  const now = Date.now();
  const limits = getUsageLimits();
  const targetPriceSek = limits.targetPriceSek;
  const monthStart = startOfUtcMonthMs();

  const allDevices = db
    .prepare(
      `SELECT device_id, first_seen, last_seen, app_version, platform, opens, country, locale
       FROM devices`,
    )
    .all();

  let payingCount = 0;
  let trialCount = 0;
  let payingInactiveCount = 0;
  let trialInactiveCount = 0;
  let estimatedApiCostMonth = 0;
  const deviceBreakdown = [];

  for (const d of allDevices) {
    const fin = deviceFinanceStatus(d.first_seen, d.last_seen, now);
    if (fin.status === 'paying') payingCount += 1;
    else if (fin.status === 'trial') trialCount += 1;
    else if (fin.status === 'paying_inactive') payingInactiveCount += 1;
    else trialInactiveCount += 1;

    let apiCostMonth = 0;
    if (fin.isActive) {
      apiCostMonth = getDeviceEstimatedCostMonth(d.device_id);
      estimatedApiCostMonth += apiCostMonth;
    }

    const revenueSek = fin.status === 'paying' ? targetPriceSek : 0;

    deviceBreakdown.push({
      device_id: d.device_id,
      status: fin.status,
      first_seen: d.first_seen,
      last_seen: d.last_seen,
      country: d.country,
      platform: d.platform,
      opens: d.opens,
      apiCostMonth: roundSek(apiCostMonth),
      revenueSek,
      trialDaysLeft: fin.trialDaysLeft,
      isActive: fin.isActive,
    });
  }

  const statusOrder = { paying: 0, trial: 1, paying_inactive: 2, trial_inactive: 3 };
  deviceBreakdown.sort(
    (a, b) =>
      (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9) ||
      b.revenueSek - a.revenueSek ||
      b.apiCostMonth - a.apiCostMonth,
  );

  const mrrGrossInklMoms = payingCount * targetPriceSek;
  const momsAmount = roundSek(mrrGrossInklMoms * (VAT_RATE / (1 + VAT_RATE)));
  const mrrNetExMoms = roundSek(mrrGrossInklMoms - momsAmount);

  const expenses = listExpenses();
  const monthlyRecurring = expenses
    .filter((e) => e.recurring === 'monthly')
    .reduce((sum, e) => sum + e.amount, 0);
  const oneTimeThisMonth = expenses
    .filter((e) => e.recurring !== 'monthly' && e.ts >= monthStart)
    .reduce((sum, e) => sum + e.amount, 0);
  const recordedExpensesMonth = roundSek(monthlyRecurring + oneTimeThisMonth);
  const estimatedApiCostMonthRounded = roundSek(estimatedApiCostMonth);
  const totalCosts = roundSek(estimatedApiCostMonthRounded + recordedExpensesMonth);
  const profitInklMoms = roundSek(mrrGrossInklMoms - totalCosts);
  const profitExMoms = roundSek(mrrNetExMoms - totalCosts);
  const marginPercent =
    mrrGrossInklMoms > 0 ? Math.round((profitInklMoms / mrrGrossInklMoms) * 100) : null;

  return {
    generatedAt: now,
    trialDays: TRIAL_DAYS,
    activeWindowDays: ACTIVE_WINDOW_DAYS,
    targetPriceSek,
    vatRate: VAT_RATE,
    subscribers: {
      paying: payingCount,
      trial: trialCount,
      payingInactive: payingInactiveCount,
      trialInactive: trialInactiveCount,
      activeTotal: payingCount + trialCount,
      totalDevices: allDevices.length,
    },
    revenue: {
      mrrGrossInklMoms,
      mrrNetExMoms,
      momsAmount,
      note: 'Abonnemangspris antas inkl. 25% moms (B2C).',
    },
    costs: {
      estimatedApiMonth: estimatedApiCostMonthRounded,
      recordedExpensesMonth,
      monthlyRecurring: roundSek(monthlyRecurring),
      oneTimeThisMonth: roundSek(oneTimeThisMonth),
      total: totalCosts,
    },
    profit: {
      inklMoms: profitInklMoms,
      exMoms: profitExMoms,
      marginPercent,
    },
    assumptions: {
      trialDays: TRIAL_DAYS,
      activeWindowDays: ACTIVE_WINDOW_DAYS,
      targetPriceSek,
      costGeminiSek: limits.costGeminiSek,
      costTtsSek: limits.costTtsSek,
      monthlyBudgetPerDeviceSek: limits.monthlyBudgetSek,
    },
    devices: deviceBreakdown,
    warnings: buildFinanceWarnings({
      profitInklMoms,
      marginPercent,
      paying: payingCount,
      trial: trialCount,
      apiCost: estimatedApiCostMonthRounded,
      revenue: mrrGrossInklMoms,
      expenses: recordedExpensesMonth,
    }),
  };
}

export function getDeviceDetail(deviceId) {
  const device = db
    .prepare(
      `SELECT device_id, first_seen, last_seen, app_version, platform, opens, country, locale, timezone
       FROM devices WHERE device_id = ?`,
    )
    .get(deviceId);
  if (!device) return null;

  const limits = getUsageLimits();
  const sinceMonth = startOfUtcMonthMs();
  const sinceDay = startOfUtcDayMs();
  const usage = {};
  for (const type of EVENT_TYPES) {
    usage[type] = {
      today:
        db
          .prepare(
            'SELECT COUNT(*) AS c FROM events WHERE device_id = ? AND type = ? AND ts >= ?',
          )
          .get(deviceId, type, sinceDay)?.c ?? 0,
      month:
        db
          .prepare(
            'SELECT COUNT(*) AS c FROM events WHERE device_id = ? AND type = ? AND ts >= ?',
          )
          .get(deviceId, type, sinceMonth)?.c ?? 0,
      total:
        db.prepare('SELECT COUNT(*) AS c FROM events WHERE device_id = ? AND type = ?').get(deviceId, type)
          ?.c ?? 0,
    };
  }

  const costMonth = getDeviceEstimatedCostMonth(deviceId);
  const fin = deviceFinanceStatus(device.first_seen, device.last_seen, Date.now());
  const recentEvents = db
    .prepare(
      'SELECT ts, type, app_version, platform, meta FROM events WHERE device_id = ? ORDER BY ts DESC LIMIT 25',
    )
    .all(deviceId)
    .map((row) => ({
      ...row,
      meta: row.meta ? JSON.parse(row.meta) : {},
    }));

  return {
    device,
    usage,
    costMonth: Math.round(costMonth * 100) / 100,
    budget: limits.monthlyBudgetSek,
    subscription: {
      status: fin.status,
      trialDaysLeft: fin.trialDaysLeft,
      isPaying: fin.isPaying,
      revenueSek: fin.status === 'paying' ? limits.targetPriceSek : 0,
    },
    limits: {
      chatsPerDay: limits.chatsPerDay,
      geminiPerDay: limits.geminiPerDay,
      ttsPerDay: limits.ttsPerDay,
    },
    recentEvents,
  };
}
