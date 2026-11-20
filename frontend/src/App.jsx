import { Route, Routes } from 'react-router'
import { SiteLayout } from './components/layout/SiteLayout'
import { Button } from './components/ui/Button'
import { LandingPage } from './pages/LandingPage'
import { ReportPage } from './pages/ReportPage'
import { TrackPage } from './pages/TrackPage'

function NotFoundPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 sm:px-6">
      <p className="text-sm font-semibold text-ink-3">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">Halaman ini tidak ada</h1>
      <p className="mt-3 text-ink-2">Mungkin tautannya salah ketik. Mau melapor atau melacak?</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button to="/lapor">Buat laporan</Button>
        <Button to="/track" variant="outline">Lacak laporan</Button>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="lapor" element={<ReportPage />} />
        <Route path="track" element={<TrackPage />} />
        <Route path="track/:ticketCode" element={<TrackPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
