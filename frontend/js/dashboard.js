// public/js/dashboard.js
// Lógica principal del dashboard: carga datos, renderiza charts, gestiona modales

// ─── State ────────────────────────────────────────────────────────────────────
let allCategories = [];
let allTransactions = [];
let allGoals = [];
let summaryData = null;
let charts = {};

// Capturar token que viene en la URL (?token=xxx)
const params = new URLSearchParams(window.location.search);
const token = params.get('token');
const name = params.get('name');
const email = params.get('email');
const avatar = params.get('avatar');

if (token) {
    localStorage.setItem('token', token);

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify({ name, email, avatar }));

    // Limpiar el token de la URL por seguridad
    window.history.replaceState({}, document.title, '/frontend/dashboard.html');
}

// Si no hay token en ningún lado, redirigir al login
if (!localStorage.getItem('token')) {
    window.location.href = '/frontend/index.html';
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth()) return;

    // Mostrar nombre del usuario
    const user = getUser();
    if (user) {
        document.getElementById('user-name').textContent = user.name;
        document.getElementById('user-email').textContent = user.email;
        if (user.avatar) { // ← user.avatar, no avatar
            document.getElementById('user-avatar').innerHTML = `<img src="${user.avatar}" alt="foto">`;
        } else {
            document.getElementById('user-avatar').textContent = user.name.charAt(0).toUpperCase();
        }
        document.querySelectorAll('.greeting-name').forEach(el => el.textContent = user.name.split(' ')[0]);
    }

    // Cargar todo en paralelo
    await loadAllData();
});

async function loadAllData() {
    try {
        const [catsRes, txRes, goalsRes, sumRes] = await Promise.all([
            categories.list(),
            transactions.list({ limit: 50 }),
            goals.list(),
            summary.get(),
        ]);

        allCategories = catsRes.data.categories;
        allTransactions = txRes.data.transactions;
        allGoals = goalsRes.data.goals;
        summaryData = sumRes.data;

        renderStats();
        renderCharts();
        renderTransactionsTable();
        renderGoals();
        populateCategorySelects();
    } catch (err) {
        toast.error('Error cargando datos: ' + err.message);
    }
}

// ─── Stats cards ──────────────────────────────────────────────────────────────
function renderStats() {
    const t = summaryData.totals;
    document.getElementById('stat-income').textContent = fmt.currency(t.total_income);
    document.getElementById('stat-expense').textContent = fmt.currency(t.total_expenses);
    document.getElementById('stat-balance').textContent = fmt.currency(t.net_balance);

    const activeGoals = allGoals.filter(g => !g.is_completed).length;
    document.getElementById('stat-goals').textContent = `${activeGoals} activa${activeGoals !== 1 ? 's' : ''}`;

    // Color balance
    const balEl = document.getElementById('stat-balance');
    balEl.style.color = parseFloat(t.net_balance) >= 0 ? 'var(--green)' : 'var(--red)';
}

// ─── Charts ───────────────────────────────────────────────────────────────────
function renderCharts() {
    renderMonthlyChart();
    renderCategoryDoughnut();
    renderBalanceLine();
}

function renderMonthlyChart() {
    const ctx = document.getElementById('chart-monthly');
    if (!ctx) return;

    if (charts.monthly) charts.monthly.destroy();

    const data = summaryData.monthlyTrend || [];
    const labels = data.map(d => d.month);
    const income = data.map(d => parseFloat(d.income || 0));
    const expense = data.map(d => parseFloat(d.expenses || 0));

    charts.monthly = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Ingresos',
                    data: income,
                    backgroundColor: 'rgba(0,229,160,0.7)',
                    borderColor: 'rgba(0,229,160,1)',
                    borderWidth: 1,
                    borderRadius: 6,
                },
                {
                    label: 'Gastos',
                    data: expense,
                    backgroundColor: 'rgba(255,77,109,0.7)',
                    borderColor: 'rgba(255,77,109,1)',
                    borderWidth: 1,
                    borderRadius: 6,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#8b92a8', font: { family: 'DM Sans' } } },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.dataset.label}: ${fmt.currency(ctx.parsed.y)}`,
                    },
                },
            },
            scales: {
                x: { ticks: { color: '#555e78' }, grid: { color: 'rgba(255,255,255,0.04)' } },
                y: {
                    ticks: { color: '#555e78', callback: v => fmt.currency(v) },
                    grid: { color: 'rgba(255,255,255,0.04)' },
                },
            },
        },
    });
}

