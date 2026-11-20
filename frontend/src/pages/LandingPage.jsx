import { useEffect, useRef, useState } from 'react'
import { LuArrowDown, LuArrowRight, LuCornerDownRight, LuSearch } from 'react-icons/lu'
import { Link } from 'react-router'
import { Button } from '../components/ui/Button'
import { Stamp, StatusStamp } from '../components/ui/Stamp'
import { Ticket } from '../components/ui/Ticket'
import { LOKET } from '../config/site'
import { STALE_LABEL, STATUS } from '../data/statuses'

const LANES = [
  { id: 'kamu', label: 'Kamu' },
  { id: 'loket', label: 'Petugas loket' },
]

// col = column on the desktop swimlane; the last step spans both lanes.
const STEPS = [
  { lane: 'kamu', col: 'lg:col-start-2', title: 'Isi formulir', body: 'Data diri, lokasi dan waktu hilang, ciri rahasia, foto KTM/KRS. Tanpa akun.' },
  { lane: 'kamu', col: 'lg:col-start-3', title: 'Simpan kode tiket', body: 'Kode muncul di layar dan terkirim ke email. Pasangkan dengan 4 digit NPM untuk cek status.' },
  { lane: 'loket', col: 'lg:col-start-4', title: 'Cocokkan dengan gudang', body: 'Petugas membandingkan laporanmu dengan barang temuan yang hanya mereka lihat.' },
  { lane: 'loket', col: 'lg:col-start-5', title: 'Kirim undangan', body: 'Ada yang cocok? Status berganti, lalu undangan berisi jadwal kedatangan masuk ke emailmu.' },
]

const ACTION = {
  'Belum Ada': 'Tunggu email, belum perlu datang.',
  'Perlu Verifikasi': 'Bawa KTM asli sesuai jadwal undangan.',
  Selesai: 'Tidak ada lagi yang perlu dilakukan.',
  Ditolak: 'Baca alasannya, lalu kirim laporan baru bila ada data yang keliru.',
}

function useInView(ref) {
  const [inView, setInView] = useState(true)
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting))
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [ref])
  return inView
}

function StatusNode({ name, rotate, className = '' }) {
  return (
    <div className={className}>
      <StatusStamp status={name} rotate={rotate} className="bg-sheet/60" />
      <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-2">{STATUS[name].message}</p>
      <p className="mt-3 max-w-xs text-[13px] font-bold leading-relaxed text-ink">
        <span className="text-ink-3">Langkahmu: </span>{ACTION[name]}
      </p>
    </div>
  )
}

