import React, { useEffect, useState } from 'react';
import {
  Check,
  KeyRound,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import type {
  AccountStatus,
  AgendaRegistrationRecord,
  LpseLocationItem,
  UserProfile,
  UserRole,
} from '../../types/bimtek';
import { LPSE_OTHER_OPTION, splitLpseValue } from '../../utils/bimtekLogic';
import { formatDateId } from '../../utils/formatters';

interface AdminUsersProps {
  currentUserId?: number;
  onCurrentUserUpdated?: (user: UserProfile) => void;
}

export const AdminUsers: React.FC<AdminUsersProps> = ({
  currentUserId,
  onCurrentUserUpdated,
}) => {
  const [tab, setTab] = useState<'users' | 'registrations'>('users');
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [registrations, setRegistrations] = useState<AgendaRegistrationRecord[]>([]);
  const [lpseList, setLpseList] = useState<LpseLocationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [bannerMsg, setBannerMsg] = useState('');

  // Add User Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newJabatan, setNewJabatan] = useState('');
  const [newLpse, setNewLpse] = useState('');
  const [newCustomLpse, setNewCustomLpse] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'pic' | 'peserta'>('pic');
  const [newPassword, setNewPassword] = useState('');
  const [savingUser, setSavingUser] = useState(false);

  // Reset Password Modal
  const [resetTarget, setResetTarget] = useState<UserProfile | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetting, setResetting] = useState(false);

  // Edit User Modal
  const [editTarget, setEditTarget] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editJabatan, setEditJabatan] = useState('');
  const [editLpse, setEditLpse] = useState('');
  const [editCustomLpse, setEditCustomLpse] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('peserta');
  const [editStatus, setEditStatus] = useState<AccountStatus>('approved');
  const [updatingUser, setUpdatingUser] = useState(false);

  // Delete User Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [u, r, l] = await Promise.all([
        apiFetch<UserProfile[]>('/api/admin/users'),
        apiFetch<AgendaRegistrationRecord[]>('/api/admin/registrations'),
        apiFetch<LpseLocationItem[]>('/api/admin/lpse'),
      ]);
      setUsersList(u);
      setRegistrations(r);
      setLpseList(l);
      if (l.length > 0 && !newLpse) setNewLpse(l[0].name);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data user.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingUser(true);
    setError('');
    try {
      await apiFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          fullName: newName,
          email: newEmail,
          phone: newPhone,
          jabatan: newJabatan,
          lpseLocation: newLpse,
          customLpseName:
            newLpse === LPSE_OTHER_OPTION ? newCustomLpse : undefined,
          role: newRole,
          password: newPassword,
          accountStatus: 'approved',
        }),
      });
      setShowAddModal(false);
      setNewName('');
      setNewEmail('');
      setNewPhone('');
      setNewJabatan('');
      setNewCustomLpse('');
      setNewPassword('');
      setBannerMsg('User baru berhasil ditambahkan.');
      await loadData(true);
    } catch (err: any) {
      setError(err.message || 'Gagal menambahkan user.');
    } finally {
      setSavingUser(false);
    }
  };

  const handleUserStatus = async (
    u: UserProfile,
    accountStatus: 'approved' | 'rejected'
  ) => {
    try {
      await apiFetch(`/api/admin/users/${u.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ accountStatus }),
      });
      setBannerMsg(
        `Status akun ${u.fullName} diubah menjadi ${
          accountStatus === 'approved' ? 'Terverifikasi' : 'Ditolak'
        }.`
      );
      await loadData(true);
    } catch (err: any) {
      setError(err.message || 'Gagal mengubah status akun.');
    }
  };

  const handleRegistrationStatus = async (
    reg: AgendaRegistrationRecord,
    status: 'approved' | 'rejected'
  ) => {
    try {
      await apiFetch(`/api/admin/registrations/${reg.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setBannerMsg(
        `Pendaftaran ${reg.userName} pada ${reg.agendaTitle} ${
          status === 'approved' ? 'disetujui' : 'ditolak'
        }.`
      );
      await loadData(true);
    } catch (err: any) {
      setError(err.message || 'Gagal memperbarui persetujuan Bimtek.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    setResetting(true);
    setError('');
    try {
      await apiFetch(`/api/admin/users/${resetTarget.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword: resetPasswordValue }),
      });
      setBannerMsg(`Password untuk ${resetTarget.fullName} berhasil direset.`);
      setResetTarget(null);
      setResetPasswordValue('');
    } catch (err: any) {
      setError(err.message || 'Gagal mereset password.');
    } finally {
      setResetting(false);
    }
  };

  const openEditModal = (u: UserProfile) => {
    const knownNames = lpseList.map((l) => l.name);
    const { selectedOption, customLpseName } = splitLpseValue(
      u.lpseLocation,
      knownNames
    );
    setEditTarget(u);
    setEditName(u.fullName);
    setEditEmail(u.email);
    setEditPhone(u.phone || '');
    setEditJabatan(u.jabatan || '');
    setEditLpse(u.lpseLocation ? selectedOption : knownNames[0] || '');
    setEditCustomLpse(customLpseName);
    setEditRole(u.role);
    setEditStatus(u.accountStatus);
    setError('');
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setUpdatingUser(true);
    setError('');
    try {
      const updated = await apiFetch<UserProfile>(
        `/api/admin/users/${editTarget.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            fullName: editName,
            email: editEmail,
            phone: editPhone,
            jabatan: editJabatan,
            lpseLocation: editLpse,
            customLpseName:
              editLpse === LPSE_OTHER_OPTION ? editCustomLpse : undefined,
            role: editRole,
            accountStatus: editStatus,
          }),
        }
      );
      if (currentUserId && updated.id === currentUserId && onCurrentUserUpdated) {
        onCurrentUserUpdated(updated);
      }
      setBannerMsg(`Data user ${updated.fullName} berhasil diperbarui.`);
      setEditTarget(null);
      await loadData(true);
    } catch (err: any) {
      setError(err.message || 'Gagal memperbarui data user.');
    } finally {
      setUpdatingUser(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setDeletingUser(true);
    setError('');
    try {
      const res = await apiFetch<{ ok: boolean; message: string }>(
        `/api/admin/users/${deleteTarget.id}`,
        { method: 'DELETE' }
      );
      setBannerMsg(res.message || `User ${deleteTarget.fullName} berhasil dihapus.`);
      setDeleteTarget(null);
      await loadData(true);
    } catch (err: any) {
      setError(err.message || 'Gagal menghapus user.');
    } finally {
      setDeletingUser(false);
    }
  };

  const filteredUsers = usersList.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.lpseLocation.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  const filteredRegs = registrations.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.userName.toLowerCase().includes(q) ||
      r.userEmail.toLowerCase().includes(q) ||
      r.agendaTitle.toLowerCase().includes(q)
    );
  });

  const pendingUsersCount = usersList.filter((u) => u.accountStatus === 'pending').length;
  const pendingRegsCount = registrations.filter((r) => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Daftar User & Persetujuan Bimtek
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Tambah akses Admin/PIC/Peserta, verifikasi akun pendaftar, reset password, dan setujui kepesertaan kelas.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md whitespace-nowrap shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Tambah Akses User</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {error}
        </div>
      )}

      {bannerMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center justify-between">
          <span>{bannerMsg}</span>
          <button
            type="button"
            onClick={() => setBannerMsg('')}
            aria-label="Tutup notifikasi"
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Segmented Tabs + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex p-1 bg-slate-200/70 rounded-md self-start">
          <button
            type="button"
            onClick={() => setTab('users')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
              tab === 'users'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Daftar Akun User ({usersList.length}
            {pendingUsersCount > 0 ? ` · ${pendingUsersCount} Menunggu` : ''})
          </button>
          <button
            type="button"
            onClick={() => setTab('registrations')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
              tab === 'registrations'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Persetujuan Agenda Bimtek ({registrations.length}
            {pendingRegsCount > 0 ? ` · ${pendingRegsCount} Menunggu` : ''})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            aria-label="Cari user atau agenda"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama, email, LPSE..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700"
          />
        </div>
      </div>

      {/* Table Content */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-sm text-slate-500">Memuat data user...</div>
        ) : tab === 'users' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Nama & Kontak</th>
                  <th className="py-3 px-4">Jabatan & LPSE</th>
                  <th className="py-3 px-3">Level</th>
                  <th className="py-3 px-3">Status Akun</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{u.fullName}</div>
                      <div className="text-xs text-slate-500 font-mono-tabular">
                        {u.email} {u.phone ? `· ${u.phone}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      <div className="text-slate-900">{u.jabatan || '-'}</div>
                      <div>{u.lpseLocation || '-'}</div>
                    </td>
                    <td className="py-3 px-3 text-xs font-medium text-slate-700 capitalize">
                      {u.role === 'admin'
                        ? 'Admin Pengguna'
                        : u.role === 'pic'
                        ? 'PIC'
                        : 'Peserta'}
                    </td>
                    <td className="py-3 px-3 text-xs font-semibold">
                      <span
                        className={
                          u.accountStatus === 'approved'
                            ? 'text-emerald-700'
                            : u.accountStatus === 'rejected'
                            ? 'text-red-700'
                            : 'text-amber-700'
                        }
                      >
                        {u.accountStatus === 'approved'
                          ? 'Terverifikasi'
                          : u.accountStatus === 'rejected'
                          ? 'Ditolak'
                          : 'Menunggu Verifikasi'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {u.accountStatus !== 'approved' && (
                          <button
                            type="button"
                            aria-label={`Setujui akun ${u.fullName}`}
                            onClick={() => handleUserStatus(u, 'approved')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded whitespace-nowrap"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Setujui</span>
                          </button>
                        )}
                        {u.accountStatus === 'pending' && (
                          <button
                            type="button"
                            aria-label={`Tolak akun ${u.fullName}`}
                            onClick={() => handleUserStatus(u, 'rejected')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded whitespace-nowrap"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Tolak</span>
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label={`Ubah data ${u.fullName}`}
                          onClick={() => openEditModal(u)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded whitespace-nowrap"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Ubah</span>
                        </button>
                        <button
                          type="button"
                          aria-label={`Reset password ${u.fullName}`}
                          onClick={() => {
                            setResetTarget(u);
                            setResetPasswordValue('');
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded whitespace-nowrap"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Password</span>
                        </button>
                        {u.id !== currentUserId && (
                          <button
                            type="button"
                            aria-label={`Hapus user ${u.fullName}`}
                            onClick={() => setDeleteTarget(u)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded whitespace-nowrap"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Peserta</th>
                  <th className="py-3 px-4">Agenda Bimtek</th>
                  <th className="py-3 px-3">Tanggal Daftar</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredRegs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 px-4 text-center text-sm text-slate-500">
                      Belum ada pendaftaran peserta ke agenda Bimtek.
                    </td>
                  </tr>
                ) : (
                  filteredRegs.map((reg) => (
                    <tr key={reg.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{reg.userName}</div>
                        <div className="text-xs text-slate-500">
                          {reg.userLpse || '-'} · {reg.userEmail}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700">
                        <div className="font-medium text-slate-900">{reg.agendaTitle}</div>
                        <div className="text-slate-500">{reg.agendaLocation}</div>
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-600 tabular-nums">
                        {formatDateId(reg.createdAt)}
                      </td>
                      <td className="py-3 px-3 text-xs font-semibold">
                        <span
                          className={
                            reg.status === 'approved'
                              ? 'text-emerald-700'
                              : reg.status === 'rejected'
                              ? 'text-red-700'
                              : 'text-amber-700'
                          }
                        >
                          {reg.status === 'approved'
                            ? 'Disetujui'
                            : reg.status === 'rejected'
                            ? 'Ditolak'
                            : 'Menunggu PIC'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          {reg.status !== 'approved' && (
                            <button
                              type="button"
                              aria-label={`Setujui ${reg.userName} mengikuti ${reg.agendaTitle}`}
                              onClick={() => handleRegistrationStatus(reg, 'approved')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Setujui</span>
                            </button>
                          )}
                          {reg.status !== 'rejected' && (
                            <button
                              type="button"
                              aria-label={`Tolak ${reg.userName} mengikuti ${reg.agendaTitle}`}
                              onClick={() => handleRegistrationStatus(reg, 'rejected')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Tolak</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-user-title"
            className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 id="add-user-title" className="font-display text-lg font-bold text-slate-900">
                Tambah Akses User Baru
              </h2>
              <button
                type="button"
                aria-label="Tutup dialog tambah user"
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="u-name" className="block text-xs font-medium text-slate-700">
                  Nama Lengkap
                </label>
                <input
                  id="u-name"
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="u-email" className="block text-xs font-medium text-slate-700">
                    Email
                  </label>
                  <input
                    id="u-email"
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="u-role" className="block text-xs font-medium text-slate-700">
                    Level User
                  </label>
                  <select
                    id="u-role"
                    value={newRole}
                    onChange={(e) =>
                      setNewRole(e.target.value as 'admin' | 'pic' | 'peserta')
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    <option value="admin">Admin Pengguna</option>
                    <option value="pic">PIC</option>
                    <option value="peserta">Peserta</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="u-phone" className="block text-xs font-medium text-slate-700">
                    No. HP
                  </label>
                  <input
                    id="u-phone"
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="u-jabatan" className="block text-xs font-medium text-slate-700">
                    Jabatan
                  </label>
                  <input
                    id="u-jabatan"
                    type="text"
                    value={newJabatan}
                    onChange={(e) => setNewJabatan(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="u-lpse" className="block text-xs font-medium text-slate-700">
                  Lokasi LPSE
                </label>
                <select
                  id="u-lpse"
                  value={newLpse}
                  onChange={(e) => {
                    setNewLpse(e.target.value);
                    if (e.target.value !== LPSE_OTHER_OPTION) {
                      setNewCustomLpse('');
                    }
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                >
                  {lpseList.map((l) => (
                    <option key={l.id} value={l.name}>
                      {l.name}
                    </option>
                  ))}
                  <option value={LPSE_OTHER_OPTION}>LPSE Lainnya</option>
                </select>
              </div>

              {newLpse === LPSE_OTHER_OPTION && (
                <div className="space-y-1">
                  <label htmlFor="u-lpse-custom" className="block text-xs font-medium text-slate-700">
                    Nama LPSE Lainnya
                  </label>
                  <input
                    id="u-lpse-custom"
                    type="text"
                    required
                    value={newCustomLpse}
                    onChange={(e) => setNewCustomLpse(e.target.value)}
                    placeholder="Tuliskan nama LPSE"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label htmlFor="u-pass" className="block text-xs font-medium text-slate-700">
                  Password Awal
                </label>
                <input
                  id="u-pass"
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{savingUser ? 'Menyimpan...' : 'Simpan User'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-pass-title"
            className="bg-white border border-slate-200 rounded-lg max-w-sm w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 id="reset-pass-title" className="font-display text-base font-bold text-slate-900">
                Reset Password User
              </h2>
              <button
                type="button"
                aria-label="Tutup dialog reset password"
                onClick={() => setResetTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Atur password baru untuk <strong>{resetTarget.fullName}</strong> ({resetTarget.email}).
            </p>
            <form onSubmit={handleResetPassword} className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="new-pw-input" className="block text-xs font-medium text-slate-700">
                  Password Baru (Minimal 6 karakter)
                </label>
                <input
                  id="new-pw-input"
                  type="password"
                  required
                  minLength={6}
                  value={resetPasswordValue}
                  onChange={(e) => setResetPasswordValue(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetTarget(null)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-md"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={resetting}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md disabled:opacity-50"
                >
                  {resetting ? 'Menyimpan...' : 'Simpan Password Baru'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-user-title"
            className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h2 id="edit-user-title" className="font-display text-lg font-bold text-slate-900">
                Ubah Data User
              </h2>
              <button
                type="button"
                aria-label="Tutup dialog ubah user"
                onClick={() => setEditTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="eu-name" className="block text-xs font-medium text-slate-700">
                  Nama Lengkap
                </label>
                <input
                  id="eu-name"
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="eu-email" className="block text-xs font-medium text-slate-700">
                  Email
                </label>
                <input
                  id="eu-email"
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="eu-role" className="block text-xs font-medium text-slate-700">
                    Level User
                  </label>
                  <select
                    id="eu-role"
                    value={editRole}
                    disabled={editTarget.id === currentUserId}
                    onChange={(e) => setEditRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white disabled:bg-slate-100"
                  >
                    <option value="admin">Admin Pengguna</option>
                    <option value="pic">PIC</option>
                    <option value="peserta">Peserta</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="eu-status" className="block text-xs font-medium text-slate-700">
                    Status Akun
                  </label>
                  <select
                    id="eu-status"
                    value={editStatus}
                    disabled={editTarget.id === currentUserId}
                    onChange={(e) => setEditStatus(e.target.value as AccountStatus)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white disabled:bg-slate-100"
                  >
                    <option value="approved">Terverifikasi</option>
                    <option value="pending">Menunggu Verifikasi</option>
                    <option value="rejected">Ditolak</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="eu-phone" className="block text-xs font-medium text-slate-700">
                    No. HP
                  </label>
                  <input
                    id="eu-phone"
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="eu-jabatan" className="block text-xs font-medium text-slate-700">
                    Jabatan
                  </label>
                  <input
                    id="eu-jabatan"
                    type="text"
                    value={editJabatan}
                    onChange={(e) => setEditJabatan(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="eu-lpse" className="block text-xs font-medium text-slate-700">
                  Lokasi LPSE
                </label>
                <select
                  id="eu-lpse"
                  value={editLpse}
                  onChange={(e) => {
                    setEditLpse(e.target.value);
                    if (e.target.value !== LPSE_OTHER_OPTION) {
                      setEditCustomLpse('');
                    }
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                >
                  {lpseList.map((l) => (
                    <option key={l.id} value={l.name}>
                      {l.name}
                    </option>
                  ))}
                  <option value={LPSE_OTHER_OPTION}>LPSE Lainnya</option>
                </select>
              </div>

              {editLpse === LPSE_OTHER_OPTION && (
                <div className="space-y-1">
                  <label htmlFor="eu-lpse-custom" className="block text-xs font-medium text-slate-700">
                    Nama LPSE Lainnya
                  </label>
                  <input
                    id="eu-lpse-custom"
                    type="text"
                    required
                    value={editCustomLpse}
                    onChange={(e) => setEditCustomLpse(e.target.value)}
                    placeholder="Tuliskan nama LPSE"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={updatingUser}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md disabled:opacity-50"
                >
                  {updatingUser ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-user-title"
            className="bg-white border border-slate-200 rounded-lg max-w-sm w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 id="delete-user-title" className="font-display text-base font-bold text-slate-900">
                Hapus Akun User
              </h2>
              <button
                type="button"
                aria-label="Tutup konfirmasi hapus user"
                onClick={() => setDeleteTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus akun{' '}
              <strong className="text-slate-900">{deleteTarget.fullName}</strong> ({deleteTarget.email})? Seluruh data pendaftaran kelas, absensi, nilai tes, dan evaluasi milik user ini juga akan dihapus permanen.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deletingUser}
                onClick={handleDeleteUser}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50"
              >
                {deletingUser ? 'Menghapus...' : 'Ya, Hapus User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
