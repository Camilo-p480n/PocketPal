const API = '';
let txCache = [];
let chartInstances = {};
let currentFilter = 'all';
let sidebarOpen = true;

// ── UTILS ────────────────────────────────────────────────
const fmt = n => '$' + Math.abs(Number(n)).toLocaleString('es-CO');

// ── SIDEBAR ──────────────────────────────────────────────
function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    sidebarOpen = !sidebarOpen;
    if (sidebarOpen) {
        sb.classList.remove('collapsed');
        sb.style.width = '240px';
        document.getElementById('sidebar-header-open').classList.remove('hidden');
        document.getElementById('sidebar-header-closed').classList.add('hidden');
    } else {
        sb.classList.add('collapsed');
        sb.style.width = '64px';
        document.getElementById('sidebar-header-open').classList.add('hidden');
        document.getElementById('sidebar-header-closed').classList.remove('hidden');
    }
}

// ── TABS ─────────────────────────────────────────────────
function switchTab(t) {
    ['chat', 'charts', 'table'].forEach(id => {
        document.getElementById('tab-' + id).classList.remove('active');
        document.getElementById('tab-btn-' + id).classList.remove('active');
    });
    document.getElementById('tab-' + t).classList.add('active');
    document.getElementById('tab-btn-' + t).classList.add('active');
    if (t === 'charts') loadCharts();
    if (t === 'table') loadTable();
}

// ── CHAT ─────────────────────────────────────────────────
function useHint(el) { document.getElementById('userInput').value = el.textContent; sendMsg(); }

async function sendMsg() {
    const inp = document.getElementById('userInput');
    const msg = inp.value.trim();
    if (!msg) return;
    inp.value = '';

    addMsg('user', msg, null, null);
    setBusy(true);
    showTyping();

    try {
        const res = await fetch(API + '/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: msg })
        });
        const data = await res.json();
        removeTyping();
        setBusy(false);

        if (!data.ok) { addMsg('bot', '❌ Error del servidor: ' + data.error, null, null); return; }

        const tagMap = { gasto: 'exp', ingreso: 'inc', crear_meta: 'goal', aporte_meta: 'goal', eliminar_meta: 'goal' };
        const goalsOnlyIntents = ['crear_meta', 'aporte_meta', 'eliminar_meta'];
        const isGoalsConsulta = data.intent === 'consulta' && data.metrics && data.metrics.metas && data.metrics.metas.length > 0 &&
            /meta|ahorro|objetivo|goals/i.test(msg);
        const goalsOnly = goalsOnlyIntents.includes(data.intent) || isGoalsConsulta;
        addMsg('bot', data.reply, tagMap[data.intent] || null, data.metrics, goalsOnly);

        if (data.metrics) updateSidebar(data.metrics);
        if (data.record) txCache = [];

    } catch (e) {
        removeTyping();
        setBusy(false);
        addMsg('bot', '❌ No se pudo conectar al servidor. ¿Está corriendo Express?', null, null);
    }
}

