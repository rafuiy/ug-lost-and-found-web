import { API_MOCK } from '../../config/site'
import { mockSubmitReport, mockTrackReport } from '../api/mock'
import { ApiError, request } from '../http/client'

export function submitReport(formData) {
  if (API_MOCK) return mockSubmitReport()
  return request('/reports', { method: 'POST', body: formData, timeoutMs: 60000 })
}

export async function trackReport(ticketCode, verificationCode) {
  const payload = { ticket_code: ticketCode, verification_code: verificationCode }
  try {
    const data = API_MOCK
      ? await mockTrackReport(payload)
      : await request('/reports/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
    // Only public fields are read; the backend contract for these names is still a draft.
    return {
      ticketCode: data.ticket_code,
      status: data.status,
      isStale: Boolean(data.is_stale),
      reportedAt: data.created_at,
      message: data.message,
      visit: data.visit ?? null,
      reason: data.public_reason ?? null,
    }
  } catch (err) {
    if (err.status === 429) throw new ApiError('Terlalu banyak percobaan. Tunggu sebentar, lalu coba lagi.', { status: 429 })
    // Never reveal whether the ticket exists or which half of the pair was wrong.
    if (err.status >= 400 && err.status < 500) throw new ApiError('Kode tiket atau kode verifikasi tidak cocok. Periksa kembali keduanya.', { status: err.status })
    throw err
  }
}
