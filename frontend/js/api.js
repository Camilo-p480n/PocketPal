// public/js/api.js
// Cliente centralizado para consumir la API del backend.
// Todos los módulos del frontend importan desde aquí.

const API_BASE = 'http://localhost:3000/api';

// ─── Auth helpers ─────────────────────────────────────────────────────────────

const getToken = () => localStorage.getItem('token');
const getUser = () => JSON.parse(localStorage.getItem('user') || 'null');

const saveAuth = (token, user) => {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
};

const clearAuth = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

const isLoggedIn = () => !!getToken();

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

/**
 * Realiza una petición autenticada al backend
 * @param {string} endpoint - Ruta relativa, ej: '/transactions'
 * @param {object} options  - fetch options (method, body, etc.)
 * @returns {Promise<object>} - Respuesta JSON parseada
 */
const apiFetch = async (endpoint, options = {}) => {
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    // Si el token expiró, redirigir al login
    if (response.status === 401) {
      clearAuth();
      window.location.href = '/frontend/index.html';
    }
    throw new Error(data.message || `Error ${response.status}`);
  }

  return data;
};

// ─── Auth endpoints ───────────────────────────────────────────────────────────

const auth = {
  register: (name, email, password) =>
    apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),

  login: (email, password) =>
    apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  me: () => apiFetch('/auth/me'),

  logout: () => {
    clearAuth();
    window.location.href = '/frontend/index.html';
  },
};

// ─── Transactions ─────────────────────────────────────────────────────────────

const transactions = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/transactions${qs ? '?' + qs : ''}`);
  },

  get: (id) => apiFetch(`/transactions/${id}`),

  create: (data) =>
    apiFetch('/transactions', { method: 'POST', body: JSON.stringify(data) }),

  update: (id, data) =>
    apiFetch(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id) => apiFetch(`/transactions/${id}`, { method: 'DELETE' }),
};

// ─── Categories ───────────────────────────────────────────────────────────────

const categories = {
  list: () => apiFetch('/categories'),
  create: (data) => apiFetch('/categories', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiFetch(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => apiFetch(`/categories/${id}`, { method: 'DELETE' }),
};

// ─── Goals ────────────────────────────────────────────────────────────────────

const goals = {
  list: () => apiFetch('/goals'),
  get: (id) => apiFetch(`/goals/${id}`),
  create: (data) => apiFetch('/goals', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiFetch(`/goals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => apiFetch(`/goals/${id}`, { method: 'DELETE' }),
  allocate: (id, amount) => apiFetch(`/goals/${id}/allocations`, { method: 'POST', body: JSON.stringify({ amount }) }),
};

// ─── Summary ──────────────────────────────────────────────────────────────────

const summary = {
  get: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/summary${qs ? '?' + qs : ''}`);
  },
  goals: () => apiFetch('/summary/goals'),
};

// ─── AI Agent ─────────────────────────────────────────────────────────────────

const ai = {
  chat: (message, history = []) =>
    apiFetch('/ai/chat', { method: 'POST', body: JSON.stringify({ message, history }) }),

  history: () => apiFetch('/ai/history'),

  clearHistory: () => apiFetch('/ai/history', { method: 'DELETE' }),
};

// ─── Utils ────────────────────────────────────────────────────────────────────

const fmt = {
  /** Formatea número como moneda COP */
  currency: (n, currency = 'COP') =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n),

  /** Formatea fecha ISO a texto legible */
  date: (d) => new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }),

  /** Formatea timestamp */
  datetime: (d) => new Date(d).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),

  /** Acorta texto largo */
  truncate: (str, max = 30) => str && str.length > max ? str.slice(0, max) + '…' : str,
};

// ─── Toast notifications ──────────────────────────────────────────────────────

const toast = {
  show: (message, type = 'info') => {
    const container = document.getElementById('toast-container') || (() => {
      const el = document.createElement('div');
      el.id = 'toast-container';
      document.body.appendChild(el);
      return el;
    })();

    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `
      <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
      <span>${message}</span>
    `;
    container.appendChild(el);
    setTimeout(() => el.classList.add('show'), 10);
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 400);
    }, 3500);
  },
  success: (msg) => toast.show(msg, 'success'),
  error: (msg) => toast.show(msg, 'error'),
  info: (msg) => toast.show(msg, 'info'),
};

// Protección de rutas — llamar al inicio de páginas protegidas
const requireAuth = () => {
  if (!isLoggedIn()) {
    window.location.href = '/frontend/index.html';
    return false;
  }
  return true;
};
