import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  LogOut,
  MapPin,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { BimtekAgenda, LpseLocationItem, UserProfile } from '../types/bimtek';
import { LPSE_OTHER_OPTION } from '../utils/bimtekLogic';
import { formatDateId } from '../utils/formatters';
import { GoogleSignInButton } from './GoogleSignInButton';

interface AuthPortalProps {
  pendingUser: UserProfile | null;
  onAuthSuccess: (user: UserProfile, sessionToken?: string) => void;
  onGoogleLogin: () => Promise<void>;
  onLogout: () => void;
}

export const AuthPortal: React.FC<AuthPortalProps> = ({
  pendingUser,
  onAuthSuccess,
  onGoogleLogin,
  onLogout,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [agendas, setAgendas] = useState<BimtekAgenda[]>([]);
  const [lpseList, setLpseList] = useState<LpseLocationItem[]>([]);
  const [loadingPublic, setLoadingPublic] = useState(true);

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [submittingLogin, setSubmittingLogin] = useState(false);

  // Register state
  const [fullName, setFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [jabatan, setJabatan] = useState('');
  const [lpseLocation, setLpseLocation] = useState('');
  const [customLpseName, setCustomLpseName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  const [submittingReg, setSubmittingReg] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiFetch<BimtekAgenda[]>('/api/public/agendas'),
      apiFetch<LpseLocationItem[]>('/api/public/lpse'),
    ])
      .then(([ag, lp]) => {
        if (!active) return;
        setAgendas(ag);
        setLpseList(lp);
        if (lp.length > 0) setLpseLocation(lp[0].name);
      })
      .catch((err) => {
        console.error('Failed loading public portal info:', err);
      })
      .finally(() => {
        if (active) setLoadingPublic(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setSubmittingLogin(true);
    try {
      const res = await apiFetch<{ user: UserProfile; sessionToken: string }>(
        '/api/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ email: loginEmail, password: loginPassword }),
        }
      );
      onAuthSuccess(res.user, res.sessionToken);
    } catch (err: any) {
      setLoginError(err.message || 'Gagal masuk ke sistem.');
    } finally {
      setSubmittingLogin(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');
    setSubmittingReg(true);
    try {
      const res = await apiFetch<{ user: UserProfile; message: string }>(
        '/api/auth/register',
        {
          method: 'POST',
          body: JSON.stringify({
            fullName,
            email: regEmail,
            phone,
            jabatan,
            lpseLocation,
            customLpseName:
              lpseLocation === LPSE_OTHER_OPTION ? customLpseName : undefined,
            password: regPassword,
          }),
        }
      );
      setRegSuccess(res.message);
      setFullName('');
      setRegEmail('');
      setPhone('');
      setJabatan('');
      setCustomLpseName('');
      setRegPassword('');
    } catch (err: any) {
      setRegError(err.message || 'Gagal mendaftarkan peserta.');
    } finally {
      setSubmittingReg(false);
    }
  };


  if (pendingUser) {
    const isRejected = pendingUser.accountStatus === 'rejected';
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-8">
          <span className="font-display text-lg font-bold text-slate-900 whitespace-nowrap">
            Portal Bimtek LPSE
          </span>
          <div />
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar Akun</span>
          </button>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-lg p-8 space-y-5">
            <div className="flex items-center gap-3">
              {isRejected ? (
                <AlertCircle className="w-7 h-7 text-red-600 shrink-0" />
              ) : (
                <Clock className="w-7 h-7 text-amber-600 shrink-0" />
              )}
              <h1 className="font-display text-xl font-bold text-slate-900">
                {isRejected ? 'Pendaftaran Akun Ditolak' : 'Menunggu Verifikasi PIC'}
              </h1>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              {isRejected
                ? 'Mohon maaf, pendaftaran akun peserta Anda belum dapat disetujui oleh PIC. Silakan hubungi panitia atau administrator LPSE untuk informasi lebih lanjut.'
                : 'Akun peserta Anda sudah tercatat di sistem, namun belum dapat digunakan sebelum diverifikasi secara manual oleh akun PIC atau Admin Pengguna.'}
            </p>

            <div className="border-t border-slate-200 pt-4 text-sm space-y-2">
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Nama Lengkap</span>
                <span className="font-medium text-slate-900">{pendingUser.fullName}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Email</span>
                <span className="font-medium text-slate-900">{pendingUser.email}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Jabatan</span>
                <span className="font-medium text-slate-900">{pendingUser.jabatan || '-'}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Lokasi LPSE</span>
                <span className="font-medium text-slate-900">
                  {pendingUser.lpseLocation || '-'}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Status Verifikasi</span>
                <span
                  className={`font-semibold ${
                    isRejected ? 'text-red-700' : 'text-amber-700'
                  }`}
                >
                  {isRejected ? 'Ditolak' : 'Menunggu Verifikasi'}
                </span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onLogout}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md"
              >
                Kembali ke Halaman Masuk
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Bar: 3-zone contract */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            Portal Bimtek LPSE
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a
              href="#jadwal-bimtek"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Jadwal Bimtek
            </a>
            <a
              href="#alur-peserta"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Alur Pendaftaran
            </a>
            <button
              type="button"
              onClick={() => setMode('login')}
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Masuk
            </button>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setMode('register')}
              className="px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              Daftar Peserta
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10 space-y-12">
        {/* Hero Split */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-medium text-blue-700">
                Sistem Manajemen Bimbingan Teknis Terpadu
              </p>
              <h1
                className="font-display text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight leading-tight max-w-2xl"
                style={{ textWrap: 'balance' }}
              >
                Portal Penyelenggaraan Bimtek, Verifikasi PIC, dan Ruang Kelas Digital
              </h1>
              <p className="text-base text-slate-600 max-w-2xl leading-relaxed">
                Kelola jadwal bimbingan teknis, verifikasi pendaftaran peserta oleh PIC,
                absensi harian sesuai tanggal sistem, pre-test & post-test berbobot,
                penilaian narasumber, hingga arsip otomatis ke Google Drive dan Google Sheets.
              </p>
            </div>

            {/* Alur Pendaftaran */}
            <div
              id="alur-peserta"
              className="bg-white border border-slate-200 rounded-lg p-6 space-y-4"
            >
              <h2 className="font-display text-base font-semibold text-slate-900">
                Alur Akses Peserta Bimtek
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-medium text-slate-900">
                    <UserCheck className="w-4 h-4 text-blue-700" />
                    <span>1. Registrasi & Verifikasi</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Peserta mendaftar lalu menunggu persetujuan akun secara manual oleh PIC.
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-medium text-slate-900">
                    <Calendar className="w-4 h-4 text-blue-700" />
                    <span>2. Pilih Agenda Terbuka</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Pilih kegiatan selama masa pendaftaran dibuka dan tunggu persetujuan kelas PIC.
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-medium text-slate-900">
                    <ShieldCheck className="w-4 h-4 text-blue-700" />
                    <span>3. Masuk Ruang Bimtek</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Ikuti absensi harian, upload komitmen & tugas ke Google Drive, tes, dan evaluasi.
                  </p>
                </div>
              </div>
            </div>

            {/* Jadwal Bimtek Terbuka */}
            <div id="jadwal-bimtek" className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  Jadwal Kegiatan Bimtek
                </h2>
                <span className="text-xs text-slate-500 tabular-nums">
                  {agendas.length} agenda tersedia
                </span>
              </div>

              {loadingPublic ? (
                <div className="bg-white border border-slate-200 rounded-lg p-6 text-sm text-slate-500">
                  Memuat jadwal Bimtek...
                </div>
              ) : agendas.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-lg p-6 text-sm text-slate-500">
                  Belum ada jadwal Bimtek yang dipublikasikan.
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
                  {agendas.map((ag) => (
                    <div key={ag.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1.5 min-w-0">
                        <div className="font-display font-semibold text-slate-900">
                          {ag.title}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {formatDateId(ag.startDate)} – {formatDateId(ag.endDate)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            {ag.location}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 tabular-nums">
                          Pendaftaran: {formatDateId(ag.registrationOpenAt)} –{' '}
                          {formatDateId(ag.registrationCloseAt)}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <span
                          className={`text-xs font-semibold ${
                            ag.registrationOpen ? 'text-emerald-700' : 'text-slate-500'
                          }`}
                        >
                          {ag.registrationOpen ? 'Pendaftaran Dibuka' : 'Pendaftaran Ditutup'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Login / Register Form */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
              {/* Segmented switcher */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-md">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className={`py-2 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
                    mode === 'login'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Masuk Akun
                </button>
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className={`py-2 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
                    mode === 'register'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Daftar Peserta Baru
                </button>
              </div>

              {mode === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      Masuk Portal Bimtek
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Gunakan email dan password untuk Admin Pengguna, PIC, atau Peserta.
                    </p>
                  </div>

                  {loginError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
                      {loginError}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label htmlFor="login-email" className="block text-xs font-medium text-slate-700">
                      Alamat Email
                    </label>
                    <input
                      id="login-email"
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="nama@lpse.go.id"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-blue-700"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="login-password" className="block text-xs font-medium text-slate-700">
                      Password
                    </label>
                    <input
                      id="login-password"
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Masukkan password"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-blue-700"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingLogin}
                    className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors disabled:opacity-60"
                  >
                    {submittingLogin ? 'Memproses...' : 'Masuk ke Portal'}
                  </button>

                  <div className="pt-2 border-t border-slate-200 flex flex-col items-center gap-2">
                    <span className="text-xs text-slate-500">atau masuk dengan akun Google</span>
                    <GoogleSignInButton onClick={onGoogleLogin} label="Sign in with Google" />
                  </div>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-3.5">
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      Registrasi Peserta Baru
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Setelah mendaftar, akun akan diverifikasi manual oleh PIC sebelum dapat memilih agenda.
                    </p>
                  </div>

                  {regError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
                      {regError}
                    </div>
                  )}

                  {regSuccess && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                      <span>{regSuccess}</span>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label htmlFor="reg-name" className="block text-xs font-medium text-slate-700">
                      Nama Lengkap
                    </label>
                    <input
                      id="reg-name"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Contoh: Ahmad Hidayat"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label htmlFor="reg-email" className="block text-xs font-medium text-slate-700">
                        Email
                      </label>
                      <input
                        id="reg-email"
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="email@instansi.go.id"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="reg-phone" className="block text-xs font-medium text-slate-700">
                        No. HP / WhatsApp
                      </label>
                      <input
                        id="reg-phone"
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="0812xxxxxxx"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="reg-jabatan" className="block text-xs font-medium text-slate-700">
                      Jabatan
                    </label>
                    <input
                      id="reg-jabatan"
                      type="text"
                      required
                      value={jabatan}
                      onChange={(e) => setJabatan(e.target.value)}
                      placeholder="Contoh: Verifikator LPSE / Pengelola PBJ"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="reg-lpse" className="block text-xs font-medium text-slate-700">
                      Lokasi LPSE
                    </label>
                    <select
                      id="reg-lpse"
                      required
                      value={lpseLocation}
                      onChange={(e) => {
                        setLpseLocation(e.target.value);
                        if (e.target.value !== LPSE_OTHER_OPTION) {
                          setCustomLpseName('');
                        }
                      }}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-700"
                    >
                      {lpseList.map((item) => (
                        <option key={item.id} value={item.name}>
                          {item.name}
                        </option>
                      ))}
                      <option value={LPSE_OTHER_OPTION}>LPSE Lainnya</option>
                    </select>
                  </div>

                  {lpseLocation === LPSE_OTHER_OPTION && (
                    <div className="space-y-1">
                      <label htmlFor="reg-lpse-custom" className="block text-xs font-medium text-slate-700">
                        Nama LPSE Lainnya
                      </label>
                      <input
                        id="reg-lpse-custom"
                        type="text"
                        required
                        value={customLpseName}
                        onChange={(e) => setCustomLpseName(e.target.value)}
                        placeholder="Tuliskan nama LPSE instansi Anda"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700"
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <label htmlFor="reg-password" className="block text-xs font-medium text-slate-700">
                      Password Akun
                    </label>
                    <input
                      id="reg-password"
                      type="password"
                      required
                      minLength={6}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingReg}
                    className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors disabled:opacity-60"
                  >
                    {submittingReg ? 'Mendaftarkan...' : 'Daftar Akun Peserta'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
