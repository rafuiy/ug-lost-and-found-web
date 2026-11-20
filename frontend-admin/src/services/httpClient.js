export const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1';
export const SESSION_KEY = 'uglf_admin_session';

export class ApiError extends Error {
  constructor(message, { status = 0, code = '', fields = {} } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export function getAccessToken() {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    return parsed?.accessToken || '';
  } catch {
    return '';
  }
}

function buildHeaders(customHeaders = {}, includeJsonAccept = true) {
  const token = getAccessToken();
  const headers = { ...customHeaders };
  if (includeJsonAccept && !headers.Accept) {
    headers.Accept = 'application/json';
  }
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function request(path, { timeoutMs = 30000, ...options } = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: buildHeaders(options.headers, true),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new ApiError(
      'Tidak dapat terhubung ke server backend. Pastikan server Go berjalan dan koneksi tersedia.',
      { status: 0, code: 'NETWORK_ERROR' }
    );
  }

  const body = await res.json().catch(() => null);
  if (res.ok) {
    return {
      data: body?.data ?? null,
      meta: body?.meta ?? null,
    };
  }

  if (res.status === 401 && path !== '/auth/login') {
    window.dispatchEvent(new CustomEvent('uglf:unauthorized'));
  }

  const message =
    body?.error?.message ||
    (res.status === 401
      ? 'Sesi login telah berakhir atau tidak valid.'
      : 'Terjadi kendala saat memproses permintaan ke server.');

  throw new ApiError(message, {
    status: res.status,
    code: body?.error?.code || '',
    fields: body?.error?.fields || {},
  });
}

export async function requestPrivateFileBlobUrl(path, { timeoutMs = 30000 } = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'GET',
      headers: buildHeaders({}, false),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new ApiError('Gagal mengunduh berkas privat dari server.', {
      status: 0,
      code: 'NETWORK_ERROR',
    });
  }

  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent('uglf:unauthorized'));
    throw new ApiError('Sesi berakhir saat mengakses berkas privat.', { status: 401 });
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.error?.message || 'Berkas privat tidak tersedia.', {
      status: res.status,
      code: body?.error?.code || '',
    });
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