function addMsg(role, text, tagType, metrics, goalsOnly = false) {
    const box = document.getElementById('messages');
    const wrap = document.createElement('div');
    wrap.className = 'flex items-start gap-3 page-section' + (role === 'user' ? ' flex-row-reverse' : '');

    const tagLabels = { inc: '✅ Ingreso', exp: '💸 Gasto', goal: '🎯 Meta' };
    const tagClass = { inc: 'tag-inc', exp: 'tag-exp', goal: 'tag-goal' };

    let metricsHtml = '';
    if (metrics) {
        if (goalsOnly) {
            // Mostrar SOLO metas: ahorrado vs objetivo con barra de progreso
            const goalsHtml = metrics.metas && metrics.metas.length
                ? metrics.metas.map(g => {
                    const pct = Math.min(g.porcentaje, 100);
                    const resto = Math.max(0, g.target_amount - g.current_amount);
                    return `
      <div class="flex flex-col gap-1 mt-3">
        <div class="flex justify-between text-[11px]">
          <span class="text-[#c4b5fd] font-semibold">🎯 ${g.title}</span>
          <span class="text-[#6b7280]">${pct}% ${g.completada ? '✅' : ''}</span>
        </div>
        <div style="height:8px; border-radius:4px; background:rgba(255,255,255,0.07); overflow:hidden">
          <div style="width:${pct}%; height:100%; border-radius:4px; background:linear-gradient(90deg,#7c3aed,#a855f7)"></div>
        </div>
        <div class="flex justify-between text-[10px] text-[#6b7280] mt-0.5">
          <span>Ahorrado: <strong style="color:#a855f7">${fmt(g.current_amount)}</strong></span>
          <span>Meta: <strong style="color:#e5e7eb">${fmt(g.target_amount)}</strong></span>
        </div>
        ${!g.completada ? `<div class="text-[10px]" style="color:#f59e0b">Faltan: ${fmt(resto)}</div>` : ''}
      </div>`;
                }).join('')
                : '<div class="text-[11px] text-[#6b7280] mt-2">Sin metas activas.</div>';

            metricsHtml = `
      <div class="metrics-box">
        <p class="text-[10px] font-semibold uppercase tracking-[.6px] text-[#6b7280] mb-1">🎯 Metas de ahorro</p>
        ${goalsHtml}
      </div>`;
        } else {
            // Métricas normales: ingresos/gastos/categorías
            const maxG = Math.max(...(metrics.gastos_por_categoria.map(c => c.total)), 1);
            const cats = metrics.gastos_por_categoria.slice(0, 5).map(c => `
      <div class="flex items-center gap-2 mt-1.5">
        <span class="text-[11px] text-[#6b7280] w-[90px] truncate shrink-0">${c.category}</span>
        <div class="cat-track"><div class="cat-fill" style="width:${Math.round(c.total / maxG * 100)}%"></div></div>
        <span class="text-[10px] text-[#6b7280] w-[60px] text-right shrink-0">${fmt(c.total)}</span>
      </div>`).join('');

            metricsHtml = `
      <div class="metrics-box">
        <p class="text-[10px] font-semibold uppercase tracking-[.6px] text-[#6b7280] mb-3">📊 Métricas del mes</p>
        <div class="flex flex-wrap gap-2 mb-2">
          <div class="m-chip" style="color:#10b981">↑ ${fmt(metrics.total_ingresos)}</div>
          <div class="m-chip" style="color:#ef4444">↓ ${fmt(metrics.total_gastos)}</div>
          <div class="m-chip" style="color:#a855f7">= ${fmt(metrics.balance)}</div>
        </div>
        ${cats}
      </div>`;
        }
    }

    const avatarBot = `<div class="w-7 h-7 rounded-full bg-[rgba(139,0,255,.18)] border border-[rgba(139,0,255,.35)] flex items-center justify-center text-[12px] flex-shrink-0 mt-0.5" style="box-shadow:0 0 12px rgba(139,0,255,.25)">✦</div>`;
    const avatarUser = `<div class="w-7 h-7 rounded-full bg-[rgba(255,255,255,.06)] border border-white/[.1] flex items-center justify-center text-[12px] flex-shrink-0 mt-0.5">👤</div>`;

    wrap.innerHTML = `
    ${role === 'user' ? avatarUser : avatarBot}
    <div class="${role === 'user' ? 'bubble-user' : 'bubble-bot'}">
      ${tagType ? `<div class="intent-tag ${tagClass[tagType]}">${tagLabels[tagType]}</div>` : ''}
      ${text}
      ${metricsHtml}
    </div>`;

    box.appendChild(wrap);
    box.scrollTop = box.scrollHeight;
}

let typingEl = null;
function showTyping() {
    const box = document.getElementById('messages');
    typingEl = document.createElement('div');
    typingEl.className = 'flex items-start gap-3';
    typingEl.innerHTML = `
    <div class="w-7 h-7 rounded-full bg-[rgba(139,0,255,.18)] border border-[rgba(139,0,255,.35)] flex items-center justify-center text-[12px] flex-shrink-0 mt-0.5" style="box-shadow:0 0 12px rgba(139,0,255,.25)">✦</div>
    <div class="bubble-bot flex items-center gap-1.5 py-2">
      <div class="dot"></div><div class="dot"></div><div class="dot"></div>
    </div>`;
    box.appendChild(typingEl);
    box.scrollTop = box.scrollHeight;
}
function removeTyping() { if (typingEl) { typingEl.remove(); typingEl = null; } }

function setBusy(b) {
    const btn = document.getElementById('sendBtn');
    const inp = document.getElementById('userInput');
    btn.disabled = b; inp.disabled = b;
    btn.innerHTML = b
        ? `<div class="spinner"></div>`
        : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
}

