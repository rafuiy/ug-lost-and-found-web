import { useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { LOKET } from '../../config/site'

export function Wordmark({ className = '' }) {
  return (
    <Link to="/" className={`inline-flex items-center gap-2 rounded-sm text-[15px] font-bold tracking-tight ${className}`}>
      <span className="rounded-[3px] bg-gold px-1.5 py-0.5 text-ug-950">UG</span>
      <span>Lost&nbsp;&amp;&nbsp;Found</span>
    </Link>
  )
}

function useScrollOnNavigate() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
    else window.scrollTo(0, 0)
  }, [pathname, hash])
}

export function SiteLayout() {
  useScrollOnNavigate()
  const { pathname } = useLocation()
  const onTrack = pathname.startsWith('/track')

  return (
    <div className="flex min-h-svh flex-col">
      <a href="#konten" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-gold focus:px-4 focus:py-2 focus:font-bold focus:text-ug-950">
        Lewati ke konten
      </a>

      <header className="on-ug bg-ug-800 text-sheet">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-5 sm:px-8">
          <Wordmark />
          <nav aria-label="Navigasi utama" className="ml-auto flex items-center gap-1 text-sm font-semibold sm:gap-3">
            <Link
              to="/track"
              aria-current={onTrack ? 'page' : undefined}
              className="rounded-sm px-2 py-2 text-sheet/80 hover:text-sheet aria-[current=page]:text-gold"
            >
              Lacak<span className="max-sm:hidden"> tiket</span>
            </Link>
            {pathname !== '/lapor' && (
              <Link to="/lapor" className="rounded-[5px] border-[1.5px] border-sheet/60 whitespace-nowrap px-3 py-1.5 text-sheet hover:border-gold hover:text-gold">
                <span className="sm:hidden">Lapor</span><span className="max-sm:hidden">Buat laporan</span>
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main id="konten" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t-2 border-ink">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-6 text-[13px] text-ink-3 sm:px-8 md:flex-row md:items-baseline md:gap-10">
          <Wordmark className="text-ink" />
          <p className="md:max-w-md">{LOKET.name}, {LOKET.location}. {LOKET.hours}.</p>
          <p className="md:ml-auto">Layanan internal Universitas Gunadarma</p>
        </div>
      </footer>
    </div>
  )
}
