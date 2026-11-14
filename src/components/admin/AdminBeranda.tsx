import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  RefreshCw,
  X,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import type {
  AgendaRekapRow,
  ParticipantRekapDetail,
  SheetSyncLogItem,
} from '../../types/bimtek';
import { formatDateId, formatDateTimeId } from '../../utils/formatters';
import { GoogleSignInButton } from '../GoogleSignInButton';

interface AdminBerandaProps {
  googleConnected: boolean;
  onConnectGoogle: () => Promise<void>;
}

export const AdminBeranda: React.FC<AdminBerandaProps> = ({
  googleConnected,
  onConnectGoogle,
}) => {
  const [agendaRekap, setAgendaRekap] = useState<AgendaRekapRow[]>([]);
  const [participantDetails, setParticipantDetails] = useState<ParticipantRekapDetail[]>([]);
  const [syncLogs, setSyncLogs] = useState<SheetSyncLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'agenda' | 'peserta'>('agenda');

  // Google Sheets Sync confirmation dialog state
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [sheetTitle, setSheetTitle] = useState('');
  const [existingSpreadsheetId, setExistingSpreadsheetId] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SheetSyncLogItem | null>(null);
  const [syncError, setSyncError] = useState('');

  const loadRekap = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<{
        agendaRekap: AgendaRekapRow[];
        participantDetails: ParticipantRekapDetail[];
        syncLogs: SheetSyncLogItem[];
      }>('/api/admin/rekap');
      setAgendaRekap(data.agendaRekap);
      setParticipantDetails(data.participantDetails);
      setSyncLogs(data.syncLogs || []);
      if (data.syncLogs?.[0] && !existingSpreadsheetId) {
        setExistingSpreadsheetId(data.syncLogs[0].spreadsheetId);
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memuat rekap Bimtek.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRekap();
  }, []);

  const totalPendaftar = agendaRekap.reduce((s, r) => s + r.totalRegistrants, 0);
  const totalDiterima = agendaRekap.reduce((s, r) => s + r.approvedParticipants, 0);
  const totalAbsen = agendaRekap.reduce(
    (s, r) => s + r.day1Attendance + r.day2Attendance + r.day3Attendance,
    0
  );
  const avgPreAll = (() => {
    const valid = agendaRekap.filter((r) => r.avgPretest !== null);
    if (valid.length === 0) return '-';
    return Math.round(
      valid.reduce((s, r) => s + (r.avgPretest || 0), 0) / valid.length
    );
  })();
  const avgPostAll = (() => {
    const valid = agendaRekap.filter((r) => r.avgPosttest !== null);
    if (valid.length === 0) return '-';
    return Math.round(
      valid.reduce((s, r) => s + (r.avgPosttest || 0), 0) / valid.length
    );
  })();

  const handleConfirmSync = async () => {
    setSyncError('');
    setSyncing(true);
    try {
      const res = await apiFetch<{
        ok: boolean;
        syncLog: SheetSyncLogItem;
        rekapRowCount: number;
        detailRowCount: number;
      }>('/api/admin/sheets-sync', {
        method: 'POST',
        body: JSON.stringify({
          title: sheetTitle.trim() || undefined,
          spreadsheetId: existingSpreadsheetId.trim() || undefined,
        }),
      });
      setSyncResult(res.syncLog);
      await loadRekap();
    } catch (err: any) {
      setSyncError(err.message || 'Gagal menyinkronkan ke Google Sheets.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Heading & Primary CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Rekapitulasi Penyelenggaraan Bimtek
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Ringkasan jadwal Bimtek, jumlah pendaftar, persetujuan peserta, absensi harian, dan nilai tes.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={loadRekap}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Muat Ulang</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSyncResult(null);
              setSyncError('');
              setShowSyncModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Sync ke Google Sheets</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs text-slate-500">Total Agenda</div>
          <div className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
            {agendaRekap.length}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs text-slate-500">Total Pendaftar</div>
          <div className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
            {totalPendaftar}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs text-slate-500">Peserta Diterima</div>
          <div className="mt-1 font-display text-2xl font-bold text-emerald-700 tabular-nums">
            {totalDiterima}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs text-slate-500">Total Presensi</div>
          <div className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
            {totalAbsen}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-5 col-span-2 lg:col-span-1">
          <div className="text-xs text-slate-500">Rata-rata Pre / Post</div>
          <div className="mt-1 font-display text-2xl font-bold text-blue-700 tabular-nums">
            {avgPreAll} / {avgPostAll}
          </div>
        </div>
      </div>

      {/* Google Sheets Database Link & Sync Status Card */}
      <div className="bg-white border border-slate-200 rounded-lg px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
        {syncLogs.length > 0 ? (
          <>
            <div className="space-y-1">
              <div className="font-semibold text-slate-900">
                Tautan Spreadsheet Database (Google Sheets)
              </div>
              <div className="text-slate-600">
                {syncLogs[0].spreadsheetTitle}{' '}
                <span aria-hidden="true">·</span>{' '}
                <span className="tabular-nums">
                  Terakhir disinkronkan {formatDateTimeId(syncLogs[0].syncedAt)}
                </span>
              </div>
              <div className="font-mono-tabular text-[11px] text-slate-500 break-all">
                {syncLogs[0].spreadsheetUrl}
              </div>
            </div>
            <a
              href={syncLogs[0].spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md whitespace-nowrap shrink-0 self-start sm:self-center"
            >
              <span>Buka Google Sheets</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </>
        ) : (
          <>
            <div className="space-y-1">
              <div className="font-semibold text-slate-900">
                Tautan Spreadsheet Database (Google Sheets)
              </div>
              <p className="text-slate-600 leading-relaxed">
                Data utama portal tersimpan di database Cloud Firestore. Link Google Sheets belum dibuat — klik tombol{' '}
                <span className="font-semibold text-slate-900">Sync ke Google Sheets</span>{' '}
                untuk membuat spreadsheet baru secara otomatis atau menautkan URL Google Sheets yang sudah ada.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSyncResult(null);
                setSyncError('');
                setShowSyncModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md whitespace-nowrap shrink-0 self-start sm:self-center"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Buat / Tautkan Sheet</span>
            </button>
          </>
        )}
      </div>

      {/* Segmented View Toggle */}
      <div className="flex items-center justify-between gap-4">
        <div className="inline-flex p-1 bg-slate-200/70 rounded-md">
          <button
            type="button"
            onClick={() => setViewMode('agenda')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
              viewMode === 'agenda'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Rekap per Agenda ({agendaRekap.length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode('peserta')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
              viewMode === 'peserta'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Detail Kepesertaan ({participantDetails.length})
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-sm text-slate-500">Memuat data rekapitulasi...</div>
        ) : viewMode === 'agenda' ? (
          agendaRekap.length === 0 ? (
            <div className="p-8 text-sm text-slate-500">
              Belum ada agenda Bimtek untuk direkap.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Agenda & Lokasi</th>
                    <th className="py-3 px-4">Jadwal</th>
                    <th className="py-3 px-3 text-right">Pendaftar</th>
                    <th className="py-3 px-3 text-right">Diterima</th>
                    <th className="py-3 px-3 text-right">Absen H1/H2/H3</th>
                    <th className="py-3 px-3 text-right">Pre-Test</th>
                    <th className="py-3 px-3 text-right">Post-Test</th>
                    <th className="py-3 px-4 text-right">Eval / Dok</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {agendaRekap.map((row) => (
                    <tr key={row.agendaId} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{row.title}</div>
                        <div className="text-xs text-slate-500">{row.location}</div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        {formatDateId(row.startDate)} – {formatDateId(row.endDate)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-tabular text-slate-900">
                        {row.totalRegistrants}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-tabular text-emerald-700 font-semibold">
                        {row.approvedParticipants}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-tabular text-slate-700">
                        {row.day1Attendance} / {row.day2Attendance} / {row.day3Attendance}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-tabular text-slate-700">
                        {row.avgPretest !== null ? `${row.avgPretest} (${row.pretestCompleted})` : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-tabular text-slate-700">
                        {row.avgPosttest !== null ? `${row.avgPosttest} (${row.posttestCompleted})` : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular text-slate-700">
                        {row.evaluationsCount} / {row.uploadsCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : participantDetails.length === 0 ? (
          <div className="p-8 text-sm text-slate-500">
            Belum ada peserta yang terdaftar pada agenda Bimtek.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Peserta & LPSE</th>
                  <th className="py-3 px-4">Agenda Bimtek</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-center">H1 / H2 / H3</th>
                  <th className="py-3 px-3 text-right">Pre-Test</th>
                  <th className="py-3 px-3 text-right">Post-Test</th>
                  <th className="py-3 px-4">Dokumen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {participantDetails.map((d) => (
                  <tr key={d.registrationId} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{d.fullName}</div>
                      <div className="text-xs text-slate-500">
                        {d.lpseLocation || '-'} · {d.email}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700">{d.agendaTitle}</td>
                    <td className="py-3 px-3 text-xs font-semibold">
                      <span
                        className={
                          d.registrationStatus === 'approved'
                            ? 'text-emerald-700'
                            : d.registrationStatus === 'rejected'
                            ? 'text-red-700'
                            : 'text-amber-700'
                        }
                      >
                        {d.registrationStatus === 'approved'
                          ? 'Disetujui'
                          : d.registrationStatus === 'rejected'
                          ? 'Ditolak'
                          : 'Menunggu'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center text-xs font-mono-tabular text-slate-700">
                      {d.absenDay1 === 'Hadir' ? '✓' : '–'} /{' '}
                      {d.absenDay2 === 'Hadir' ? '✓' : '–'} /{' '}
                      {d.absenDay3 === 'Hadir' ? '✓' : '–'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono-tabular text-xs text-slate-700">
                      {d.pretestScore}
                    </td>
                    <td className="py-3 px-3 text-right font-mono-tabular text-xs text-slate-700">
                      {d.posttestScore}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      Komitmen: {d.komitmenStatus === 'Belum Unggah' ? 'Belum' : 'Ada'} · Tugas:{' '}
                      {d.tugasStatus === 'Belum Unggah' ? 'Belum' : 'Ada'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Dialog for Google Sheets Sync */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sync-modal-title"
            className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 id="sync-modal-title" className="font-display text-lg font-bold text-slate-900">
                Konfirmasi Sinkronisasi Google Sheets
              </h2>
              <button
                type="button"
                aria-label="Tutup dialog sinkronisasi"
                onClick={() => setShowSyncModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Tindakan ini akan menulis atau memperbarui{' '}
              <strong className="text-slate-900">{agendaRekap.length} baris Rekap Agenda</strong> dan{' '}
              <strong className="text-slate-900">{participantDetails.length} baris Detail Peserta</strong>{' '}
              ke Google Sheets di akun Google Anda.
            </p>

            {!googleConnected ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-md space-y-3">
                <p className="text-xs text-amber-800">
                  Akun Google Workspace belum terhubung pada sesi browser ini. Silakan hubungkan akun Google Anda terlebih dahulu.
                </p>
                <GoogleSignInButton
                  onClick={onConnectGoogle}
                  label="Hubungkan Google Sheets"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label htmlFor="sheet-id" className="block text-xs font-medium text-slate-700">
                    URL atau ID Google Sheets Tujuan (Opsional — kosongkan untuk buat baru)
                  </label>
                  <input
                    id="sheet-id"
                    type="text"
                    value={existingSpreadsheetId}
                    onChange={(e) => setExistingSpreadsheetId(e.target.value)}
                    placeholder="Tempel link https://docs.google.com/spreadsheets/d/... atau kosongkan"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono-tabular"
                  />
                </div>
                {!existingSpreadsheetId.trim() && (
                  <div className="space-y-1">
                    <label htmlFor="sheet-title" className="block text-xs font-medium text-slate-700">
                      Judul Spreadsheet Baru
                    </label>
                    <input
                      id="sheet-title"
                      type="text"
                      value={sheetTitle}
                      onChange={(e) => setSheetTitle(e.target.value)}
                      placeholder="Rekap Portal Bimtek LPSE"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
                    />
                  </div>
                )}
              </div>
            )}

            {syncError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
                {syncError}
              </div>
            )}

            {syncResult && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md space-y-1.5 text-xs text-emerald-800">
                <div className="flex items-center gap-1.5 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>Sinkronisasi berhasil ke Google Sheets!</span>
                </div>
                <a
                  href={syncResult.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline"
                >
                  <span>Buka {syncResult.spreadsheetTitle}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSyncModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!googleConnected || syncing}
                onClick={handleConfirmSync}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md disabled:opacity-50"
              >
                {syncing ? 'Menyinkronkan...' : 'Konfirmasi & Sinkronkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
