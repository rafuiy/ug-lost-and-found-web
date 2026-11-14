import { ALLOWED_FILE_TYPES, MAX_FILE_BYTES } from '../config/site'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NPM_RE = /^\d{8,15}$/
const PHONE_RE = /^(\+62|62|0)8\d{7,12}$/

const LIMITS = { reporter_name: 100, reporter_email: 100, item_name: 100, loss_location: 150 }

export function normalizePhone(value) {
  return value.replace(/[\s-]/g, '')
}

export function validateFile(file, { required }) {
  if (!file) return required ? 'Unggah file ini.' : ''
  if (!ALLOWED_FILE_TYPES.includes(file.type)) return 'Format harus JPG, PNG, atau PDF.'
  if (file.size > MAX_FILE_BYTES) return 'Ukuran file maksimal 2 MB.'
  return ''
}

export function validateReport(values, files) {
  const errors = {}
  for (const [key, value] of Object.entries(values)) {
    if (!value.trim()) errors[key] = 'Wajib diisi.'
    else if (LIMITS[key] && value.trim().length > LIMITS[key]) errors[key] = `Maksimal ${LIMITS[key]} karakter.`
  }

  if (!errors.reporter_email && !EMAIL_RE.test(values.reporter_email.trim())) errors.reporter_email = 'Format email belum benar.'
  if (!errors.npm && !NPM_RE.test(values.npm.trim())) errors.npm = 'NPM hanya berisi angka, minimal 8 digit.'
  if (!errors.phone_number && !PHONE_RE.test(normalizePhone(values.phone_number))) errors.phone_number = 'Gunakan nomor Indonesia, mis. 0812xxxxxxxx.'
  if (!errors.loss_datetime) {
    const when = new Date(values.loss_datetime)
    if (Number.isNaN(when.getTime())) errors.loss_datetime = 'Tanggal belum valid.'
    else if (when > new Date()) errors.loss_datetime = 'Waktu kehilangan tidak boleh di masa depan.'
  }

  const ktm = validateFile(files.ktm_krs, { required: true })
  if (ktm) errors.ktm_krs = ktm
  const image = validateFile(files.item_image, { required: false })
  if (image) errors.item_image = image

  return errors
}