function renderCategoryDoughnut() {
    const ctx = document.getElementById('chart-categories');
    if (!ctx) return;

    if (charts.categories) charts.categories.destroy();

    // Solo gastos por categoría
    const expenses = (summaryData.categoryBreakdown || []).filter(c => c.type === 'expense');
    if (expenses.length === 0) return;

    const COLORS = ['#ff4d6d', '#ff8c42', '#f5c542', '#a78bfa', '#4d9fff', '#00e5a0', '#ff6b9d', '#c77dff'];

    charts.categories = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: expenses.map(c => c.category_name),
            datasets: [{
                data: expenses.map(c => parseFloat(c.total)),
                backgroundColor: COLORS.slice(0, expenses.length),
                borderColor: '#1e2230',
                borderWidth: 3,
                hoverOffset: 8,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '68%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#8b92a8', font: { family: 'DM Sans' }, padding: 12, boxWidth: 12 },
                },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.label}: ${fmt.currency(ctx.parsed)}`,
                    },
                },
            },
        },
    });
}

function renderBalanceLine() {
    const ctx = document.getElementById('chart-balance');
    if (!ctx) return;

    if (charts.balance) charts.balance.destroy();

    const data = summaryData.monthlyTrend || [];
    let running = 0;
    const balances = data.map(d => {
        running += parseFloat(d.income || 0) - parseFloat(d.expenses || 0);
        return running;
    });

    charts.balance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d.month),
            datasets: [{
                label: 'Balance acumulado',
                data: balances,
                borderColor: '#4d9fff',
                backgroundColor: 'rgba(77,159,255,0.08)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#4d9fff',
                pointRadius: 4,
                pointHoverRadius: 6,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: { label: ctx => ` Balance: ${fmt.currency(ctx.parsed.y)}` },
                },
            },
            scales: {
                x: { ticks: { color: '#555e78' }, grid: { color: 'rgba(255,255,255,0.04)' } },
                y: {
                    ticks: { color: '#555e78', callback: v => fmt.currency(v) },
                    grid: { color: 'rgba(255,255,255,0.04)' },
                },
            },
        },
    });
}

// ─── Transactions table ────────────────────────────────────────────────────────
function renderTransactionsTable(txList) {
    const tbody = document.getElementById('tx-tbody');
    const list = txList || allTransactions;

    if (list.length === 0) {
        tbody.innerHTML = `
      <tr><td colspan="6">
        <div class="empty-state">
          <div class="empty-state-icon">💸</div>
          <div class="empty-state-text">No hay transacciones. ¡Registra la primera!</div>
        </div>
      </td></tr>`;
        return;
    }

    tbody.innerHTML = list.slice(0, 30).map(tx => `
    <tr>
      <td>${fmt.date(tx.date)}</td>
      <td>
        <span class="badge badge-${tx.type}">
            ${tx.type === 'income' ? '↑ Ingreso' : tx.type === 'saving' ? '→ Ahorro' : '↓ Gasto'}
        </span>
      </td>
      <td>
        <span class="badge-${tx.type}">
            ${tx.type === 'income' ? '↑ Ingreso' : tx.type === 'saving' ? '→ Ahorro' : '↓ Gasto'}
        </span>
      </td>
      <td>${tx.category_name || '—'}</td>
      <td class="text-dim">${fmt.truncate(tx.description || '—', 28)}</td>
      <td>
        <button class="btn btn-ghost btn-icon btn-sm" onclick="deleteTransaction(${tx.id})" title="Eliminar">✕</button>
      </td>
    </tr>
  `).join('');
}

// ─── Goals ────────────────────────────────────────────────────────────────────
function renderGoals() {
    const container = document.getElementById('goals-list');
    if (!container) return;

    const active = allGoals.filter(g => !g.is_completed);

    if (active.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🎯</div><div class="empty-state-text">No hay metas activas</div></div>`;
        return;
    }

    container.innerHTML = active.map(g => {
        const pct = Math.min(Math.round((g.current_amount / g.target_amount) * 100), 100);
        return `
      <div class="goal-card">
        <div class="goal-title">${g.title}</div>
        <div class="goal-amounts">
          <span>${fmt.currency(g.current_amount)} ahorrado</span>
          <span class="goal-pct">${pct}%</span>
        </div>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" style="width:${pct}%"></div>
        </div>
        <div class="goal-amounts" style="margin-top:6px">
          <span>Meta: ${fmt.currency(g.target_amount)}</span>
          <button class="btn btn-ghost btn-sm" onclick="openAllocateModal(${g.id}, '${g.title}')">+ Abonar</button>
        </div>
      </div>`;
    }).join('');
}