export function LandingPage() {
  const heroCtaRef = useRef(null)
  const heroCtaVisible = useInView(heroCtaRef)

  return (
    <div className="overflow-x-clip pb-24 sm:pb-0">
      {/* Hero: stepped headline left, ticket in the right column breaking the bottom edge */}
      <section className="on-ug relative bg-ug-800 text-sheet">
        <div className="mx-auto grid max-w-6xl gap-x-12 px-5 pt-8 sm:px-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-center lg:pb-20 lg:pt-12">
          <div>
            <h1 className="font-bold leading-[1.02] tracking-[-0.04em] text-[clamp(2.5rem,6.6vw,5.25rem)]">
              <span className="block">Hilang</span>
              <span className="block pl-[0.75em]">di kampus?</span>
              <span className="block text-gold">Lapor sekali.</span>
            </h1>

            <div ref={heroCtaRef} className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Button to="/lapor" variant="gold" size="lg">
                Mulai laporan
                <LuArrowRight aria-hidden="true" className="size-5" />
              </Button>
              <Link to="/track" className="rounded-sm font-semibold text-sheet underline decoration-sheet/40 decoration-2 underline-offset-[6px] hover:decoration-gold">
                Sudah punya kode? Cek status
              </Link>
            </div>
            <p className="mt-5 text-[13px] text-sheet/55">Kira-kira 3 menit. Siapkan foto KTM atau KRS.</p>
          </div>

          {/* Back tickets are decoration; only the front one is read out. */}
          <figure className="relative z-10 mt-28 -mb-16 lg:mt-28 lg:mb-0">
            <div aria-hidden="true" className="absolute inset-x-0 top-0 -translate-y-[5.5rem] translate-x-5 rotate-[5deg] sm:translate-x-10">
              <Ticket code="UG-M3R8T" status="Selesai" reportedAt="2026-10-02T14:40:00+07:00" />
            </div>
            <div aria-hidden="true" className="absolute inset-x-0 top-0 -translate-y-[2.75rem] -translate-x-2 rotate-[-7deg] sm:-translate-x-5">
              <Ticket code="UG-Q4H2N" status="Belum Ada" reportedAt="2026-11-12T08:05:00+07:00" />
            </div>
            <Ticket code="UG-7X9K2" status="Perlu Verifikasi" reportedAt="2026-11-10T09:12:00+07:00" className="rotate-[-2deg]" />
          </figure>
        </div>

        <div aria-hidden="true" className="edge-torn absolute inset-x-0 bottom-0" />
      </section>

      {/* Swimlane: who does what */}
      <section id="cara-kerja" className="mx-auto max-w-6xl px-5 pt-24 sm:px-8 lg:pt-20">
        <h2 className="max-w-xl text-[clamp(1.75rem,3.6vw,2.75rem)] font-bold leading-[1.1] tracking-[-0.03em]">
          Bagianmu cuma <span className="whitespace-nowrap"><mark>awal dan akhir</mark>.</span> <span className="text-ink-3">Sisanya urusan petugas.</span>
        </h2>

        <div className="mt-8 lg:grid lg:grid-cols-[7rem_repeat(4,minmax(0,1fr))_minmax(0,1.2fr)] lg:grid-rows-2 lg:border-y-2 lg:border-ink">
          {LANES.map((lane, i) => (
            <p key={lane.id} className={`hidden px-0 py-4 text-[11px] font-bold uppercase tracking-[0.16em] lg:block lg:col-start-1 ${i === 0 ? 'lg:row-start-1 lg:border-b lg:border-dashed lg:border-line-strong' : 'lg:row-start-2 text-ug-700'}`}>
              {lane.label}
            </p>
          ))}
          {LANES.flatMap((lane, row) =>
            ['lg:col-start-2', 'lg:col-start-3', 'lg:col-start-4', 'lg:col-start-5'].map((col) => {
              const step = STEPS.find((s) => s.lane === lane.id && s.col === col)
              const rowClass = row === 0 ? 'lg:row-start-1 lg:border-b lg:border-dashed lg:border-line-strong' : 'lg:row-start-2 lg:bg-ug-100/70'
              if (!step) return <div key={lane.id + col} aria-hidden="true" className={`hidden lg:block ${col} ${rowClass}`} />
              const n = STEPS.indexOf(step) + 1
              return (
                <div key={lane.id + col} className={`border-t border-line py-4 lg:border-t-0 lg:px-4 ${col} ${rowClass} ${lane.id === 'loket' ? 'pl-10 lg:pl-5' : ''}`}>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-3">
                    <span className="tabular-nums">{n}</span>
                    <span className="lg:hidden"> · {lane.label}</span>
                  </p>
                  <h3 className={`mt-1.5 text-[15px] font-bold leading-snug ${lane.id === 'loket' ? 'text-ug-700' : ''}`}>{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">{step.body}</p>
                </div>
              )
            }),
          )}
          <div className="mt-2 rounded-md bg-gold px-5 py-5 text-ug-950 lg:col-start-6 lg:row-span-2 lg:row-start-1 lg:my-[-2px] lg:mt-[-2px] lg:rounded-none lg:px-5 lg:py-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em]">5 · Kamu dan petugas</p>
            <h3 className="mt-1.5 text-xl font-bold leading-snug">Ketemu di loket</h3>
            <p className="mt-2 text-sm leading-relaxed">Petugas mencocokkan KTM asli dan menanyakan ciri rahasia. Cocok? Barang kembali, serah terima dicatat.</p>
            <Stamp tone="ink" size="sm" rotate={-6} className="mt-4">Bawa KTM asli</Stamp>
          </div>
        </div>
      </section>

      {/* Privacy: show the thing we refuse to build */}
      <section id="privasi" className="mx-auto max-w-6xl px-5 pb-16 pt-28 sm:px-8 lg:pb-24 lg:pt-40">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5">
            <p className="text-[13px] font-bold text-ug-700">Kenapa tidak ada daftar barang temuan?</p>
            <h2 className="mt-4 text-[clamp(1.75rem,3.6vw,2.75rem)] font-bold leading-[1.1] tracking-[-0.035em]">
              Barang temuan sengaja <span className="whitespace-nowrap"><mark>tidak kami pajang</mark>.</span>
            </h2>
            <p className="mt-4 leading-relaxed text-ink-2">
              Katalog terbuka mengundang klaim palsu. Siapa pun bisa melihat foto dompet cokelat lalu mengaku pemiliknya. Di sini kamu membuktikan kepemilikan lewat detail yang tidak terlihat dari foto.
            </p>
          </div>

          <figure className="relative lg:col-span-6 lg:col-start-7">
            <div aria-hidden="true" className="rotate-[2deg] select-none rounded-[4px] border-[1.5px] border-line-strong bg-sheet px-6 py-6 text-ink-3 sm:px-8">
              <p className="text-xs font-bold uppercase tracking-[0.16em]">Barang temuan #0412</p>
              <p className="mt-2 text-[clamp(1.25rem,2.4vw,1.75rem)] font-bold leading-tight line-through decoration-danger/70 decoration-[3px]">Dompet kulit cokelat</p>
              <dl className="mt-4 grid grid-cols-[6rem_1fr] gap-y-1.5 text-[13px] line-through decoration-ink-3/60">
                <dt>Ditemukan</dt><dd>Gedung 4, lantai 3, dekat lab</dd>
                <dt>Isi</dt><dd>KTM, 2 kartu ATM, foto</dd>
                <dt>Ciri</dt><dd>Gantungan kunci bentuk kucing</dd>
              </dl>
              <p className="mt-4 inline-block rounded-[4px] border-[1.5px] border-line-strong px-3 py-1.5 text-[13px] font-bold line-through">Klaim barang ini</p>
            </div>
            <Stamp tone="danger" size="lg" rotate={-14} className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 bg-paper/80 text-lg sm:text-2xl">
              Tidak dipajang
            </Stamp>
            <figcaption className="mt-4 text-[13px] text-ink-3 lg:ml-8">Contoh halaman yang tidak akan pernah kamu temukan di sini.</figcaption>
          </figure>
        </div>

        <p className="mt-10 max-w-2xl leading-relaxed text-ink-2 lg:ml-[41.666%] lg:mt-12 lg:text-lg">
          <strong className="text-ink">Ciri rahasia</strong> hanya dibaca petugas, tidak pernah muncul di halaman lacak.{' '}
          <strong className="text-ink">Foto KTM/KRS</strong> disimpan privat tanpa tautan publik.{' '}
          <strong className="text-ink">Melacak</strong> butuh dua kunci: kode tiket dan 4 digit NPM, jadi tiketmu tidak bisa diintip orang lain.
        </p>
      </section>

      {/* Status as a flow, not a legend */}
      <section id="status" className="bg-ug-100">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 lg:py-20">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h2 className="max-w-xl text-[clamp(1.75rem,3.6vw,2.75rem)] font-bold leading-[1.1] tracking-[-0.035em]">
              Satu tiket, empat kemungkinan cap.
            </h2>
            <Button to="/track" variant="ghost" className="text-sm">
              Lihat status laporanmu
              <LuArrowRight aria-hidden="true" className="size-4" />
            </Button>
          </div>

          <div className="mt-10 grid gap-x-6 gap-y-6 lg:grid-cols-[1fr_2.5rem_1fr_2.5rem_1fr] lg:gap-y-10">
            <StatusNode name="Belum Ada" rotate={-3} />
            <Arrow />
            <StatusNode name="Perlu Verifikasi" rotate={2} className="lg:pt-6" />
            <Arrow className="lg:pt-6" />
            <StatusNode name="Selesai" rotate={-5} className="lg:pt-12" />

            <div className="flex gap-4 border-t border-dashed border-ug-200 pt-6 lg:col-start-1 lg:row-start-2 lg:border-0 lg:pt-0">
              <Stamp size="sm" rotate={-2} tone="neutral" className="shrink-0 self-start">{STALE_LABEL}</Stamp>
              <p className="text-sm leading-relaxed text-ink-2">Masih Belum Ada setelah 30 hari? Tiket diberi cap ini, tetapi tetap aktif dan tetap dicocokkan.</p>
            </div>
            <div className="flex gap-3 lg:col-start-3 lg:col-end-6 lg:row-start-2">
              <LuCornerDownRight aria-hidden="true" className="mt-2 size-6 shrink-0 text-ink-3" />
              <div className="sm:flex sm:items-start sm:gap-10">
                <p className="mt-2 shrink-0 text-sm font-bold text-ink-3 sm:mt-3">atau, kalau data tidak valid</p>
                <StatusNode name="Ditolak" rotate={4} className="mt-4 sm:mt-0" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Loket signage with the closing CTA hanging off its left edge */}
      <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8 lg:py-20">
        <div className="relative lg:ml-[30%]">
          <div className="on-ug rounded-md bg-ug-800 px-6 py-7 text-sheet sm:px-8 lg:py-9 lg:pl-44 lg:pr-10">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-sheet/55">{LOKET.name} · {LOKET.days}</p>
            <p className="mt-3 whitespace-nowrap font-bold leading-none tracking-[-0.045em] tabular-nums text-[clamp(2.25rem,10vw,4rem)] lg:text-[clamp(2.5rem,4.6vw,4rem)]">
              {LOKET.open}<span className="text-gold">–</span>{LOKET.close}
            </p>
            <p className="mt-3 text-sm text-sheet/75">{LOKET.location}</p>
            <p className="mt-6 max-w-md border-t border-sheet/20 pt-4 text-[13px] leading-relaxed text-sheet/75">
              <span className="font-bold text-sheet">Menemukan barang orang lain?</span> Serahkan langsung ke sini, petugas akan mencatatnya ke inventori.
            </p>
          </div>

          <div className="mt-8 lg:absolute lg:-left-[28%] lg:top-1/2 lg:mt-0 lg:w-[20rem] lg:-translate-y-1/2 lg:rotate-[-1.5deg] lg:rounded-md lg:border-2 lg:border-ink lg:bg-paper lg:p-6">
            <h2 className="text-2xl font-bold leading-[1.15] tracking-[-0.03em]">Kehilangan sesuatu hari ini?</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-2">Makin cepat datanya masuk, makin cepat dicocokkan dengan barang temuan terbaru.</p>
            <Button to="/lapor" variant="gold" className="mt-5">
              Laporkan sekarang
              <LuArrowRight aria-hidden="true" className="size-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Mobile CTA once the hero buttons scroll away */}
      <div
        inert={heroCtaVisible}
        className={`fixed inset-x-0 bottom-0 z-30 border-t-2 border-ink bg-paper px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 transition-transform duration-200 motion-reduce:transition-none sm:hidden ${heroCtaVisible ? 'translate-y-full' : 'translate-y-0'}`}
      >
        <div className="flex gap-3">
          <Button to="/lapor" variant="gold" className="flex-1">
            Mulai laporan
            <LuArrowRight aria-hidden="true" className="size-5" />
          </Button>
          <Button to="/track" variant="outline" className="w-12 px-0">
            <LuSearch aria-hidden="true" className="size-5" />
            <span className="sr-only">Lacak tiket</span>
          </Button>
        </div>
      </div>
    </div>
  )
}

function Arrow({ className = '' }) {
  return (
    <div aria-hidden="true" className={`flex text-ink-3 lg:justify-center ${className}`}>
      <LuArrowDown className="size-6 lg:hidden" />
      <LuArrowRight className="mt-3 hidden size-7 lg:block" />
    </div>
  )
}
