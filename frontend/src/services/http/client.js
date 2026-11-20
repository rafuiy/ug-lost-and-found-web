import { API_BASE } from '../../config/site'

export class ApiError extends Error {
  constructor(message, { status = 0, fields = {} } = {}) {
    super(message)
    this.status = status
    this.fields = fields
  }
}

const CLIENT_ERROR_STATUSES = [400, 413, 415, 422]

export async function request(path, { timeoutMs = 30000, ...options } = {}) {
  let res
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { Accept: 'application/json', ...options.headers },
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch {
    throw new ApiError('Koneksi gagal. Periksa internet kamu, lalu coba lagi.')
  }

  const body = await res.json().catch(() => null)
  if (res.ok) return body?.data

  // Backend messages are only surfaced for validation errors; anything else stays generic.
  const message = CLIENT_ERROR_STATUSES.includes(res.status) && body?.error?.message
    ? body.error.message
    : 'Terjadi kendala di server. Coba lagi beberapa saat lagi.'
  throw new ApiError(message, { status: res.status, fields: body?.error?.fields ?? {} })
}
