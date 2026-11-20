import { useRef, useState } from 'react';
import { Button } from './ui/Button';
import { INPUT_CLASS, LABEL_CLASS } from './ui/styles';
import { authenticateOfficer, DEMO_ACCOUNT } from '../services/auth';
import {
  LuEye,
  LuEyeOff,
  LuCircleAlert,
  LuInfo,
  LuShieldCheck,
  LuLock,
  LuArrowRight,
  LuLoaderCircle,
} from 'react-icons/lu';

export const AdminLoginPage = ({ onLoginSuccess, sessionNotice = '' }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const usernameRef = useRef(null);
  const passwordRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const nextErrors = {};
    if (!username.trim()) {
      nextErrors.username = 'Username petugas wajib diisi.';
    }
    if (!password) {
      nextErrors.password = 'Password wajib diisi.';
    }

    setFieldErrors(nextErrors);
    setAuthError('');

    if (nextErrors.username) {
      usernameRef.current?.focus();
      return;
    }
    if (nextErrors.password) {
      passwordRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      const officer = await authenticateOfficer({ username, password });
      onLoginSuccess(officer);
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Username atau password tidak sesuai. Periksa kembali kredensial petugas Anda.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFillDemo = () => {
    setUsername(DEMO_ACCOUNT.username);
    setPassword(DEMO_ACCOUNT.password);
    setFieldErrors({});
    setAuthError('');
  };

  return (
    <div className="min-h-svh bg-paper text-ink flex flex-col font-sans">
      <header className="on-ug bg-ug-950 text-sheet border-b border-ug-800 select-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="inline-flex items-center gap-2.5">
            <img
              src="/Logo%20Gunadarma.webp"
              alt="Logo Universitas Gunadarma"
              className="size-9 object-contain shrink-0"
            />
            <span className="text-[15px] font-bold tracking-tight text-sheet">
              UG Lost&nbsp;&amp;&nbsp;Found
            </span>
          </div>
          <span className="text-xs font-semibold text-ug-200">
            Akses Internal Petugas
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-10">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-[1.05fr_1.15fr] rounded-[5px] border-[1.5px] border-ink bg-sheet shadow-[4px_4px_0_var(--color-ink)] overflow-hidden">
          {/* Left Band: Institutional Context */}
          <div className="on-ug bg-ug-950 text-sheet p-7 sm:p-9 flex flex-col justify-between gap-8">
            <div className="space-y-5">
              <img
                src="/Logo%20Gunadarma.webp"
                alt="Logo Universitas Gunadarma"
                className="size-20 object-contain"
              />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gold">
                  Universitas Gunadarma
                </p>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-[-0.03em] text-sheet leading-tight mt-1.5">
                  Panel Petugas Loket
                </h1>
                <p className="text-sm text-ug-200 leading-relaxed mt-3">
                  Kelola antrean laporan kehilangan, pencocokan inventori fisik,
                  undangan verifikasi KTM, dan berita acara serah terima barang.
                </p>
              </div>
            </div>

            <div className="border-t border-ug-800 pt-5 space-y-2.5 text-xs text-ug-200">
              <div className="flex items-start gap-2.5">
                <LuShieldCheck
                  className="size-4 text-gold shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <span>Akses terbatas khusus petugas loket terotorisasi</span>
              </div>
              <div className="flex items-start gap-2.5">
                <LuLock
                  className="size-4 text-gold shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <span>
                  Seluruh mutasi status, verifikasi, dan serah terima tercatat pada audit trail
                </span>
              </div>
            </div>
          </div>

          {/* Right Form Sheet */}
          <div className="bg-sheet p-7 sm:p-9 flex flex-col justify-center">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-ink tracking-[-0.02em]">
                Masuk ke Panel
              </h2>
              <p className="text-sm text-ink-2 mt-1">
                Gunakan akun petugas loket Anda untuk memulai sesi kerja.
              </p>
            </div>

            {sessionNotice && !authError && (
              <div className="mb-5 rounded-sm border-[1.5px] border-ug-200 bg-ug-100 p-3 text-xs font-semibold text-ug-800 flex items-start gap-2">
                <LuInfo className="size-4 shrink-0 mt-0.5 text-ug-700" aria-hidden="true" />
                <span>{sessionNotice}</span>
              </div>
            )}

            {authError && (
              <div
                role="alert"
                className="mb-5 rounded-sm border-[1.5px] border-danger/40 bg-danger-wash p-3 text-xs font-semibold text-danger flex items-start gap-2"
              >
                <LuCircleAlert className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div>
                <label htmlFor="login-username" className={LABEL_CLASS}>
                  Username Petugas
                </label>
                <input
                  ref={usernameRef}
                  id="login-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (fieldErrors.username) {
                      setFieldErrors((prev) => ({ ...prev, username: '' }));
                    }
                    if (authError) setAuthError('');
                  }}
                  placeholder="Contoh: budi.santoso"
                  aria-invalid={fieldErrors.username ? true : undefined}
                  className={`${INPUT_CLASS} h-11 ${
                    fieldErrors.username ? 'border-danger' : ''
                  }`}
                />
                {fieldErrors.username && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-danger">
                    <LuCircleAlert className="size-4 shrink-0" aria-hidden="true" />
                    <span>{fieldErrors.username}</span>
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="login-password" className={LABEL_CLASS}>
                  Password
                </label>
                <div className="relative">
                  <input
                    ref={passwordRef}
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) {
                        setFieldErrors((prev) => ({ ...prev, password: '' }));
                      }
                      if (authError) setAuthError('');
                    }}
                    placeholder="Masukkan password akun"
                    aria-invalid={fieldErrors.password ? true : undefined}
                    className={`${INPUT_CLASS} h-11 pr-11 ${
                      fieldErrors.password ? 'border-danger' : ''
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-8 items-center justify-center rounded-sm text-ink-3 hover:text-ink hover:bg-paper transition-colors cursor-pointer"
                  >
                    {showPassword ? (
                      <LuEyeOff className="size-4" aria-hidden="true" />
                    ) : (
                      <LuEye className="size-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-danger">
                    <LuCircleAlert className="size-4 shrink-0" aria-hidden="true" />
                    <span>{fieldErrors.password}</span>
                  </p>
                )}
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="gold"
                  size="lg"
                  disabled={isSubmitting}
                  className="w-full"
                >
                  {isSubmitting ? (
                    <>
                      <LuLoaderCircle className="size-5 animate-spin" aria-hidden="true" />
                      <span>Memverifikasi...</span>
                    </>
                  ) : (
                    <>
                      <span>Masuk ke Panel</span>
                      <LuArrowRight className="size-5" aria-hidden="true" />
                    </>
                  )}
                </Button>
              </div>
            </form>

            <div className="mt-6 pt-4 border-t border-dotted border-line-strong">
              <div className="rounded-sm border border-line-strong bg-paper px-3.5 py-2.5 flex items-center justify-between gap-3 flex-wrap text-xs text-ink-2">
                <div className="tabular-nums">
                  <span className="font-bold text-ink">Akun demo:</span>{' '}
                  <span>{DEMO_ACCOUNT.username}</span> ·{' '}
                  <span>{DEMO_ACCOUNT.password}</span>
                </div>
                <Button variant="subtle" size="sm" onClick={handleFillDemo}>
                  Isi akun demo
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-line-strong bg-sheet/70">
        <div className="max-w-7xl mx-auto flex flex-col gap-2 px-4 sm:px-6 py-5 text-[13px] text-ink-3 md:flex-row md:items-baseline md:justify-between">
          <span className="font-bold text-ink">
            UG Lost &amp; Found — Panel Petugas Loket
          </span>
          <p>Layanan internal Universitas Gunadarma</p>
        </div>
      </footer>
    </div>
  );
};