// ── SIDEBAR STATS ────────────────────────────────────────
function updateSidebar(m) {
    document.getElementById('sInc').textContent = fmt(m.total_ingresos);
    document.getElementById('sExp').textContent = fmt(m.total_gastos);
    document.getElementById('sBal').textContent = fmt(m.balance);

    const gl = document.getElementById('goalsList');
    if (!m.metas || !m.metas.length) {
        gl.innerHTML = '<div class="text-[12px] text-[#555e78] px-1">Sin metas aún</div>';
        return;
    }
    gl.innerHTML = m.metas.map(g => `
    <div class="bg-bg3 rounded-xl p-3 border border-white/[.04]">
      <div class="flex items-center justify-between mb-2">
        <span class="text-[12px] font-semibold truncate pr-2">${g.title}</span>
        <span class="text-[11px] text-[#a855f7] font-semibold flex-shrink-0">${g.porcentaje}%</span>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, g.porcentaje)}%"></div></div>
      <div class="flex justify-between mt-1.5">
        <span class="text-[10px] text-[#a855f7]">${fmt(g.current_amount)}</span>
        <span class="text-[10px] text-[#555e78]">/ ${fmt(g.target_amount)}</span>
      </div>
    </div>`).join('');
}

async function initSidebar() {
    try {
        const r = await fetch(API + '/api/transactions/metrics');
        const d = await r.json();
        if (d.ok) updateSidebar(d.data);
    } catch (e) { }
}

// ── CHARTS ───────────────────────────────────────────────
async function loadCharts() {
    const outer = document.getElementById('chartOuter');
    let metrics;
    try {
        const r = await fetch(API + '/api/transactions/metrics');
        const d = await r.json();
        if (!d.ok) throw new Error(d.error);
        metrics = d.data;
    } catch (e) {
        outer.innerHTML = `<div class="flex flex-col items-center justify-center h-[300px] gap-3 text-[#555e78]"><div class="text-5xl opacity-20">⚠️</div><p class="text-[13px]">${e.message}</p></div>`;
        return;
    }

    if (!metrics.total_ingresos && !metrics.total_gastos) {
        outer.innerHTML = `<div class="flex flex-col items-center justify-center h-[300px] gap-3 text-[#555e78]"><div class="text-5xl opacity-20">◑</div><p class="text-[13px]">Registra movimientos para ver tus gráficas</p></div>`;
        return;
    }

    Object.values(chartInstances).forEach(c => { try { c.destroy(); } catch (e) { } });
    chartInstances = {};

    outer.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 page-section">
      <div class="bg-bg2 border border-white/[.05] rounded-2xl p-5">
        <p class="font-semibold text-[14px]">Gastos por categoría</p>
        <p class="text-[12px] text-[#6b7280] mt-0.5 mb-4">Distribución</p>
        <div class="relative h-[200px]"><canvas id="cPie"></canvas></div>
      </div>
      <div class="bg-bg2 border border-white/[.05] rounded-2xl p-5">
        <p class="font-semibold text-[14px]">Ingresos vs. Gastos</p>
        <p class="text-[12px] text-[#6b7280] mt-0.5 mb-4">Este mes</p>
        <div class="relative h-[200px]"><canvas id="cBar"></canvas></div>
      </div>
    </div>
    <div class="bg-bg2 border border-white/[.05] rounded-2xl p-5 page-section">
      <p class="font-semibold text-[14px]">Balance acumulado</p>
      <p class="text-[12px] text-[#6b7280] mt-0.5 mb-4">Evolución por movimiento</p>
      <div class="relative h-[160px]"><canvas id="cLine"></canvas></div>
    </div>`;

    const colors = ['#ef4444', '#f59e0b', '#10b981', '#8b00ff', '#3b82f6', '#ec4899', '#06b6d4', '#84cc16'];
    const cats = metrics.gastos_por_categoria;
    const chartOpts = { responsive: true, maintainAspectRatio: false };

    chartInstances.pie = new Chart(document.getElementById('cPie'), {
        type: 'doughnut',
        data: { labels: cats.map(c => c.category), datasets: [{ data: cats.map(c => c.total), backgroundColor: colors, borderWidth: 0, hoverOffset: 6 }] },
        options: { ...chartOpts, cutout: '65%', plugins: { legend: { position: 'right', labels: { color: '#6b7280', font: { family: 'Sora', size: 11 }, boxWidth: 10 } } } }
    });

    chartInstances.bar = new Chart(document.getElementById('cBar'), {
        type: 'bar',
        data: {
            labels: ['Ingresos', 'Gastos'], datasets: [{
                data: [metrics.total_ingresos, metrics.total_gastos],
                backgroundColor: ['rgba(16,185,129,.6)', 'rgba(239,68,68,.6)'],
                borderColor: ['#10b981', '#ef4444'], borderWidth: 2, borderRadius: 8
            }]
        },
        options: {
            ...chartOpts, plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#6b7280', font: { family: 'Sora', size: 10 } } },
                x: { grid: { display: false }, ticks: { color: '#6b7280', font: { family: 'Sora', size: 12 } } }
            }
        }
    });

    try {
        const r2 = await fetch(API + '/api/transactions');
        const d2 = await r2.json();
        if (d2.ok && d2.data.length) {
            const sorted = [...d2.data].reverse();
            let running = 0;
            const lineData = sorted.map(t => { running += t.type === 'income' ? t.amount : -t.amount; return running; });
            const ptColors = sorted.map(t => t.type === 'income' ? '#10b981' : '#ef4444');

            chartInstances.line = new Chart(document.getElementById('cLine'), {
                type: 'line',
                data: {
                    labels: sorted.map((_, i) => `#${i + 1}`),
                    datasets: [{
                        label: 'Balance', data: lineData, borderColor: '#8b00ff',
                        backgroundColor: 'rgba(139,0,255,.08)', pointBackgroundColor: ptColors,
                        pointRadius: 4, tension: .4, fill: true
                    }]
                },
                options: {
                    ...chartOpts, plugins: { legend: { display: false } },
                    scales: {
                        y: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#6b7280', font: { family: 'Sora', size: 10 } } },
                        x: { grid: { display: false }, ticks: { color: '#6b7280', font: { family: 'Sora', size: 10 }, maxTicksLimit: 10, maxRotation: 0 } }
                    }
                }
            });
        }
    } catch (e) { }
}

