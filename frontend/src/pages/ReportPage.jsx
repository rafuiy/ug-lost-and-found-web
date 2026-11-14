import { useEffect, useRef, useState } from 'react'
import { LuArrowLeft, LuArrowRight, LuCheck, LuCopy, LuLoaderCircle, LuMail } from 'react-icons/lu'
import { Link } from 'react-router'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { FileField } from '../components/ui/FileField'
import { Stamp } from '../components/ui/Stamp'
import { Ticket } from '../components/ui/Ticket'
import { submitReport } from '../services/endpoints/reports'
import { toLocalInputValue } from '../utils/format'
import { normalizePhone, validateReport } from '../utils/validation'

const EMPTY_VALUES = {
  reporter_name: '',
  npm: '',
  reporter_email: '',
  phone_number: '',
  item_name: '',
  loss_location: '',
  loss_datetime: '',
  item_description: '',
  secret_traits: '',
}

const FIELD_ORDER = [...Object.keys(EMPTY_VALUES), 'ktm_krs', 'item_image']

function Section({ n, title, description, children }) {
  return (
    <fieldset className="grid gap-x-8 border-t-2 border-dotted border-line-strong px-5 py-6 first-of-type:border-t-0 sm:px-7 lg:grid-cols-[3.5rem_1fr] lg:px-8">
      <legend className="sr-only">{title}</legend>
      <p aria-hidden="true" className="text-3xl font-bold leading-none tracking-[-0.04em] text-ug-200 lg:text-4xl">{n}</p>
      <div>
        <h2 aria-hidden="true" className="mt-2 text-lg font-bold lg:mt-0.5">{title}</h2>
        {description && <p className="mt-1 text-sm text-ink-3">{description}</p>}
        <div className="mt-5 grid gap-x-5 gap-y-5 sm:grid-cols-2">{children}</div>
      </div>
    </fieldset>
  )
}

