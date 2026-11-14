import React, { useEffect, useState } from 'react';
import { Check, Search, X, XCircle } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import type { AgendaRegistrationRecord, UserProfile } from '../../types/bimtek';
import { formatDateId } from '../../utils/formatters';

interface PicPortalProps {
  initialTab?: 'accounts' | 'bimtek';
}

export const PicPortal: React.FC<PicPortalProps> = ({ initialTab = 'accounts' }) => {
  const [tab, setTab] = useState<'accounts' | 'bimtek'>(initialTab);
  const [pesertaUsers, setPesertaUsers] = useState<UserProfile[]>([]);
  const [registrations, setRegistrations] = useState<AgendaRegistrationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [usersData, regsData] = await Promise.all([
        apiFetch<UserProfile[]>('/api/pic/users'),
        apiFetch<AgendaRegistrationRecord[]>('/api/admin/registrations'),
      ]);
      setPesertaUsers(usersData);
      setRegistrations(regsData);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data PIC.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleVerifyAccount = async (
    u: UserProfile,
    accountStatus: 'approved' | 'rejected'
  ) => {
    try {
      await apiFetch(`/api/pic/users/${u.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ accountStatus }),
      });
      setNotice(
        `Akun ${u.fullName} telah ${
          accountStatus === 'approved' ? 'diverifikasi & disetujui' : 'ditolak'
        }.`
      );
      await loadData(true);
    } catch (err: any) {
      setError(err.message || 'Gagal memperbarui status akun.');
    }
  };

  const handleApproveBimtek = async (
    reg: AgendaRegistrationRecord,
    status: 'approved' | 'rejected'
  ) => {
    try {
      await apiFetch(`/api/admin/registrations/${reg.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setNotice(
        `Kepesertaan ${reg.userName} pada ${reg.agendaTitle} telah ${
          status === 'approved' ? 'disetujui' : 'ditolak'
        }.`
      );
      await loadData(true);
    } catch (err: any) {
      setError(err.message || 'Gagal memperbarui persetujuan Bimtek.');
    }
  };

  const pendingAccounts = pesertaUsers.filter((u) => u.accountStatus === 'pending').length;
  const pendingRegs = registrations.filter((r) => r.status === 'pending').length;

  const filteredAccounts = pesertaUsers.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.lpseLocation.toLowerCase().includes(q)
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">
          Daftar User & Verifikasi PIC
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Verifikasi pendaftaran akun peserta baru dan setujui permohonan mengikuti agenda Bimtek.
        </p>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {error}
        </div>
      )}

      {notice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center justify-between">
          <span>{notice}</span>
          <button
            type="button"
            aria-label="Tutup pemberitahuan"
            onClick={() => setNotice('')}
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex p-1 bg-slate-200/70 rounded-md self-start">
          <button
            type="button"
            onClick={() => setTab('accounts')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
              tab === 'accounts'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Verifikasi Akun Baru ({pesertaUsers.length}
            {pendingAccounts > 0 ? ` · ${pendingAccounts} Menunggu` : ''})
          </button>
          <button
            type="button"
            onClick={() => setTab('bimtek')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
              tab === 'bimtek'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Persetujuan Peserta Bimtek ({registrations.length}
            {pendingRegs > 0 ? ` · ${pendingRegs} Menunggu` : ''})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            aria-label="Cari peserta"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama, LPSE, atau agenda..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-sm text-slate-500">Memuat data peserta...</div>
        ) : tab === 'accounts' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Nama Lengkap & Kontak</th>
                  <th className="py-3 px-4">Jabatan & Lokasi LPSE</th>
                  <th className="py-3 px-3">Tanggal Daftar</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Keputusan PIC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredAccounts.map((u) => (
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
                    <td className="py-3 px-3 text-xs text-slate-600 tabular-nums">
                      {formatDateId(u.createdAt)}
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
                      <div className="flex items-center justify-end gap-2">
                        {u.accountStatus !== 'approved' && (
                          <button
                            type="button"
                            aria-label={`Setujui akun ${u.fullName}`}
                            onClick={() => handleVerifyAccount(u, 'approved')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                        )}
                        {u.accountStatus !== 'rejected' && (
                          <button
                            type="button"
                            aria-label={`Tolak akun ${u.fullName}`}
                            onClick={() => handleVerifyAccount(u, 'rejected')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Tolak</span>
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
                  <th className="py-3 px-4">Peserta & LPSE</th>
                  <th className="py-3 px-4">Agenda Bimtek Dipilih</th>
                  <th className="py-3 px-3">Tanggal Pengajuan</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Approval Kelas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredRegs.map((reg) => (
                  <tr key={reg.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{reg.userName}</div>
                      <div className="text-xs text-slate-500">
                        {reg.userLpse || '-'} · {reg.userEmail}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <div className="font-medium text-slate-900">{reg.agendaTitle}</div>
                      <div className="text-slate-500">
                        {formatDateId(reg.agendaStartDate)} – {formatDateId(reg.agendaEndDate)} ·{' '}
                        {reg.agendaLocation}
                      </div>
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
                          : 'Menunggu Approval'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        {reg.status !== 'approved' && (
                          <button
                            type="button"
                            aria-label={`Setujui ${reg.userName} ikut ${reg.agendaTitle}`}
                            onClick={() => handleApproveBimtek(reg, 'approved')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Setujui Ikut</span>
                          </button>
                        )}
                        {reg.status !== 'rejected' && (
                          <button
                            type="button"
                            aria-label={`Tolak ${reg.userName} ikut ${reg.agendaTitle}`}
                            onClick={() => handleApproveBimtek(reg, 'rejected')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Tolak</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