// ── TABLE ────────────────────────────────────────────────
async function loadTable() {
    if (!txCache.length) {
        try {
            const r = await fetch(API + '/api/transactions');
            const d = await r.json();
            if (d.ok) txCache = d.data;
        } catch (e) { }
    }
    renderTable(currentFilter);
}

function filterTbl(f, btn) {
    currentFilter = f;
    document.querySelectorAll('.fb').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderTable(f);
}

function renderTable(f) {
    const wrap = document.getElementById('tableWrap');
    const rows = f === 'all' ? txCache : txCache.filter(t => t.type === f);
    if (!rows.length) {
        wrap.innerHTML = `<div class="flex flex-col items-center justify-center h-[200px] gap-3 text-[#555e78]"><div class="text-4xl opacity-20">⇅</div><p class="text-[13px]">Sin registros</p></div>`;
        return;
    }
    const isIncome = t => t.type === 'income';
    wrap.innerHTML = `<table>
    <thead><tr><th>#</th><th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Descripción</th><th>Monto</th></tr></thead>
    <tbody>${rows.map((t, i) => `
      <tr>
        <td class="text-[#555e78] text-[11px]">${i + 1}</td>
        <td class="text-[12px] text-[#6b7280]">${t.date ? t.date.slice(0, 10) : '—'}</td>
        <td>
          <span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full
            ${isIncome(t) ? 'bg-[rgba(16,185,129,.12)] text-[#10b981]' : 'bg-[rgba(239,68,68,.12)] text-[#ef4444]'}">
            ${isIncome(t) ? '↑ Ingreso' : '↓ Gasto'}
          </span>
        </td>
        <td>${t.category_name || t.category || '—'}</td>
        <td class="text-[12px] text-[#6b7280]">${t.description || '—'}</td>
        <td class="font-semibold ${isIncome(t) ? 'text-[#10b981]' : 'text-[#ef4444]'}">
          ${isIncome(t) ? '+' : '-'}${fmt(t.amount)}
        </td>
      </tr>`).join('')}
    </tbody></table>`;
}

// ── INIT ─────────────────────────────────────────────────
initSidebar();