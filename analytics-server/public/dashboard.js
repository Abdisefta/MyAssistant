const TOKEN_KEY = 'myassistant_admin_token';

const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const passwordInput = document.getElementById('password-input');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');

function token() {
  return localStorage.getItem(TOKEN_KEY) ?? '';
}

function setToken(value) {
  if (value) localStorage.setItem(TOKEN_KEY, value);
  else localStorage.removeItem(TOKEN_KEY);
}

async function api(path, options = {}) {
  const headers = { ...(options.headers ?? {}) };
  if (token()) headers.Authorization = `Bearer ${token()}`;
  if (options.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(path, { ...options, headers });
  if (res.status === 401) {
    setToken('');
    showLogin();
    throw new Error('Unauthorized');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data;
}

function showLogin() {
  loginScreen.classList.remove('hidden');
  appScreen.classList.add('hidden');
}

function showApp() {
  loginScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
}

function formatDate(ts) {
  return new Date(ts).toLocaleString('sv-SE');
}

function formatSek(n) {
  return `${Number(n).toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kr`;
}

function renderChart(containerId, chartData) {
  const el = document.getElementById(containerId);
  const entries = Object.entries(chartData ?? {}).slice(-30);
  if (!entries.length) {
    el.innerHTML = '<p class="muted">Ingen data ännu</p>';
    return;
  }
  const max = Math.max(...entries.map(([, v]) => v), 1);
  el.innerHTML = entries
    .map(([day, value]) => {
      const h = Math.max(4, Math.round((value / max) * 100));
      const label = day.slice(5);
      return `<div class="bar-wrap" title="${day}: ${value}"><div class="bar" style="height:${h}px"></div><span class="bar-label">${label}</span></div>`;
    })
    .join('');
}

function renderOverview(data) {
  const t = data.totals;
  document.getElementById('stat-cards').innerHTML = [
    ['Enheter totalt', t.devices],
    ['Aktiva idag', t.activeToday],
    ['Aktiva 7 dagar', t.activeWeek],
    ['Öppningar 7d', t.opensWeek],
    ['Chattar 7d', t.messagesWeek],
    ['TTS 7d', t.ttsWeek],
    ['Nya enheter 7d', t.installsWeek],
  ]
    .map(
      ([label, value]) =>
        `<div class="card"><div class="value">${value}</div><div class="label">${label}</div></div>`,
    )
    .join('');

  document.getElementById('updated-at').textContent = `Uppdaterad ${formatDate(data.generatedAt)}`;

  renderChart('install-chart', data.charts.installs);
  renderChart('opens-chart', data.charts.opens);

  document.getElementById('version-list').innerHTML = (data.versions ?? [])
    .map((r) => `<div class="row"><span>v${r.version}</span><strong>${r.count}</strong></div>`)
    .join('') || '<p class="muted">Ingen data</p>';

  document.getElementById('platform-list').innerHTML = (data.platforms ?? [])
    .map((r) => `<div class="row"><span>${r.platform}</span><strong>${r.count}</strong></div>`)
    .join('') || '<p class="muted">Ingen data</p>';

  const exp = data.expenses;
  document.getElementById('expense-summary').textContent =
    `Registrerat: ${formatSek(exp.totalRecorded)} · Månadsfast: ${formatSek(exp.monthlyRecurring)}`;

  document.getElementById('expense-list').innerHTML = (exp.items ?? [])
    .map(
      (e) => `<div class="row">
        <span>${e.label} <span class="muted">(${e.category}${e.recurring === 'monthly' ? ', /mån' : ''})</span></span>
        <span><strong>${formatSek(e.amount)}</strong>
          <button type="button" class="ghost" data-del-expense="${e.id}" style="margin-left:8px;padding:2px 8px;font-size:0.75rem">Ta bort</button>
        </span>
      </div>`,
    )
    .join('') || '<p class="muted">Inga utgifter registrerade — lägg till Hetzner, domän m.m.</p>';

  document.querySelectorAll('[data-del-expense]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api(`/api/admin/expenses/${btn.dataset.delExpense}`, { method: 'DELETE' });
      await refresh();
    });
  });

  document.getElementById('device-list').innerHTML = `<table>
    <thead><tr><th>Enhet</th><th>Version</th><th>Öppningar</th><th>Senast aktiv</th></tr></thead>
    <tbody>${(data.recentDevices ?? [])
      .map(
        (d) => `<tr>
          <td>${d.device_id.slice(0, 8)}…</td>
          <td>${d.app_version ?? '—'}</td>
          <td>${d.opens}</td>
          <td>${formatDate(d.last_seen)}</td>
        </tr>`,
      )
      .join('')}</tbody></table>`;

  document.getElementById('cost-estimate').innerHTML = `
    <div class="row"><span>Gemini (uppskattning)</span><strong>${formatSek(exp.estimated.geminiWeekSek)}</strong></div>
    <div class="row"><span>TTS (uppskattning)</span><strong>${formatSek(exp.estimated.ttsWeekSek)}</strong></div>
    <p class="muted">${exp.estimated.note}</p>`;
}

async function renderServerStatus() {
  const el = document.getElementById('server-status');
  try {
    const data = await api('/api/admin/server-status');
    const tts = data.tts;
    el.innerHTML = `<div class="row">
      <span>Alma TTS</span>
      <span class="${tts.ok ? 'status-ok' : 'status-bad'}">${tts.ok ? 'Online' : 'Offline'} · ${tts.latencyMs} ms</span>
    </div>`;
  } catch {
    el.innerHTML = '<p class="muted">Kunde inte hämta serverstatus</p>';
  }
}

async function refresh() {
  const data = await api('/api/admin/overview');
  renderOverview(data);
  await renderServerStatus();
}

loginBtn.addEventListener('click', async () => {
  loginError.classList.add('hidden');
  try {
    const data = await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password: passwordInput.value }),
    });
    setToken(data.token);
    showApp();
    await refresh();
  } catch {
    loginError.textContent = 'Fel lösenord';
    loginError.classList.remove('hidden');
  }
});

passwordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginBtn.click();
});

logoutBtn.addEventListener('click', () => {
  setToken('');
  showLogin();
});

document.getElementById('expense-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  await api('/api/admin/expenses', {
    method: 'POST',
    body: JSON.stringify({
      label: fd.get('label'),
      amount: fd.get('amount'),
      category: fd.get('category'),
      recurring: fd.get('recurring'),
      note: fd.get('note') || undefined,
    }),
  });
  e.target.reset();
  await refresh();
});

if (token()) {
  showApp();
  refresh().catch(showLogin);
} else {
  showLogin();
}

setInterval(() => {
  if (token()) refresh().catch(() => {});
}, 60_000);
