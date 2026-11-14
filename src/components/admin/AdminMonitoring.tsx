import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  RefreshCw,
  Search,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import type { MonitoringResponse } from '../../types/bimtek';
import type { StageConfig } from '../../utils/bimtekLogic';
import { formatDateId } from '../../utils/formatters';

function getCompactStageHeader(stage: StageConfig): string {
  switch (stage.stageType) {
    case 'attendance':
      return `Absen H${stage.dayNumber}`;
    case 'pretest':
      return 'Pre-Test';
    case 'posttest':
      return 'Post-Test';
    case 'eval_speaker':
      return `NS ${stage.speakerNumber || ''}`.trim();
    case 'eval_committee':
      return 'Panitia';
    case 'upload':
      return stage.stageKey === 'upload_komitmen' ? 'Komitmen' : 'Tugas';
    default:
      return stage.title;
  }
}

function getCompactCellValue(stage: StageConfig, detail: string): string {
  if (stage.stageType === 'attendance') return 'Hadir';
  if (stage.stageType === 'upload') return 'Berkas';
  if (stage.stageType === 'eval_speaker' || stage.stageType === 'eval_committee') {
    return detail.replace(/^Skor\s+/i, '');
  }
  return detail;
}

function getAgendaStatusText(status: 'upcoming' | 'ongoing' | 'ended', currentDay: number | null): string {
  if (status === 'ongoing') return `Berlangsung · Hari ke-${currentDay || 1}`;
  if (status === 'upcoming') return 'Belum Dimulai';
  return 'Selesai';
}

