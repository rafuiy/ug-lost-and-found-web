const SESSION_KEY = 'uglf_admin_session';

export const DEMO_ACCOUNT = {
  username: 'budi.santoso',
  password: 'loket2026',
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
  },
  {
    id: 'ADM-02D',
    username: 'siti.aminah',
    aliases: [],
    password: 'loket2026',
    name: 'Siti Aminah',
    desk: 'Loket D',
    role: 'Admin Loket',
  },
];

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

// Simulasi autentikasi loket; siap diganti ke POST /api/v1/auth/login.
export async function authenticateOfficer({ username, password }) {
  const normalized = username.trim().toLowerCase();

  await new Promise((resolve) => setTimeout(resolve, 350));

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

  const session = {
    id: matched.id,
    username: matched.username,
    name: matched.name,
    desk: matched.desk,
    role: matched.role,
  };

  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore storage errors
  }

  return session;
}
