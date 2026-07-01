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

function formatSek(n, decimals = 0) {
  return `${Number(n).toLocaleString('sv-SE', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })} kr`;
}

function statusBadge(status) {
  const labels = {
    paying: 'Betalande',
    trial: 'Gratisperiod',
    free_forever: 'Gratis abonnemang',
    paying_inactive: 'Betalande (inaktiv)',
    trial_inactive: 'Trial (inaktiv)',
    blocked: 'Spärrad',
  };
  return `<span class="status-badge ${status}">${labels[status] ?? status}</span>`;
}

function freeForeverBadge(device) {
  if (!device?.freeForever) return '';
  return `<span class="status-badge free_forever" title="${device.freeForeverNote ?? 'Betalar inte 199 kr — 35 kr API-gräns gäller'}">Gratis abo</span>`;
}

function renderFinance(data) {
  if (!data) return;

  const warningsEl = document.getElementById('finance-warnings');
  warningsEl.innerHTML = (data.warnings ?? [])
    .map((w) => `<div class="finance-warning ${w.level}">${w.text}</div>`)
    .join('');

  const profit = data.profit?.inklMoms ?? 0;
  const mrr = data.revenue?.mrrGrossInklMoms ?? 0;
  document.getElementById('finance-cards').innerHTML = [
    ['MRR (inkl. moms)', formatSek(mrr), 'neutral'],
    ['Betalande / trial', `${data.subscribers?.paying ?? 0} / ${data.subscribers?.trial ?? 0}`, 'neutral'],
    ['API-kostnad / mån', formatSek(data.costs?.estimatedApiMonth ?? 0), 'negative'],
    ['Utgifter / mån', formatSek(data.costs?.recordedExpensesMonth ?? 0), 'negative'],
    ['Uppskattad vinst', formatSek(profit), profit >= 0 ? 'positive' : 'negative'],
    ['Marginal', data.profit?.marginPercent != null ? `${data.profit.marginPercent}%` : '—', profit >= 0 ? 'positive' : 'negative'],
  ]
    .map(
      ([label, value, tone]) =>
        `<div class="card ${tone}"><div class="value">${value}</div><div class="label">${label}</div></div>`,
    )
    .join('');

  document.getElementById('finance-revenue').innerHTML = `
    <div class="row"><span>MRR inkl. moms</span><strong>${formatSek(data.revenue?.mrrGrossInklMoms ?? 0)}</strong></div>
    <div class="row"><span>Varav moms (25%)</span><strong>${formatSek(data.revenue?.momsAmount ?? 0)}</strong></div>
    <div class="row"><span>Netto exkl. moms</span><strong>${formatSek(data.revenue?.mrrNetExMoms ?? 0)}</strong></div>
    <div class="row"><span>Pris / betalande</span><strong>${formatSek(data.targetPriceSek ?? 199)}</strong></div>
    <p class="muted">${data.revenue?.note ?? ''}</p>`;

  document.getElementById('finance-costs').innerHTML = `
    <div class="row"><span>Variabel API (Gemini + TTS)</span><strong>${formatSek(data.costs?.estimatedApiMonth ?? 0)}</strong></div>
    <div class="row"><span>Fasta utgifter (månadsvis)</span><strong>${formatSek(data.costs?.monthlyRecurring ?? 0)}</strong></div>
    <div class="row"><span>Engångsutgifter (denna månad)</span><strong>${formatSek(data.costs?.oneTimeThisMonth ?? 0)}</strong></div>
    <div class="row"><span>Totalt kostnader</span><strong>${formatSek(data.costs?.total ?? 0)}</strong></div>
    <p class="muted">Lägg till Hetzner m.m. under Utgifter nedan. API-kostnad räknas på aktiva enheter denna månad.</p>`;

  document.getElementById('finance-profit').innerHTML = `
    <div class="row"><span>Vinst inkl. moms</span><strong class="${profit >= 0 ? 'status-ok' : 'status-bad'}">${formatSek(profit)}</strong></div>
    <div class="row"><span>Vinst exkl. moms</span><strong>${formatSek(data.profit?.exMoms ?? 0)}</strong></div>
    <div class="row"><span>Bruttomarginal</span><strong>${data.profit?.marginPercent != null ? `${data.profit.marginPercent}%` : '—'}</strong></div>
    <div class="row"><span>Gratisperiod</span><strong>${data.trialDays ?? 60} dagar</strong></div>`;

  const sub = data.subscribers ?? {};
  document.getElementById('finance-subscribers').innerHTML = `
    <div class="row"><span>Betalande (aktiva)</span><strong>${sub.paying ?? 0}</strong></div>
    <div class="row"><span>Gratisperiod (aktiva)</span><strong>${sub.trial ?? 0}</strong></div>
    <div class="row"><span>Gratis abonnemang</span><strong>${sub.freeForever ?? 0}</strong></div>
    <div class="row"><span>Betalande men inaktiva (30d)</span><strong>${sub.payingInactive ?? 0}</strong></div>
    <div class="row"><span>Trial inaktiva</span><strong>${sub.trialInactive ?? 0}</strong></div>
    <div class="row"><span>Totalt enheter</span><strong>${sub.totalDevices ?? 0}</strong></div>`;

  document.getElementById('finance-devices').innerHTML = `<table>
    <thead><tr><th>Enhet</th><th>Status</th><th>Land</th><th>API / mån</th><th>Intäkt</th><th>Trial kvar</th><th>Senast</th></tr></thead>
    <tbody>${(data.devices ?? [])
      .map(
        (d) => `<tr class="clickable" data-device-id="${d.device_id}">
          <td>${d.device_id.slice(0, 8)}… ${freeForeverBadge(d)}</td>
          <td>${statusBadge(d.status)}</td>
          <td>${d.country ?? '—'}</td>
          <td>${formatSek(d.apiCostMonth, 2)}</td>
          <td>${d.revenueSek > 0 ? formatSek(d.revenueSek) : '—'}</td>
          <td>${d.trialDaysLeft > 0 ? `${d.trialDaysLeft} d` : '—'}</td>
          <td>${formatDate(d.last_seen)}</td>
        </tr>`,
      )
      .join('')}</tbody></table>` || '<p class="muted">Inga enheter ännu</p>';

  bindDeviceClicks();
}

