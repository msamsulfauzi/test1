import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  XCircle,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import type { BimtekAgenda } from '../../types/bimtek';
import { formatDateTimeId } from '../../utils/formatters';

interface PesertaAgendasProps {
  onEnterRoom: (agendaId: number) => void;
}

export const PesertaAgendas: React.FC<PesertaAgendasProps> = ({ onEnterRoom }) => {
  const [agendas, setAgendas] = useState<BimtekAgenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [registeringId, setRegisteringId] = useState<number | null>(null);

  const loadAgendas = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<BimtekAgenda[]>('/api/peserta/agendas');
      setAgendas(data);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat agenda Bimtek.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgendas();
  }, []);

  const handleRegister = async (agendaId: number) => {
    setRegisteringId(agendaId);
    setError('');
    try {
      await apiFetch(`/api/peserta/agendas/${agendaId}/register`, {
        method: 'POST',
      });
      await loadAgendas();
    } catch (err: any) {
      setError(err.message || 'Gagal mendaftar agenda Bimtek.');
    } finally {
      setRegisteringId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">
          Daftar Agenda & Ruang Bimtek
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Pilih agenda Bimtek yang pendaftarannya sedang dibuka. Setelah disetujui oleh PIC, Anda dapat masuk ke Ruang Bimtek.
        </p>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-sm text-slate-500">
          Memuat agenda Bimtek...
        </div>
      ) : agendas.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-sm text-slate-500">
          Belum ada agenda Bimtek yang tersedia saat ini.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {agendas.map((ag) => {
            const reg = ag.myRegistration;
            const dayInfo = ag.dayInfo;

            return (
              <div
                key={ag.id}
                className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5"
              >
                <div className="space-y-2 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      {ag.title}
                    </h2>
                    {dayInfo && (
                      <span className="text-xs font-semibold text-blue-700">
                        {dayInfo.agendaStatus === 'ongoing'
                          ? `Sedang Berlangsung · Hari ke-${dayInfo.currentDayNumber}`
                          : dayInfo.agendaStatus === 'upcoming'
                          ? 'Akan Datang'
                          : 'Telah Selesai'}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Pelaksanaan: {formatDateTimeId(ag.startDate)} – {formatDateTimeId(ag.endDate)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {ag.location}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 tabular-nums">
                    Masa Pendaftaran: {formatDateTimeId(ag.registrationOpenAt)} –{' '}
                    {formatDateTimeId(ag.registrationCloseAt)}{' '}
                    <span className="mx-1.5">·</span>
                    <span
                      className={
                        ag.registrationOpen
                          ? 'text-emerald-700 font-semibold'
                          : 'text-slate-500'
                      }
                    >
                      {ag.registrationOpen ? 'Pendaftaran Dibuka' : 'Pendaftaran Tutup'}
                    </span>
                  </div>

                  {(ag.materialTitle || ag.speakers) && (
                    <div className="text-xs text-slate-600 pt-1">
                      {ag.materialTitle && <span>Materi: {ag.materialTitle}</span>}
                      {ag.materialTitle && ag.speakers && <span className="mx-2">·</span>}
                      {ag.speakers && <span>Pemateri: {ag.speakers}</span>}
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-2.5 shrink-0">
                  {reg ? (
                    reg.status === 'approved' ? (
                      <>
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Disetujui Mengikuti Bimtek</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => onEnterRoom(ag.id)}
                          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md whitespace-nowrap"
                        >
                          <span>Masuk Ruang Bimtek</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : reg.status === 'pending' ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                        <Clock className="w-4 h-4" />
                        <span>Menunggu Persetujuan PIC</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700">
                        <XCircle className="w-4 h-4" />
                        <span>Pendaftaran Ditolak PIC</span>
                      </span>
                    )
                  ) : ag.registrationOpen ? (
                    <button
                      type="button"
                      disabled={registeringId === ag.id}
                      onClick={() => handleRegister(ag.id)}
                      className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md whitespace-nowrap disabled:opacity-50"
                    >
                      {registeringId === ag.id ? 'Mendaftar...' : 'Daftar Agenda Ini'}
                    </button>
                  ) : (
                    <span className="text-xs text-slate-500">Pendaftaran Ditutup</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
