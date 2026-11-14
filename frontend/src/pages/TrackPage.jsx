import { useEffect, useRef, useState } from 'react'
import { LuArrowRight, LuLoaderCircle } from 'react-icons/lu'
import { useParams } from 'react-router'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { Stamp } from '../components/ui/Stamp'
import { Ticket } from '../components/ui/Ticket'
import { LOKET } from '../config/site'
import { STALE_MESSAGE, STATUS } from '../data/statuses'
import { trackReport } from '../services/endpoints/reports'

// UI-side brake only; the backend rate limit is the real protection.
const MAX_FAILED_ATTEMPTS = 5
const LOCK_SECONDS = 60

function useCountdown() {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    if (seconds <= 0) return
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [seconds])
  return [seconds, setSeconds]
}

// Reads like the invitation letter the loket emails out.
function VisitLetter({ visit }) {
  return (
    <div className="relative mt-6 rounded-md border-2 border-ink bg-sheet px-5 py-5 sm:px-6">
      <Stamp tone="ug" rotate={8} className="absolute -top-4 right-6 bg-sheet">Undangan</Stamp>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-3">Datang ke {LOKET.name}</p>
      <dl className="mt-4 grid gap-x-5 gap-y-2.5 text-sm sm:grid-cols-[4.5rem_1fr]">
        <dt className="text-sm font-bold">Di mana</dt>
        <dd className="text-ink-2">{visit?.location ?? LOKET.location}</dd>
        <dt className="text-sm font-bold">Kapan</dt>
        <dd className="text-ink-2">{visit?.schedule ?? LOKET.hours}</dd>
        <dt className="text-sm font-bold">Bawa</dt>
        <dd className="font-bold text-ink">KTM asli. Fotokopi atau foto di ponsel tidak diterima.</dd>
      </dl>
      <p className="mt-4 border-t-2 border-dotted border-line-strong pt-3 text-[13px] leading-relaxed text-ink-2">
        Petugas tetap menanyakan ciri rahasia barang. Kecocokan awal belum berarti barang pasti milikmu.
      </p>
    </div>
  )
}