// ─── Category selects ──────────────────────────────────────────────────────────
function populateCategorySelects() {
    ['tx-category', 'filter-category'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const current = el.value;
        el.innerHTML = id === 'filter-category'
            ? '<option value="">Todas las categorías</option>'
            : '<option value="">Selecciona categoría</option>';
        allCategories.forEach(c => {
            el.innerHTML += `<option value="${c.id}" data-type="${c.type}">${c.name} (${c.type === 'income' ? 'Ingreso' : 'Gasto'})</option>`;
        });
        if (current) el.value = current;
    });
}

// ─── Transaction type toggle sync ─────────────────────────────────────────────
function setTxType(type) {
    document.getElementById('tx-type').value = type;
    document.getElementById('type-income').classList.toggle('active', type === 'income');
    document.getElementById('type-expense').classList.toggle('active', type === 'expense');
    // Filter category select to match type
    const sel = document.getElementById('tx-category');
    Array.from(sel.options).forEach(opt => {
        if (opt.dataset.type) opt.hidden = opt.dataset.type !== type;
    });
}

// ─── Modals ───────────────────────────────────────────────────────────────────
function openModal(id) {
    document.getElementById(id).classList.add('open');
}
function closeModal(id) {
    document.getElementById(id).classList.remove('open');
}

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.classList.remove('open');
    });
});

