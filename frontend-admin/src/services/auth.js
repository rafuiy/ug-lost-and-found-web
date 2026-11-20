import { SESSION_KEY, request } from './httpClient';

function saveStoredSession(session) {
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore storage errors
  }
}

export function getStoredSession() {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.id || !parsed.name || !parsed.accessToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearStoredSession() {
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore storage errors
  }
}

export async function authenticateOfficer({ username, password }) {
  const normalized = username.trim().toLowerCase();
  const payload = normalized.includes('@')
    ? { email: normalized, password }
    : { username: normalized, password };

  const { data } = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const admin = data?.admin || {};
  const session = {
    id: admin.id || admin.username || 'ADM',
    username: admin.username || normalized,
    email: admin.email || '',
    name: admin.name || 'Petugas Loket',
    desk: 'Loket D',
    role: admin.role_display || admin.role || 'Petugas Loket',
    roleSlug: admin.role || '',
    permissions: Array.isArray(admin.permissions) ? admin.permissions : [],
    accessToken: data?.access_token || '',
    expiresAt: data?.expires_at || '',
  };

  saveStoredSession(session);
  return session;
}

export async function fetchCurrentOfficer() {
  const current = getStoredSession();
  if (!current) return null;

  const { data } = await request('/auth/me', { method: 'GET' });
  const updated = {
    ...current,
    id: data?.id || current.id,
    username: data?.username || current.username,
    email: data?.email || current.email,
    name: data?.name || current.name,
    role: data?.role_display || data?.role || current.role,
    roleSlug: data?.role || current.roleSlug,
    permissions: Array.isArray(data?.permissions) ? data.permissions : current.permissions,
  };
  saveStoredSession(updated);
  return updated;
}

export async function logoutOfficer() {
  const current = getStoredSession();
  if (current?.accessToken) {
    try {
      await request('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore logout API failures during session cleanup
    }
  }
  clearStoredSession();
}

export function isHighPrivilegeOfficer(officer) {
  if (!officer) return false;
  if (Array.isArray(officer.permissions)) {
    return (
      officer.permissions.includes('audit_logs.read') ||
      officer.permissions.includes('reports.restore')
    );
  }
  return officer.roleSlug === 'admin' || officer.role === 'Admin';
}