function TrackResult({ report }) {
  const headingRef = useRef(null)
  useEffect(() => headingRef.current?.focus(), [report])
  const meta = STATUS[report.status] ?? { title: report.status, message: '' }

  return (
    <section aria-labelledby="hasil-lacak" className="lg:pt-6">
      <Ticket code={report.ticketCode} status={report.status} isStale={report.isStale} reportedAt={report.reportedAt} className="max-w-[24rem] rotate-[1.5deg]" />
      <h2 id="hasil-lacak" ref={headingRef} tabIndex={-1} className="mt-8 text-[clamp(1.5rem,3vw,2rem)] font-bold leading-[1.05] tracking-[-0.035em] focus:outline-none">
        {meta.title}
      </h2>
      <p className="mt-2 max-w-xl leading-relaxed text-ink-2">{report.message || meta.message}</p>

      {report.isStale && <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-3">{STALE_MESSAGE}</p>}
      {report.status === 'Perlu Verifikasi' && <VisitLetter visit={report.visit} />}
      {report.status === 'Ditolak' && (
        <div className="mt-6 max-w-xl text-sm">
          {report.reason && (
            <p className="leading-relaxed text-ink-2">
              <strong className="text-danger">Alasan:</strong> {report.reason}
            </p>
          )}
          <Button to="/lapor" variant="outline" className="mt-6">
            Lapor ulang
            <LuArrowRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
      )}
    </section>
  )
}

function Help() {
  return (
    <div className="max-w-md space-y-4 text-sm leading-relaxed text-ink-2 lg:pt-8">
      <p>
        <strong className="block text-ink">Kode tiket ada di mana?</strong>
        Di email konfirmasi dan di layar terakhir setelah kamu mengirim formulir. Formatnya seperti <span className="font-bold text-ink">UG-7X9K2</span>.
      </p>
      <p>
        <strong className="block text-ink">Emailnya hilang?</strong>
        Datang ke loket dengan KTM. Petugas bisa mencari laporanmu.
      </p>
    </div>
  )
}

export function TrackPage() {
  const { ticketCode = '' } = useParams()
  const [ticket, setTicket] = useState(ticketCode.toUpperCase())
  const [verification, setVerification] = useState('')
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState(null)
  const [failures, setFailures] = useState(0)
  const [lockSeconds, setLockSeconds] = useCountdown()
  const ticketRef = useRef(null)
  const verificationRef = useRef(null)
  const alertRef = useRef(null)

  useEffect(() => {
    if (ticketCode) verificationRef.current?.focus()
  }, [ticketCode])

  useEffect(() => {
    if (apiError) alertRef.current?.focus()
  }, [apiError])

  const locked = lockSeconds > 0

  const onSubmit = async (event) => {
    event.preventDefault()
    if (loading || locked) return

    const code = ticket.trim().toUpperCase()
    const nextErrors = {}
    if (!code) nextErrors.ticket = 'Masukkan kode tiket.'
    if (!/^\d{4}$/.test(verification)) nextErrors.verification = 'Masukkan 4 digit angka.'
    setErrors(nextErrors)
    if (nextErrors.ticket) return ticketRef.current?.focus()
    if (nextErrors.verification) return verificationRef.current?.focus()

    setLoading(true)
    setApiError('')
    try {
      setReport(await trackReport(code, verification))
      setFailures(0)
    } catch (err) {
      setReport(null)
      setApiError(err.message)
      const nextFailures = failures + 1
      setFailures(nextFailures)
      if (nextFailures >= MAX_FAILED_ATTEMPTS) {
        setFailures(0)
        setLockSeconds(LOCK_SECONDS)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <section className="on-ug bg-ug-800 text-sheet">
        <div className="mx-auto max-w-6xl px-5 pb-24 pt-8 sm:px-8 lg:pb-16">
          <h1 className="text-[clamp(2.25rem,6vw,4rem)] font-bold leading-[0.92] tracking-[-0.05em] lg:ml-[41.666%]">
            Lacak tiket.
          </h1>
          <p className="mt-3 max-w-sm text-sm text-sheet/70 lg:ml-[41.666%]">
            Hanya status yang ditampilkan. Detail barang dan dokumenmu tidak pernah muncul di sini.
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
        <form
          noValidate
          onSubmit={onSubmit}
          aria-busy={loading}
          className="-mt-16 self-start rounded-md border-2 border-ink bg-sheet shadow-[6px_6px_0_var(--color-ug-950)] lg:-mt-36"
        >
          <div className="border-b-2 border-dashed border-ink bg-gold px-5 py-3 text-ug-950">
            <p className="text-xs font-bold uppercase tracking-[0.16em]">Tunjukkan tiketmu</p>
          </div>
          <div className="space-y-5 px-5 py-5">
            <Field
              ref={ticketRef}
              id="ticket_code"
              label="Kode tiket"
              value={ticket}
              placeholder="UG-XXXXX"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="[&_input]:h-12 [&_input]:text-lg [&_input]:font-bold [&_input]:uppercase [&_input]:tracking-[0.04em]"
              error={errors.ticket}
              onChange={(event) => { setTicket(event.target.value); setErrors((e) => ({ ...e, ticket: undefined })) }}
            />
            <Field
              ref={verificationRef}
              id="verification_code"
              label="Kode verifikasi"
              value={verification}
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              placeholder="0000"
              hint="4 digit terakhir NPM yang kamu daftarkan."
              className="[&_input]:h-12 [&_input]:w-32 [&_input]:text-lg [&_input]:font-bold [&_input]:tracking-[0.35em] [&_input]:tabular-nums"
              error={errors.verification}
              onChange={(event) => { setVerification(event.target.value.replace(/\D/g, '').slice(0, 4)); setErrors((e) => ({ ...e, verification: undefined })) }}
            />

            {apiError && !locked && <Alert ref={alertRef} role="alert">{apiError}</Alert>}
            {locked && (
              <Alert role="status" title="Coba lagi sebentar lagi">
                Terlalu banyak percobaan. Kamu bisa mencoba lagi dalam {lockSeconds} detik.
              </Alert>
            )}

            <Button type="submit" variant="ug" disabled={loading || locked} className="w-full">
              {loading ? (
                <>
                  <LuLoaderCircle aria-hidden="true" className="size-5 animate-spin motion-reduce:animate-none" />
                  Mencari tiket…
                </>
              ) : 'Lihat status'}
            </Button>
          </div>
        </form>

        <div className="min-w-0">
          {report ? <TrackResult report={report} /> : <Help />}
        </div>
      </div>
    </div>
  )
}