// ─── Create transaction ────────────────────────────────────────────────────────
async function handleCreateTransaction(e) {
    e.preventDefault();
    const btn = document.getElementById('create-tx-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    try {
        await transactions.create({
            type: document.getElementById('tx-type').value,
            amount: document.getElementById('tx-amount').value,
            category_id: document.getElementById('tx-category').value,
            description: document.getElementById('tx-description').value,
            date: document.getElementById('tx-date').value || undefined,
        });
        toast.success('Transacción registrada ✓');
        closeModal('modal-tx');
        document.getElementById('form-tx').reset();
        await loadAllData();
    } catch (err) {
        toast.error(err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar';
    }
}

// ─── Delete transaction ────────────────────────────────────────────────────────
async function deleteTransaction(id) {
    if (!confirm('¿Eliminar esta transacción?')) return;
    try {
        await transactions.delete(id);
        toast.success('Transacción eliminada');
        await loadAllData();
    } catch (err) {
        toast.error(err.message);
    }
}

// ─── Create goal ───────────────────────────────────────────────────────────────
async function handleCreateGoal(e) {
    e.preventDefault();
    const btn = document.getElementById('create-goal-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    try {
        await goals.create({
            title: document.getElementById('goal-title').value,
            target_amount: document.getElementById('goal-amount').value,
        });
        toast.success('Meta creada ✓');
        closeModal('modal-goal');
        document.getElementById('form-goal').reset();
        await loadAllData();
    } catch (err) {
        toast.error(err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Crear meta';
    }
}

// ─── Allocate to goal ──────────────────────────────────────────────────────────
let currentAllocateGoalId = null;

function openAllocateModal(goalId, goalTitle) {
    currentAllocateGoalId = goalId;
    document.getElementById('allocate-goal-name').textContent = goalTitle;
    openModal('modal-allocate');
}

async function handleAllocate(e) {
    e.preventDefault();
    const btn = document.getElementById('allocate-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    try {
        const amount = document.getElementById('allocate-amount').value;

        // ✅ Usar el nuevo endpoint que registra en goal_allocations + transactions
        const data = await apiFetch(`/goals/${currentAllocateGoalId}/contribute`, {
            method: 'POST',
            body: JSON.stringify({ amount: parseFloat(amount) })
        });

        closeModal('modal-allocate');
        document.getElementById('form-allocate').reset();

        // ✅ Meta completada → mostrar modal de decisión
        if (data.data.completed) {
            showCompletionModal(data.data);
        } else {
            toast.success('Abono registrado ✓');
            await loadAllData();
        }

    } catch (err) {
        toast.error(err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Abonar';
    }
}

// ─── Goals ──────────────────────────────────────────────────────────────────

const showCompletionModal = (goal) => {
  toast.success(`🎉 ¡Meta "${goal.title}" completada!`);
  handleGoalCompletion(goal.goalId, 'saving');
};

const handleGoalCompletion = async (goalId, completionType) => {
  try {
    await apiFetch(`/goals/${goalId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ completionType })
    });
    await loadAllData();
  } catch (err) {
    toast.error(err.message);
  }
};

// ─── Sync Gmail ───────────────────────────────────────────────────────────────
const syncTransactions = async () => {
    const btn = document.getElementById('btn-sync');

    btn.disabled = true;
    btn.innerHTML = '🐾 Buscando...';

    // Animación de puntos mientras carga
    let dots = 0;
    const loading = setInterval(() => {
        dots = (dots + 1) % 4;
        btn.innerHTML = `🐾 Buscando${''.padEnd(dots, '.')}`;
    }, 400);

    try {
        const data = await apiFetch('/gmail/sync', { method: 'POST' });

        if (data.success) {
            if (data.data.inserted > 0) {
                toast.success(`✅ ${data.data.inserted} nuevos movimientos importados`);
                await loadAllData();
            } else {
                toast.info('No hay movimientos nuevos');
            }
        } else {
            toast.error(data.message);
        }
    } catch (err) {
        toast.error('❌ Error de conexión');
    } finally {
        clearInterval(loading); // ← detiene la animación
        btn.disabled = false;
        btn.innerHTML = '🔄 Sincronizar movimientos bancarios';
    }
};

// SQL
//   └── ALTER TABLE goals → agregar completion_type ✅

// goalController.js
//   ├── addContribution()  → aporte + goal_allocations + transaction saving
//   ├── completeGoal()     → decisión final + transaction expense si aplica
//   └── module.exports     → agregar las dos funciones

// goalRoutes.js
//   ├── POST /:goalId/contribute  → addContribution
//   └── POST /:goalId/complete    → completeGoal

// Frontend
//   ├── handleContribution()     → llama al aporte
//   ├── showCompletionModal()    → pregunta al usuario
//   └── handleGoalCompletion()   → registra la decisión




// ─── Filters ──────────────────────────────────────────────────────────────────
async function applyFilters() {
    const type = document.getElementById('filter-type').value;
    const category = document.getElementById('filter-category').value;
    const start_date = document.getElementById('filter-start').value;
    const end_date = document.getElementById('filter-end').value;

    const params = {};
    if (type) params.type = type;
    if (category) params.category_id = category;
    if (start_date) params.start_date = start_date;
    if (end_date) params.end_date = end_date;
    params.limit = 50;

    try {
        const res = await transactions.list(params);
        renderTransactionsTable(res.data.transactions);
    } catch (err) {
        toast.error(err.message);
    }
}

function clearFilters() {
    ['filter-type', 'filter-category', 'filter-start', 'filter-end'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    renderTransactionsTable();
}
