// TODO(ops): replace with the real counter location and hours before launch.
const days = 'Senin–Jumat'
const open = '08.00'
const close = '15.00'

export const LOKET = {
  name: 'Loket Lost and Found',
  location: 'Gedung 4 lantai dasar, Kampus D Universitas Gunadarma',
  days,
  open,
  close,
  hours: `${days}, ${open}–${close} WIB`,
}

export const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1'
export const API_MOCK = import.meta.env.VITE_API_MOCK === 'true'

export const MAX_FILE_BYTES = 2 * 1024 * 1024
export const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf']
export const FILE_ACCEPT = '.jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf'
