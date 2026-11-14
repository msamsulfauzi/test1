import React, { useEffect, useState } from 'react';
import { CheckCircle2, KeyRound, Save, UserCheck } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { LpseLocationItem, UserProfile } from '../types/bimtek';
import { LPSE_OTHER_OPTION, splitLpseValue } from '../utils/bimtekLogic';

interface ProfileSettingsProps {
  user: UserProfile;
  onUserUpdated: (updated: UserProfile) => void;
}

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({
  user,
  onUserUpdated,
}) => {
  const [lpseList, setLpseList] = useState<LpseLocationItem[]>([]);
  const [fullName, setFullName] = useState(user.fullName);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone || '');
  const [jabatan, setJabatan] = useState(user.jabatan || '');
  const [lpseLocation, setLpseLocation] = useState(user.lpseLocation || '');
  const [customLpseName, setCustomLpseName] = useState('');

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  useEffect(() => {
    setFullName(user.fullName);
    setEmail(user.email);
    setPhone(user.phone || '');
    setJabatan(user.jabatan || '');
  }, [user]);

  useEffect(() => {
    let active = true;
    apiFetch<LpseLocationItem[]>('/api/public/lpse')
      .then((list) => {
        if (!active) return;
        setLpseList(list);
        const names = list.map((l) => l.name);
        const { selectedOption, customLpseName: custom } = splitLpseValue(
          user.lpseLocation,
          names
        );
        setLpseLocation(user.lpseLocation ? selectedOption : names[0] || '');
        setCustomLpseName(custom);
      })
      .catch((err) => {
        console.error('Failed loading LPSE options:', err);
      });
    return () => {
      active = false;
    };
  }, [user.lpseLocation]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    setSavingProfile(true);
    try {
      const res = await apiFetch<{ user: UserProfile; message: string }>(
        '/api/auth/profile',
        {
          method: 'PUT',
          body: JSON.stringify({
            fullName,
            email,
            phone,
            jabatan,
            lpseLocation,
            customLpseName:
              lpseLocation === LPSE_OTHER_OPTION ? customLpseName : undefined,
          }),
        }
      );
      onUserUpdated(res.user);
      setProfileSuccess(res.message || 'Data profil berhasil diperbarui.');
    } catch (err: any) {
      setProfileError(err.message || 'Gagal memperbarui data profil.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword.length < 6) {
      setPasswordError('Password baru minimal 6 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Konfirmasi password baru tidak cocok.');
      return;
    }

    setSavingPassword(true);
    try {
      const res = await apiFetch<{
        ok: boolean;
        user: UserProfile;
        message: string;
      }>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: user.hasPassword !== false ? currentPassword : '',
          newPassword,
        }),
      });
      onUserUpdated(res.user);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess(res.message || 'Password akun berhasil diperbarui.');
    } catch (err: any) {
      setPasswordError(err.message || 'Gagal memperbarui password akun.');
    } finally {
      setSavingPassword(false);
    }
  };

  const roleLabel =
    user.role === 'pic'
      ? 'PIC Verifikasi'
      : user.role === 'admin'
      ? 'Admin Pengguna'
      : 'Peserta Bimtek';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">
          Update Data &amp; Keamanan Akun
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Perbarui informasi profil {roleLabel} Anda dan kelola password masuk portal.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Profil */}
        <form
          onSubmit={handleSaveProfile}
          className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6 space-y-4"
        >
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200">
            <UserCheck className="w-4 h-4 text-blue-700" />
            <h2 className="font-display text-base font-bold text-slate-900">
              Data Profil Pengguna
            </h2>
          </div>

          {profileError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
              {profileError}
            </div>
          )}

          {profileSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{profileSuccess}</span>
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="prof-name" className="block text-xs font-medium text-slate-700">
              Nama Lengkap
            </label>
            <input
              id="prof-name"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="prof-email" className="block text-xs font-medium text-slate-700">
                Alamat Email
              </label>
              <input
                id="prof-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="prof-phone" className="block text-xs font-medium text-slate-700">
                No. HP / WhatsApp
              </label>
              <input
                id="prof-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0812xxxxxxx"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="prof-jabatan" className="block text-xs font-medium text-slate-700">
              Jabatan
            </label>
            <input
              id="prof-jabatan"
              type="text"
              value={jabatan}
              onChange={(e) => setJabatan(e.target.value)}
              placeholder="Jabatan di instansi / LPSE"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="prof-lpse" className="block text-xs font-medium text-slate-700">
              Lokasi LPSE
            </label>
            <select
              id="prof-lpse"
              value={lpseLocation}
              onChange={(e) => {
                setLpseLocation(e.target.value);
                if (e.target.value !== LPSE_OTHER_OPTION) {
                  setCustomLpseName('');
                }
              }}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-700"
            >
              {lpseList.length === 0 && user.lpseLocation && (
                <option value={user.lpseLocation}>{user.lpseLocation}</option>
              )}
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
              <label htmlFor="prof-lpse-custom" className="block text-xs font-medium text-slate-700">
                Nama LPSE Lainnya
              </label>
              <input
                id="prof-lpse-custom"
                type="text"
                required
                value={customLpseName}
                onChange={(e) => setCustomLpseName(e.target.value)}
                placeholder="Tuliskan nama LPSE instansi Anda"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>
          )}

          <div className="pt-2 flex items-center justify-end">
            <button
              type="submit"
              disabled={savingProfile}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md whitespace-nowrap disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingProfile ? 'Menyimpan...' : 'Simpan Perubahan Data'}</span>
            </button>
          </div>
        </form>

        {/* Form Ubah Password */}
        <form
          onSubmit={handleChangePassword}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6 space-y-4"
        >
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200">
            <KeyRound className="w-4 h-4 text-blue-700" />
            <h2 className="font-display text-base font-bold text-slate-900">
              Update Password
            </h2>
          </div>

          {user.hasPassword === false && (
            <p className="text-xs text-slate-600 leading-relaxed">
              Akun ini masuk melalui Google dan belum memiliki password lokal. Anda dapat membuat password baru di bawah ini agar juga bisa masuk menggunakan email dan password.
            </p>
          )}

          {passwordError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
              {passwordError}
            </div>
          )}

          {passwordSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{passwordSuccess}</span>
            </div>
          )}

          {user.hasPassword !== false && (
            <div className="space-y-1">
              <label htmlFor="pw-current" className="block text-xs font-medium text-slate-700">
                Password Saat Ini
              </label>
              <input
                id="pw-current"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Masukkan password saat ini"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="pw-new" className="block text-xs font-medium text-slate-700">
              Password Baru (Minimal 6 karakter)
            </label>
            <input
              id="pw-new"
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="pw-confirm" className="block text-xs font-medium text-slate-700">
              Konfirmasi Password Baru
            </label>
            <input
              id="pw-confirm"
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ulangi password baru"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
          </div>

          <div className="pt-2 flex items-center justify-end">
            <button
              type="submit"
              disabled={savingPassword}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md whitespace-nowrap disabled:opacity-50"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{savingPassword ? 'Memproses...' : 'Perbarui Password'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
