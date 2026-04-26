/* ═══════════════════════════════════════════
   auth.js — Login, Register, token management
   (Real backend version — calls Express API)
   ═══════════════════════════════════════════ */

const API_BASE = 'http://127.0.0.1:5000/api';

// ── Token storage ─────────────────────────────────────────────────────────────
function saveSession(token, role, user) {
  localStorage.setItem('ga_token', token);
  localStorage.setItem('ga_role',  role);
  localStorage.setItem('ga_user',  JSON.stringify(user));
}

function getToken()   { return localStorage.getItem('ga_token'); }
function getRole()    { return localStorage.getItem('ga_role');  }
function getUser()    { const u = localStorage.getItem('ga_user'); return u ? JSON.parse(u) : null; }

function clearSession() {
  localStorage.removeItem('ga_token');
  localStorage.removeItem('ga_role');
  localStorage.removeItem('ga_user');
}

// ── Core API helper ───────────────────────────────────────────────────────────
async function apiRequest(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Use mockApi directly to bypass backend
  if (window.mockApi) {
    return await window.mockApi.request(path, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  }

  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) }
  });

  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

// ── Login ─────────────────────────────────────────────────────────────────────
async function loginUser(role, email, password) {
  if (window.mockApi) {
    const res = await window.mockApi.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, role })
    });
    const data = res.data;
    if (data.success) {
      saveSession(data.token, data.role, data.user);
    }
    return data;
  }

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, role })
  });

  const data = await res.json();

  if (data.success) {
    saveSession(data.token, data.role, data.user);
  }

  return data;
}

// ── Register ──────────────────────────────────────────────────────────────────
async function registerUser(role, payload) {
  const endpoint = role === 'faculty' ? `/auth/register/faculty` : `/auth/register/student`;

  if (window.mockApi) {
    const res = await window.mockApi.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const data = res.data;
    if (data.success) {
      saveSession(data.token, data.role, data.user);
    }
    return data;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  if (data.success) {
    saveSession(data.token, data.role, data.user);
  }

  return data;
}

// ── Logout ────────────────────────────────────────────────────────────────────
function logout() {
  clearSession();
  window.location.href = 'index.html';
}

// ── Route guards ──────────────────────────────────────────────────────────────
function requireFaculty() {
  const token = getToken();
  const role  = getRole();
  if (!token || role !== 'faculty') {
    clearSession();
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

function requireStudent() {
  const token = getToken();
  const role  = getRole();
  if (!token || role !== 'student') {
    clearSession();
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

// ── Toast notifications ───────────────────────────────────────────────────────
function showToast(msg, type = 'info', duration = 3500) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(30px)';
    toast.style.transition = '0.3s ease';
    setTimeout(() => toast.remove(), 310);
  }, duration);
}

// ── Format helpers ────────────────────────────────────────────────────────────
function fmtTime(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function fmtDateTime(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-IN') + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusBadge(status) {
  const map = {
    active:   '<span class="badge badge-success">● Active</span>',
    stopped:  '<span class="badge badge-danger">■ Stopped</span>',
    completed:'<span class="badge badge-danger">■ Completed</span>',
    verified: '<span class="badge badge-success">✔ Verified</span>',
    failed:   '<span class="badge badge-danger">✖ Failed</span>',
    manual:   '<span class="badge badge-warning">✎ Manual</span>',
    auto:     '<span class="badge badge-primary">⚡ Auto</span>',
  };
  return map[status?.toLowerCase()] || `<span class="badge badge-info">${status || '—'}</span>`;
}
