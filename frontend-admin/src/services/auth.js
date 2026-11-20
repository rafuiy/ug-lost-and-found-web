import { API_MOCK, SESSION_KEY, request } from './httpClient';

export const DEMO_ACCOUNT = {
  username: 'admin',
  password: 'change-admin-password',
};

const MOCK_OFFICERS = [
  {
    id: 'ADM-04D',
    username: 'budi.santoso',
    aliases: ['admin'],
    password: 'loket2026',
    name: 'Budi Santoso',
    desk: 'Loket D',
    role: 'Admin Berotorisasi Tinggi',
    permissions: [
      'inventories.read',
      'inventories.write',
      'reports.read',
      'reports.update_status',
      'reports.view_files',
      'reports.restore',
      'handovers.create',
      'audit_logs.read',
    ],
  },
  {
    id: 'ADM-02D',
    username: 'siti.aminah',
    aliases: ['petugas'],
    password: 'loket2026',
    name: 'Siti Aminah',
    desk: 'Loket D',
    role: 'Admin Loket',
    permissions: [
      'inventories.read',
      'inventories.write',
      'reports.read',
      'reports.update_status',
      'reports.view_files',
      'handovers.create',
    ],
  },
];

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
    if (!parsed || !parsed.id || !parsed.name) return null;
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

function buildMockSession(matched) {
  const session = {
    id: matched.id,
    username: matched.username,
    name: matched.name,
    desk: matched.desk,
    role: matched.role,
    permissions: matched.permissions,
    isMock: true,
  };
  saveStoredSession(session);
  return session;
}

export async function authenticateOfficer({ username, password }) {
  const normalized = username.trim().toLowerCase();

  if (API_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const matched = MOCK_OFFICERS.find(
      (officer) =>
        (officer.username === normalized || officer.aliases.includes(normalized)) &&
        officer.password === password
    );
    if (!matched) {
      throw new Error(
        'Username atau password tidak sesuai. Periksa kembali kredensial petugas Anda.'
      );
    }
    return buildMockSession(matched);
  }

  try {
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
      isMock: false,
    };

    saveStoredSession(session);
    return session;
  } catch (err) {
    if (err?.status === 0) {
      const mockMatch = MOCK_OFFICERS.find(
        (officer) =>
          (officer.username === normalized || officer.aliases.includes(normalized)) &&
          officer.password === password
      );
      if (mockMatch) {
        return buildMockSession(mockMatch);
      }
    }
    throw err;
  }
}

export async function fetchCurrentOfficer() {
  const current = getStoredSession();
  if (!current || current.isMock) return current;

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
  if (current && !current.isMock && current.accessToken) {
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
  return (
    officer.roleSlug === 'admin' ||
    officer.role === 'Admin' ||
    officer.role === 'Admin Berotorisasi Tinggi'
  );
}