function ReportSuccess({ result }) {
  const headingRef = useRef(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => headingRef.current?.focus(), [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.ticket_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div>
      <section className="on-ug relative bg-ug-800 text-sheet">
        <div className="mx-auto max-w-5xl px-5 pb-20 pt-8 sm:px-8 lg:pb-24">
          <Stamp tone="gold" rotate={-6}>Laporan tersimpan</Stamp>
          <h1 ref={headingRef} tabIndex={-1} className="mt-5 max-w-2xl text-[clamp(1.9rem,4.5vw,3.25rem)] font-bold leading-[0.98] tracking-[-0.04em] focus:outline-none">
            Simpan tiket ini baik-baik.
          </h1>
          <p className="mt-3 max-w-md text-sm text-sheet/75">Ini satu-satunya cara melacak laporanmu. Tidak ada akun yang bisa dipulihkan.</p>
        </div>
        <div aria-hidden="true" className="edge-torn absolute inset-x-0 bottom-0" />
      </section>

      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <div className="-mt-16 grid gap-8 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-12">
          <div>
            <Ticket code={result.ticket_code} status={result.status} reportedAt={result.reportedAt} className="relative z-10 rotate-[-2deg]" />
            <div className="mt-6 flex items-center gap-3">
              <Button variant="outline" onClick={copy}>
                {copied ? <LuCheck aria-hidden="true" className="size-4" /> : <LuCopy aria-hidden="true" className="size-4" />}
                {copied ? 'Tersalin' : 'Salin kode'}
              </Button>
              <span role="status" className="sr-only">{copied ? 'Kode tiket tersalin' : ''}</span>
            </div>
          </div>

          <div className="pb-16 text-sm lg:pt-20">
            <p className="flex gap-3 leading-relaxed text-ink-2">
              <LuMail aria-hidden="true" className="mt-1 size-5 shrink-0 text-ug-700" />
              <span>
                Salinan dikirim ke <strong className="text-ink">{result.email}</strong>. Belum masuk? Cek folder spam. Kode di samping tetap berlaku walau email terlambat.
              </span>
            </p>

            <h2 className="mt-6 text-xs font-bold uppercase tracking-[0.14em] text-ink-3">Setelah ini</h2>
            <ol className="mt-3 space-y-2.5 leading-relaxed text-ink-2">
              <li><strong className="text-ink">Petugas mencocokkan</strong> laporanmu dengan barang temuan.</li>
              <li><strong className="text-ink">Ada yang cocok?</strong> Status jadi Perlu Verifikasi dan kamu dapat email undangan.</li>
              <li><strong className="text-ink">Datang ke loket</strong> dengan KTM asli. Petugas menanyakan ciri rahasia barang.</li>
            </ol>

            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Button to={result.tracking_url} variant="ug">
                Lacak tiket ini
                <LuArrowRight aria-hidden="true" className="size-4" />
              </Button>
              <Button to="/" variant="ghost">Kembali ke beranda</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ReportPage() {
  const [values, setValues] = useState(EMPTY_VALUES)
  const [files, setFiles] = useState({ ktm_krs: null, item_image: null })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState('')
  const [result, setResult] = useState(null)
  const [maxLossDate] = useState(() => toLocalInputValue(new Date()))
  const fieldRefs = useRef({})
  const alertRef = useRef(null)

  useEffect(() => {
    if (apiError) alertRef.current?.focus()
  }, [apiError])

  if (result) return <ReportSuccess result={result} />

  const clearError = (key) => setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))

  const bind = (key) => ({
    id: key,
    value: values[key],
    error: errors[key],
    ref: (el) => { fieldRefs.current[key] = el },
    onChange: (event) => {
      setValues((prev) => ({ ...prev, [key]: event.target.value }))
      clearError(key)
    },
  })

  const bindFile = (key) => ({
    id: key,
    file: files[key],
    error: errors[key],
    ref: (el) => { fieldRefs.current[key] = el },
    onChange: (file) => {
      setFiles((prev) => ({ ...prev, [key]: file }))
      clearError(key)
    },
  })

  const onSubmit = async (event) => {
    event.preventDefault()
    if (submitting) return

    const nextErrors = validateReport(values, files)
    setErrors(nextErrors)
    const firstInvalid = FIELD_ORDER.find((key) => nextErrors[key])
    if (firstInvalid) {
      fieldRefs.current[firstInvalid]?.focus()
      return
    }

    const body = new FormData()
    for (const [key, value] of Object.entries(values)) body.append(key, value.trim())
    body.set('phone_number', normalizePhone(values.phone_number.trim()))
    body.set('loss_datetime', new Date(values.loss_datetime).toISOString())
    body.append('ktm_krs', files.ktm_krs)
    if (files.item_image) body.append('item_image', files.item_image)

    setSubmitting(true)
    setApiError('')
    try {
      const data = await submitReport(body)
      setResult({ ...data, email: values.reporter_email.trim(), reportedAt: new Date().toISOString() })
    } catch (err) {
      setErrors(err.fields)
      setApiError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <section className="on-ug bg-ug-800 text-sheet">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-5 pb-20 pt-6 sm:px-8 lg:pb-24">
          <div>
            <Link to="/" className="inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold text-sheet/70 hover:text-sheet">
              <LuArrowLeft aria-hidden="true" className="size-4" />
              Beranda
            </Link>
            <h1 className="mt-4 text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[0.95] tracking-[-0.045em]">
              Formulir<br className="sm:hidden" /> kehilangan
            </h1>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 sm:px-8 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-12">
        <form
          noValidate
          onSubmit={onSubmit}
          aria-busy={submitting}
          className="relative -mt-14 rounded-md border-2 border-ink bg-sheet shadow-[8px_8px_0_var(--color-ug-950)] max-sm:-mx-2"
        >
          <div className="flex items-center justify-between gap-4 border-b-2 border-ink px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] sm:px-7 lg:px-8">
            <span>Lost &amp; Found · Formulir L-01</span>
            <span className="text-ink-3"><span aria-hidden="true" className="text-ug-600">*</span> wajib</span>
          </div>

          <Section n="01" title="Data diri" description="Untuk menghubungimu dan mencocokkan KTM di loket.">
            <Field label="Nama lengkap" autoComplete="name" {...bind('reporter_name')} />
            <Field label="NPM" inputMode="numeric" autoComplete="off" {...bind('npm')} hint="4 digit terakhirnya jadi kode verifikasi saat melacak." />
            <Field label="Email aktif" type="email" autoComplete="email" {...bind('reporter_email')} hint="Kode tiket dikirim ke sini." />
            <Field label="Nomor WhatsApp" type="tel" inputMode="tel" autoComplete="tel" placeholder="08xxxxxxxxxx" {...bind('phone_number')} />
          </Section>

          <Section n="02" title="Barang yang hilang">
            <Field label="Nama barang" placeholder="mis. Dompet kulit cokelat" {...bind('item_name')} />
            <Field label="Waktu kehilangan" type="datetime-local" max={maxLossDate} hint="Perkiraan juga boleh." {...bind('loss_datetime')} />
            <Field label="Lokasi kehilangan" placeholder="mis. Lab komputer Gedung 4, lantai 3" className="sm:col-span-2" {...bind('loss_location')} />
            <Field
              label="Deskripsi barang"
              multiline
              rows={3}
              placeholder="Warna, merek, ukuran, kondisi terakhir."
              className="sm:col-span-2"
              {...bind('item_description')}
            />
            <div className="relative rounded-md border-2 border-dashed border-ug-600/50 bg-ug-100/60 p-4 sm:col-span-2 sm:p-5">
              <Stamp tone="ug" size="sm" rotate={6} className="absolute -top-3 right-5 bg-sheet">Rahasia</Stamp>
              <Field
                label="Ciri rahasia"
                multiline
                rows={3}
                placeholder="mis. Ada foto keluarga di balik kartu ATM, goresan di sudut kanan bawah."
                hint="Tidak pernah tampil di halaman lacak. Tulis detail yang hanya pemilik tahu; petugas akan menanyakannya di loket."
                {...bind('secret_traits')}
              />
            </div>
          </Section>

          <Section n="03" title="Dokumen" description="Hanya bisa dibuka petugas loket yang berwenang.">
            <FileField label="Foto KTM atau KRS" {...bindFile('ktm_krs')} />
            <FileField label="Foto pendukung" required={false} hint="Foto barang sebelum hilang atau nota pembelian." {...bindFile('item_image')} />
          </Section>

          <div className="space-y-4 border-t-2 border-ink bg-paper/60 px-5 py-5 sm:px-7 lg:px-8">
            {apiError && (
              <Alert ref={alertRef} role="alert" title="Laporan belum terkirim">
                {apiError} Isian di formulir ini tidak hilang.
              </Alert>
            )}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
              <Button type="submit" variant="gold" disabled={submitting} className="w-full sm:w-auto">
                {submitting ? (
                  <>
                    <LuLoaderCircle aria-hidden="true" className="size-5 animate-spin motion-reduce:animate-none" />
                    Mengirim laporan…
                  </>
                ) : (
                  <>
                    Kirim laporan
                    <LuArrowRight aria-hidden="true" className="size-5" />
                  </>
                )}
              </Button>
              <p className="text-sm text-ink-3">Dengan mengirim, kamu menyatakan data ini benar.</p>
            </div>
          </div>
        </form>

        <aside className="text-sm leading-relaxed text-ink-2 lg:sticky lg:top-6 lg:self-start lg:pt-6">
          <p className="font-bold text-ink">Sebelum mulai, siapkan:</p>
          <p className="mt-3">foto KTM atau KRS yang terbaca, perkiraan lokasi dan waktu barang terakhir terlihat, dan satu-dua detail yang hanya pemilik tahu.</p>
          <p className="mt-6 font-bold text-ink">Setelah dikirim</p>
          <p className="mt-3">kamu langsung dapat kode tiket. Salinannya masuk ke email bersama tautan lacak.</p>
        </aside>
      </div>
    </div>
  )
}
