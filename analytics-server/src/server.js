import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import cors from 'cors';
import express from 'express';

import { addExpense, deleteExpense, getOverview, getFinanceOverview, listExpenses, recordEvent, checkUsageLimit, getUsageLimits, setUsageLimits, getDeviceDetail } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3002);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'myassistant-admin';
const ANALYTICS_API_KEY = process.env.ANALYTICS_API_KEY ?? 'myassistant-analytics-key';
const TTS_HEALTH_URL = process.env.TTS_HEALTH_URL ?? 'http://127.0.0.1:3001/health';

const sessions = new Map();
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const app = express();
app.use(cors());
app.use(express.json({ limit: '64kb' }));
app.use(express.static(join(__dirname, '..', 'public')));

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function safeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function requireApiKey(req, res, next) {
  const key = req.headers['x-analytics-key'] ?? '';
  if (!safeEqual(String(key), ANALYTICS_API_KEY)) {
    return res.status(401).json({ error: 'Invalid analytics key' });
  }
  next();
}

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const hashed = hashToken(token);
  const session = sessions.get(hashed);
  if (!session || session.expiresAt < Date.now()) {
    if (session) sessions.delete(hashed);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  next();
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'myassistant-analytics' });
});

function clientCountry(req, meta = {}) {
  const fromMeta = meta.country ?? meta.region ?? null;
  if (fromMeta) return String(fromMeta).toUpperCase().slice(0, 8);
  const header =
    req.headers['cf-ipcountry'] ??
    req.headers['x-country'] ??
    req.headers['x-app-country'] ??
    null;
  if (header && header !== 'XX' && header !== 'T1') {
    return String(header).toUpperCase().slice(0, 8);
  }
  return null;
}

app.post('/api/events', requireApiKey, (req, res) => {
  const { type, deviceId, appVersion, platform, meta } = req.body ?? {};
  if (!type || typeof type !== 'string') {
    return res.status(400).json({ error: 'type required' });
  }
  if (!deviceId || typeof deviceId !== 'string' || deviceId.length > 128) {
    return res.status(400).json({ error: 'deviceId required' });
  }
  const allowed = new Set([
    'install',
    'app_open',
    'assistant_message',
    'tts_request',
    'gemini_request',
  ]);
  if (!allowed.has(type)) {
    return res.status(400).json({ error: 'invalid event type' });
  }
  try {
    const metaObj = meta ?? {};
    const result = recordEvent({
      type,
      deviceId,
      appVersion,
      platform,
      meta: metaObj,
      country: clientCountry(req, metaObj),
      locale: metaObj.locale ?? null,
      timezone: metaObj.timezone ?? null,
    });
    res.json(result);
  } catch (err) {
    if (err?.code === 'limit_exceeded') {
      return res.status(429).json({
        error: 'limit_exceeded',
        message: err.details?.message ?? 'Daglig gräns nådd för denna enhet.',
        ...err.details,
      });
    }
    console.error('[analytics] event failed', err);
    res.status(500).json({ error: 'Failed to record event' });
  }
});

app.get('/api/limits/check', requireApiKey, (req, res) => {
  const deviceId = String(req.query.deviceId ?? '');
  const type = String(req.query.type ?? '');
  if (!deviceId || !type) {
    return res.status(400).json({ error: 'deviceId and type required' });
  }
  const check = checkUsageLimit(deviceId, type);
  res.json({
    ...check,
    message: check.allowed ? null : (check.message ?? 'Du har nått dagens gräns. Försök igen imorgon.'),
  });
});

app.get('/api/admin/limits', requireAdmin, (_req, res) => {
  res.json(getUsageLimits());
});

app.put('/api/admin/limits', requireAdmin, (req, res) => {
  const body = req.body ?? {};
  const limits = setUsageLimits({
    chatsPerDay: body.chatsPerDay != null ? Number(body.chatsPerDay) : null,
    geminiPerDay: body.geminiPerDay != null ? Number(body.geminiPerDay) : null,
    ttsPerDay: body.ttsPerDay != null ? Number(body.ttsPerDay) : null,
    chatsPerMonth: body.chatsPerMonth != null ? Number(body.chatsPerMonth) : null,
    geminiPerMonth: body.geminiPerMonth != null ? Number(body.geminiPerMonth) : null,
    ttsPerMonth: body.ttsPerMonth != null ? Number(body.ttsPerMonth) : null,
    monthlyBudgetSek: body.monthlyBudgetSek != null ? Number(body.monthlyBudgetSek) : null,
    costGeminiSek: body.costGeminiSek != null ? Number(body.costGeminiSek) : null,
    costTtsSek: body.costTtsSek != null ? Number(body.costTtsSek) : null,
    targetPriceSek: body.targetPriceSek != null ? Number(body.targetPriceSek) : null,
  });
  res.json(limits);
});

app.post('/api/admin/login', (req, res) => {
  const password = String(req.body?.password ?? '');
  if (!safeEqual(password, ADMIN_PASSWORD)) {
    return res.status(401).json({ error: 'Fel lösenord' });
  }
  const token = randomBytes(32).toString('hex');
  sessions.set(hashToken(token), { expiresAt: Date.now() + SESSION_TTL_MS });
  res.json({ token, expiresInHours: 12 });
});

app.get('/api/admin/overview', requireAdmin, (_req, res) => {
  res.json(getOverview());
});

app.get('/api/admin/finance', requireAdmin, (_req, res) => {
  res.json(getFinanceOverview());
});

app.get('/api/admin/devices/:deviceId', requireAdmin, (req, res) => {
  const detail = getDeviceDetail(String(req.params.deviceId ?? ''));
  if (!detail) {
    return res.status(404).json({ error: 'Enhet hittades inte' });
  }
  res.json(detail);
});

app.get('/api/admin/expenses', requireAdmin, (_req, res) => {
  res.json({ items: listExpenses() });
});

app.post('/api/admin/expenses', requireAdmin, (req, res) => {
  const { label, amount, category, recurring, note } = req.body ?? {};
  if (!label || typeof label !== 'string') {
    return res.status(400).json({ error: 'label required' });
  }
  const num = Number(amount);
  if (!Number.isFinite(num) || num < 0) {
    return res.status(400).json({ error: 'amount must be a number' });
  }
  const row = addExpense({ label, amount: num, category, recurring, note });
  res.json(row);
});

app.delete('/api/admin/expenses/:id', requireAdmin, (req, res) => {
  deleteExpense(Number(req.params.id));
  res.json({ ok: true });
});

app.get('/api/admin/server-status', requireAdmin, async (_req, res) => {
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(TTS_HEALTH_URL, { signal: controller.signal });
    clearTimeout(timer);
    const body = await response.json().catch(() => ({}));
    res.json({
      tts: {
        ok: response.ok,
        status: response.status,
        latencyMs: Date.now() - started,
        body,
      },
    });
  } catch (err) {
    res.json({
      tts: {
        ok: false,
        status: 0,
        latencyMs: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      },
    });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Analytics + admin dashboard on http://0.0.0.0:${PORT}`);
});