function renderMonthlyChart(containerId, months, valueKey, label) {
  const el = document.getElementById(containerId);
  const entries = months ?? [];
  if (!entries.length) {
    el.innerHTML = '<p class="muted">Ingen data ännu</p>';
    return;
  }
  const max = Math.max(...entries.map((m) => m[valueKey] ?? 0), 1);
  el.innerHTML = entries
    .map((m) => {
      const value = m[valueKey] ?? 0;
      const h = Math.max(4, Math.round((value / max) * 100));
      return `<div class="bar-wrap" title="${m.month}: ${value} ${label}"><div class="bar" style="height:${h}px"></div><span class="bar-label">${m.month.slice(5)}</span></div>`;
    })
    .join('');
}

function renderGrowthCharts(data) {
  const months = data?.months ?? data ?? [];
  renderMonthlyChart('growth-new-chart', months, 'newDevices', 'nya enheter');
  renderMonthlyChart('growth-active-chart', months, 'activeDevices', 'aktiva enheter');
  renderMonthlyChart('growth-paying-chart', months, 'paying', 'betalande');
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

function countryLabel(code) {
  if (!code) return '—';
  try {
    return `${code} — ${new Intl.DisplayNames(['sv'], { type: 'region' }).of(code) ?? code}`;
  } catch {
    return code;
  }
}

async function openDeviceModal(deviceId) {
  const modal = document.getElementById('device-modal');
  const body = document.getElementById('device-modal-body');
  body.innerHTML = '<p class="muted">Laddar…</p>';
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  try {
    const data = await api(`/api/admin/devices/${encodeURIComponent(deviceId)}`);
    const d = data.device;
    const u = data.usage ?? {};
    const isBlocked = Boolean(d.blocked);
    const isFreeForever = Boolean(d.free_forever);
    body.innerHTML = `
      <p class="device-id-mono">${d.device_id}</p>
      ${isBlocked ? `<div class="finance-warning bad">Spärrad${d.blocked_reason ? `: ${d.blocked_reason}` : ''}${d.blocked_at ? ` · ${formatDate(d.blocked_at)}` : ''}</div>` : ''}
      ${isFreeForever ? `<div class="finance-warning info">Gratis abonnemang — betalar inte 199 kr/mån. 35 kr API-gräns gäller fortfarande.${d.free_forever_note ? ` Anteckning: ${d.free_forever_note}` : ''}</div>` : ''}
      <div class="section-title">Plats &amp; språk</div>
      <div class="row"><span>Land</span><strong>${countryLabel(d.country)}</strong></div>
      <div class="row"><span>Locale</span><strong>${d.locale ?? '—'}</strong></div>
      <div class="row"><span>Tidszon</span><strong>${d.timezone ?? '—'}</strong></div>
      <div class="section-title">Enhet</div>
      <div class="row"><span>Plattform</span><strong>${d.platform ?? '—'}</strong></div>
      <div class="row"><span>App-version</span><strong>${d.app_version ?? '—'}</strong></div>
      <div class="row"><span>Öppningar totalt</span><strong>${d.opens}</strong></div>
      <div class="row"><span>Första gången</span><strong>${formatDate(d.first_seen)}</strong></div>
      <div class="row"><span>Senast aktiv</span><strong>${formatDate(d.last_seen)}</strong></div>
      <div class="section-title">Användning denna månad</div>
      <div class="row"><span>Chattar</span><strong>${u.assistant_message?.month ?? 0}</strong></div>
      <div class="row"><span>Gemini-anrop</span><strong>${u.gemini_request?.month ?? 0}</strong></div>
      <div class="row"><span>TTS / röst</span><strong>${u.tts_request?.month ?? 0}</strong></div>
      <div class="row"><span>App-öppningar</span><strong>${u.app_open?.month ?? 0}</strong></div>
      <div class="section-title">Abonnemang</div>
      <div class="row"><span>Status</span><strong>${statusBadge(data.subscription?.status ?? 'trial')}</strong></div>
      ${data.subscription?.trialEmailKnown ? `<div class="row"><span>E-post trial</span><strong>${data.subscription.trialEmailEligible ? 'Aktiv gratisperiod' : 'Gratisperiod förbrukad'}</strong></div>` : '<div class="row"><span>E-post trial</span><strong class="muted">Okänd (gäst/enhet)</strong></div>'}
      ${data.subscription?.trialDaysLeft > 0 ? `<div class="row"><span>Gratisperiod kvar</span><strong>${data.subscription.trialDaysLeft} dagar</strong></div>` : ''}
      ${data.subscription?.revenueSek > 0 ? `<div class="row"><span>Intäkt / mån</span><strong>${formatSek(data.subscription.revenueSek)}</strong></div>` : ''}
      <div class="section-title">Kostnad &amp; gränser</div>
      <div class="row"><span>Uppskattad kostnad / månad</span><strong>${data.costMonth} / ${data.budget} kr</strong></div>
      <div class="row"><span>Idag (chatt / gemini / tts)</span><strong>${u.assistant_message?.today ?? 0} / ${u.gemini_request?.today ?? 0} / ${u.tts_request?.today ?? 0}</strong></div>
      <div class="section-title">Senaste händelser</div>
      ${(data.recentEvents ?? [])
        .slice(0, 10)
        .map(
          (e) =>
            `<div class="row"><span>${e.type}</span><span class="muted">${formatDate(e.ts)}</span></div>`,
        )
        .join('') || '<p class="muted">Inga händelser</p>'}
      <div class="section-title">Administration</div>
      <div class="device-admin-row">
        <label class="toggle-row">
          <input type="checkbox" id="device-free-forever-toggle" ${isFreeForever ? 'checked' : ''} />
          Gratis abonnemang (ingen 199 kr)
        </label>
        <p class="muted small">35 kr/mån API-gräns gäller fortfarande för alla.</p>
        <input type="text" id="device-free-forever-note" placeholder="Anteckning (valfritt)" value="${d.free_forever_note ? String(d.free_forever_note).replace(/"/g, '&quot;') : ''}" />
        <button type="button" class="btn-secondary" id="device-free-forever-save">Spara gratis-status</button>
      </div>
      <div class="device-admin-actions">
        ${
          isBlocked
            ? `<button type="button" class="btn-secondary" id="device-unblock-btn">Ta bort spärr</button>`
            : `<button type="button" class="btn-warn" id="device-block-btn">Spärra enhet</button>`
        }
        <button type="button" class="btn-danger" id="device-delete-btn">Ta bort enhet</button>
      </div>
      <p class="muted device-admin-hint">Spärra stoppar assistenten direkt. Ta bort raderar all statistik (kan inte ångras).</p>`;
    document.getElementById('device-free-forever-save')?.addEventListener('click', () => {
      const enabled = Boolean(document.getElementById('device-free-forever-toggle')?.checked);
      const note = document.getElementById('device-free-forever-note')?.value ?? '';
      void setFreeForeverAction(deviceId, enabled, note);
    });
    document.getElementById('device-block-btn')?.addEventListener('click', () => {
      const reason = window.prompt('Anledning till spärr (valfritt):', 'Missbruk');
      if (reason === null) return;
      void blockDeviceAction(deviceId, reason);
    });
    document.getElementById('device-unblock-btn')?.addEventListener('click', () => {
      void unblockDeviceAction(deviceId);
    });
    document.getElementById('device-delete-btn')?.addEventListener('click', () => {
      if (
        !window.confirm(
          'Ta bort denna enhet och all statistik permanent? Assistenten kan ansluta igen som ny enhet.',
        )
      ) {
        return;
      }
      void deleteDeviceAction(deviceId);
    });
  } catch (err) {
    body.innerHTML = `<p class="error">${err.message ?? 'Kunde inte ladda enhet'}</p>`;
  }
}

async function setFreeForeverAction(deviceId, enabled, note) {
  await api(`/api/admin/devices/${encodeURIComponent(deviceId)}/free-forever`, {
    method: 'POST',
    body: JSON.stringify({ enabled, note }),
  });
  await openDeviceModal(deviceId);
  await loadFinance();
}

async function blockDeviceAction(deviceId, reason) {
  await api(`/api/admin/devices/${encodeURIComponent(deviceId)}/block`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  await openDeviceModal(deviceId);
  await loadFinance();
}

async function unblockDeviceAction(deviceId) {
  await api(`/api/admin/devices/${encodeURIComponent(deviceId)}/unblock`, { method: 'POST' });
  await openDeviceModal(deviceId);
  await loadFinance();
}

async function deleteDeviceAction(deviceId) {
  await api(`/api/admin/devices/${encodeURIComponent(deviceId)}`, { method: 'DELETE' });
  closeDeviceModal();
  await loadFinance();
  await loadOverview();
}

function closeDeviceModal() {
  const modal = document.getElementById('device-modal');
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

function bindDeviceClicks() {
  document.querySelectorAll('[data-device-id]').forEach((row) => {
    row.addEventListener('click', () => openDeviceModal(row.dataset.deviceId));
  });
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
  renderGrowthCharts(data.charts.growth);

  document.getElementById('version-list').innerHTML = (data.versions ?? [])
    .map((r) => `<div class="row"><span>v${r.version}</span><strong>${r.count}</strong></div>`)
    .join('') || '<p class="muted">Ingen data</p>';

  document.getElementById('platform-list').innerHTML = (data.platforms ?? [])
    .map((r) => `<div class="row"><span>${r.platform}</span><strong>${r.count}</strong></div>`)
    .join('') || '<p class="muted">Ingen data</p>';

  const limits = data.limits ?? {};
  const form = document.getElementById('limits-form');
  if (form) {
    form.chatsPerDay.value = limits.chatsPerDay ?? 15;
    form.geminiPerDay.value = limits.geminiPerDay ?? 15;
    form.ttsPerDay.value = limits.ttsPerDay ?? 20;
    form.chatsPerMonth.value = limits.chatsPerMonth ?? 400;
    form.geminiPerMonth.value = limits.geminiPerMonth ?? 400;
    form.ttsPerMonth.value = limits.ttsPerMonth ?? 500;
    form.monthlyBudgetSek.value = limits.monthlyBudgetSek ?? 35;
    form.targetPriceSek.value = limits.targetPriceSek ?? 199;
  }
  const margin =
    limits.targetPriceSek && limits.monthlyBudgetSek
      ? Math.round((1 - limits.monthlyBudgetSek / limits.targetPriceSek) * 100)
      : 82;
  document.getElementById('limits-summary').innerHTML = `
    <div class="row"><span>Chattar / dag</span><strong>${limits.chatsPerDay ?? 15}</strong></div>
    <div class="row"><span>Gemini / dag</span><strong>${limits.geminiPerDay ?? 15}</strong></div>
    <div class="row"><span>Röst / dag</span><strong>${limits.ttsPerDay ?? 20}</strong></div>
    <div class="row"><span>Chattar / månad</span><strong>${limits.chatsPerMonth ?? 400}</strong></div>
    <div class="row"><span>Max kostnad / månad</span><strong>${limits.monthlyBudgetSek ?? 35} kr</strong></div>
    <div class="row"><span>Ditt pris</span><strong>${limits.targetPriceSek ?? 199} kr</strong></div>
    <div class="row"><span>Uppskattad marginal</span><strong>${margin}%</strong></div>`;

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

  document.getElementById('top-devices').innerHTML = `<table>
    <thead><tr><th>Enhet</th><th>Land</th><th>Plattform</th><th>Chattar</th><th>Gemini</th><th>TTS</th><th>Senast</th></tr></thead>
    <tbody>${(data.topDevices ?? [])
      .map(
        (d) => `<tr class="clickable" data-device-id="${d.device_id}">
          <td>${d.device_id.slice(0, 8)}…</td>
          <td>${d.country ?? '—'}</td>
          <td>${d.platform ?? '—'}</td>
          <td>${d.chats_month ?? 0}</td>
          <td>${d.gemini_month ?? 0}</td>
          <td>${d.tts_month ?? 0}</td>
          <td>${formatDate(d.last_seen)}</td>
        </tr>`,
      )
      .join('')}</tbody></table>` || '<p class="muted">Ingen data ännu</p>';

  document.getElementById('device-list').innerHTML = `<table>
    <thead><tr><th>Enhet</th><th>Land</th><th>Version</th><th>Öppningar</th><th>Senast aktiv</th></tr></thead>
    <tbody>${(data.recentDevices ?? [])
      .map(
        (d) => `<tr class="clickable" data-device-id="${d.device_id}">
          <td>${d.device_id.slice(0, 8)}…</td>
          <td>${d.country ?? '—'}</td>
          <td>${d.app_version ?? '—'}</td>
          <td>${d.opens}</td>
          <td>${formatDate(d.last_seen)}</td>
        </tr>`,
      )
      .join('')}</tbody></table>`;

  bindDeviceClicks();

  const est = data.expenses?.estimated ?? {};
  document.getElementById('cost-estimate').innerHTML = `
    <div class="row"><span>Gemini (7d)</span><strong>${formatSek(est.geminiWeekSek ?? 0)}</strong></div>
    <div class="row"><span>TTS Alma (7d)</span><strong>${formatSek(est.ttsWeekSek ?? 0)}</strong></div>
    <div class="row"><span>Per Gemini-anrop</span><strong>${est.geminiPerRequestSek ?? 0.06} kr</strong></div>
    <div class="row"><span>Per TTS-anrop</span><strong>${est.ttsPerRequestSek ?? 0.002} kr</strong></div>
    <p class="muted">${est.note ?? ''}</p>`;

  const ca = data.costAssumptions ?? {};
  document.getElementById('cost-assumptions').innerHTML = `
    <div class="row"><span>Gemini / anrop</span><strong>${ca.geminiPerRequestSek ?? 0.06} kr</strong></div>
    <div class="row"><span>Alma TTS / anrop</span><strong>${ca.ttsPerRequestSek ?? 0.002} kr</strong></div>
    <div class="row"><span>Budget / enhet / mån</span><strong>${ca.monthlyBudgetPerDeviceSek ?? 35} kr</strong></div>
    <div class="row"><span>Abonnemang (mål)</span><strong>${ca.targetPriceSek ?? 199} kr</strong></div>
    <p class="muted">${ca.hetznerNote ?? ''}</p>`;
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
  const [overview, finance, growth] = await Promise.all([
    api('/api/admin/overview'),
    api('/api/admin/finance'),
    api('/api/admin/growth'),
  ]);
  renderOverview(overview);
  renderFinance(finance);
  renderGrowthCharts(growth.months ?? growth);
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

document.getElementById('limits-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  await api('/api/admin/limits', {
    method: 'PUT',
    body: JSON.stringify({
      chatsPerDay: Number(fd.get('chatsPerDay')),
      geminiPerDay: Number(fd.get('geminiPerDay')),
      ttsPerDay: Number(fd.get('ttsPerDay')),
      chatsPerMonth: Number(fd.get('chatsPerMonth')),
      geminiPerMonth: Number(fd.get('geminiPerMonth')),
      ttsPerMonth: Number(fd.get('ttsPerMonth')),
      monthlyBudgetSek: Number(fd.get('monthlyBudgetSek')),
      targetPriceSek: Number(fd.get('targetPriceSek')),
    }),
  });
  await refresh();
});

if (token()) {
  showApp();
  refresh().catch(showLogin);
} else {
  showLogin();
}

document.getElementById('device-modal-close')?.addEventListener('click', closeDeviceModal);
document.getElementById('device-modal-backdrop')?.addEventListener('click', closeDeviceModal);

setInterval(() => {
  if (token()) refresh().catch(() => {});
}, 60_000);
