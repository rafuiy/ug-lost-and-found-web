import { ApiError } from '../http/client'

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

// Dev-only stand-in. Verification code picks the status: 1111 Belum Ada, 2222 Lawas,
// 3333 Perlu Verifikasi, 4444 Selesai, 5555 Ditolak, anything else fails.
const TRACK_FIXTURES = {
  1111: { status: 'Belum Ada', is_stale: false },
  2222: { status: 'Belum Ada', is_stale: true },
  3333: {
    status: 'Perlu Verifikasi',
    is_stale: false,
    visit: { location: 'Gedung 4 lantai dasar, Kampus D', schedule: 'Senin–Jumat, 08.00–15.00 WIB' },
  },
  4444: { status: 'Selesai', is_stale: false },
  5555: { status: 'Ditolak', is_stale: false, public_reason: 'Foto KTM/KRS tidak terbaca.' },
}

export async function mockSubmitReport() {
  await wait(900)
  const suffix = Array.from({ length: 5 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('')
  const ticket = `UG-${suffix}`
  return { ticket_code: ticket, status: 'Belum Ada', tracking_url: `/track/${ticket}` }
}

export async function mockTrackReport({ ticket_code, verification_code }) {
  await wait(700)
  const fixture = TRACK_FIXTURES[verification_code]
  if (!fixture) throw new ApiError('not found', { status: 404 })
  return { ticket_code, created_at: new Date(Date.now() - 3 * 86400000).toISOString(), ...fixture }
}