export const AdminMonitoring: React.FC = () => {
  const [data, setData] = useState<MonitoringResponse | null>(null);
  const [selectedAgendaId, setSelectedAgendaId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<'approved' | 'all'>('approved');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState('');

  const loadMonitoring = async (agendaId?: number | null, silent = false) => {
    if (!silent) setLoading(true);
    else setSwitching(true);
    setError('');
    try {
      const qs = agendaId ? `?agendaId=${agendaId}` : '';
      const res = await apiFetch<MonitoringResponse>(`/api/admin/monitoring${qs}`);
      setData(res);
      if (res.selectedAgenda && agendaId === undefined) {
        setSelectedAgendaId(res.selectedAgenda.id);
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memuat monitoring kelas berjalan.');
    } finally {
      if (!silent) setLoading(false);
      setSwitching(false);
    }
  };

  useEffect(() => {
    loadMonitoring();
  }, []);

  const handleAgendaChange = async (newId: number) => {
    setSelectedAgendaId(newId);
    await loadMonitoring(newId, true);
  };

  const allParticipants = data?.participants || [];
  const approvedParticipants = allParticipants.filter(
    (p) => p.registrationStatus === 'approved'
  );

  const visibleParticipants = (
    statusFilter === 'approved' ? approvedParticipants : allParticipants
  ).filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.fullName.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      p.lpseLocation.toLowerCase().includes(q) ||
      p.jabatan.toLowerCase().includes(q)
    );
  });

  const activeStages = data?.stages || [];
  const selectedAgenda = data?.selectedAgenda || null;

  const avgCompletionPct =
    approvedParticipants.length > 0 && activeStages.length > 0
      ? Math.round(
          (approvedParticipants.reduce(
            (sum, p) => sum + p.completedCount / p.totalStages,
            0
          ) /
            approvedParticipants.length) *
            100
        )
      : 0;

  const fullyCompletedCount = approvedParticipants.filter(
    (p) => p.totalStages > 0 && p.completedCount === p.totalStages
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Monitoring Kelas Berjalan
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Pantau daftar lengkap peserta dan matriks ceklis progres seluruh tahapan kelas Bimtek.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadMonitoring(selectedAgendaId, true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Muat Ulang</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Class Selector & Filters */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          <div className="lg:col-span-6 space-y-1.5">
            <label
              htmlFor="monitoring-agenda-select"
              className="block text-xs font-semibold text-slate-700"
            >
              Pilih Kelas / Agenda Bimtek
            </label>
            <select
              id="monitoring-agenda-select"
              value={selectedAgendaId ?? selectedAgenda?.id ?? ''}
              disabled={switching}
              onChange={(e) => handleAgendaChange(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-700 disabled:opacity-60"
            >
              {(data?.agendas || []).map((ag) => (
                <option key={ag.id} value={ag.id}>
                  {ag.title} ({getAgendaStatusText(ag.dayInfo.agendaStatus, ag.dayInfo.currentDayNumber)})
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-3 space-y-1.5">
            <span className="block text-xs font-semibold text-slate-700">
              Filter Kepesertaan
            </span>
            <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-md">
              <button
                type="button"
                onClick={() => setStatusFilter('approved')}
                className={`py-1.5 px-2 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
                  statusFilter === 'approved'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Diterima ({approvedParticipants.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`py-1.5 px-2 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
                  statusFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua ({allParticipants.length})
              </button>
            </div>
          </div>

          <div className="lg:col-span-3 space-y-1.5">
            <label htmlFor="monitoring-search" className="block text-xs font-semibold text-slate-700">
              Cari Peserta / LPSE
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="monitoring-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nama, email, LPSE..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>
          </div>
        </div>

        {selectedAgenda && (
          <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-semibold text-slate-900">{selectedAgenda.location}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {formatDateId(selectedAgenda.startDate)} – {formatDateId(selectedAgenda.endDate)}
              </span>
              <span aria-hidden="true">·</span>
              <span
                className={`font-semibold ${
                  selectedAgenda.dayInfo.agendaStatus === 'ongoing'
                    ? 'text-emerald-700'
                    : selectedAgenda.dayInfo.agendaStatus === 'upcoming'
                    ? 'text-blue-700'
                    : 'text-slate-600'
                }`}
              >
                {getAgendaStatusText(
                  selectedAgenda.dayInfo.agendaStatus,
                  selectedAgenda.dayInfo.currentDayNumber
                )}
              </span>
            </div>
            <div className="text-slate-500 tabular-nums">
              {activeStages.length} tahapan aktif · Sistem Tanggal:{' '}
              <span className="font-mono-tabular text-slate-700">
                {selectedAgenda.dayInfo.todayKey}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Peserta Diterima</div>
          <div className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
            {approvedParticipants.length}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Total Pendaftar Kelas</div>
          <div className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
            {allParticipants.length}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Rata-rata Ketuntasan</div>
          <div className="mt-1 font-display text-2xl font-bold text-blue-700 tabular-nums">
            {avgCompletionPct}%
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Tuntas 100% Tahapan</div>
          <div className="mt-1 font-display text-2xl font-bold text-emerald-700 tabular-nums">
            {fullyCompletedCount}
          </div>
        </div>
      </div>

      {/* Checklist Matrix Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {loading || switching ? (
          <div className="p-8 text-sm text-slate-500">
            Memuat matriks tahapan peserta...
          </div>
        ) : !selectedAgenda ? (
          <div className="p-8 text-sm text-slate-500">
            Belum ada agenda Bimtek yang tersedia.
          </div>
        ) : visibleParticipants.length === 0 ? (
          <div className="p-8 text-sm text-slate-500">
            Belum ada peserta yang sesuai dengan filter pada kelas ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="py-3 px-4 font-semibold sticky left-0 z-10 bg-slate-50 border-r border-slate-200 min-w-[220px]">
                    Peserta & LPSE
                  </th>
                  {activeStages.map((st) => (
                    <th
                      key={st.stageKey}
                      title={st.title}
                      className="py-2.5 px-2.5 text-center font-semibold whitespace-nowrap min-w-[82px]"
                    >
                      <div className="text-slate-900">{getCompactStageHeader(st)}</div>
                      <div className="text-[11px] font-normal text-slate-500">
                        Day {st.dayNumber}
                      </div>
                    </th>
                  ))}
                  <th className="py-3 px-4 text-right font-semibold whitespace-nowrap border-l border-slate-200">
                    Progres
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {visibleParticipants.map((row) => (
                  <tr key={row.userId} className="hover:bg-slate-50">
                    <td className="py-3 px-4 sticky left-0 z-10 bg-white border-r border-slate-200">
                      <div className="font-semibold text-slate-900 text-sm">
                        {row.fullName}
                      </div>
                      <div className="text-xs text-slate-500 truncate max-w-[210px]">
                        {row.lpseLocation || '-'}
                      </div>
                      {statusFilter === 'all' && (
                        <div
                          className={`text-[11px] font-semibold mt-0.5 ${
                            row.registrationStatus === 'approved'
                              ? 'text-emerald-700'
                              : row.registrationStatus === 'rejected'
                              ? 'text-red-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {row.registrationStatus === 'approved'
                            ? 'Diterima'
                            : row.registrationStatus === 'rejected'
                            ? 'Ditolak'
                            : 'Menunggu PIC'}
                        </div>
                      )}
                    </td>

                    {activeStages.map((st) => {
                      const state = row.stageStates[st.stageKey];
                      const done = Boolean(state?.completed);
                      return (
                        <td
                          key={st.stageKey}
                          title={`${st.title}: ${state?.detail || 'Belum'}`}
                          className="py-3 px-2.5 text-center align-middle"
                        >
                          {done ? (
                            <div className="inline-flex flex-col items-center gap-0.5 text-emerald-700">
                              <CheckCircle2
                                className="w-4 h-4 shrink-0"
                                aria-label="Selesai"
                              />
                              <span className="text-[11px] font-medium font-mono-tabular whitespace-nowrap">
                                {getCompactCellValue(st, state.detail)}
                              </span>
                            </div>
                          ) : (
                            <span
                              className="text-slate-300 font-medium"
                              aria-label="Belum"
                            >
                              —
                            </span>
                          )}
                        </td>
                      );
                    })}

                    <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-slate-900 whitespace-nowrap border-l border-slate-200">
                      {row.completedCount} / {row.totalStages}
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
