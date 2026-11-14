import React, { useEffect, useState } from 'react';
import { Calendar, Edit3, MapPin, Plus, Trash2, X } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import type { BimtekAgenda } from '../../types/bimtek';
import {
  formatDateTimeId,
  jakartaInputToIso,
  toLocalDatetimeInputValue,
} from '../../utils/formatters';

export const AdminAgendas: React.FC = () => {
  const [agendas, setAgendas] = useState<BimtekAgenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingAgenda, setEditingAgenda] = useState<BimtekAgenda | null>(null);

  const [title, setTitle] = useState('');
  const [registrationOpenAt, setRegistrationOpenAt] = useState('');
  const [registrationCloseAt, setRegistrationCloseAt] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [location, setLocation] = useState('');
  const [materialTitle, setMaterialTitle] = useState('');
  const [speakers, setSpeakers] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadAgendas = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<BimtekAgenda[]>('/api/admin/agendas');
      setAgendas(data);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat daftar agenda.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgendas();
  }, []);

  const openCreateModal = () => {
    setEditingAgenda(null);
    setTitle('');
    setRegistrationOpenAt('');
    setRegistrationCloseAt('');
    setStartDate('');
    setEndDate('');
    setLocation('');
    setMaterialTitle('');
    setSpeakers('');
    setDescription('');
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (ag: BimtekAgenda) => {
    setEditingAgenda(ag);
    setTitle(ag.title);
    setRegistrationOpenAt(toLocalDatetimeInputValue(ag.registrationOpenAt));
    setRegistrationCloseAt(toLocalDatetimeInputValue(ag.registrationCloseAt));
    setStartDate(toLocalDatetimeInputValue(ag.startDate));
    setEndDate(toLocalDatetimeInputValue(ag.endDate));
    setLocation(ag.location);
    setMaterialTitle(ag.materialTitle || '');
    setSpeakers(ag.speakers || '');
    setDescription(ag.description || '');
    setFormError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const payload = {
        title,
        registrationOpenAt: jakartaInputToIso(registrationOpenAt),
        registrationCloseAt: jakartaInputToIso(registrationCloseAt),
        startDate: jakartaInputToIso(startDate),
        endDate: jakartaInputToIso(endDate),
        location,
        materialTitle: materialTitle.trim() || null, // Optional
        speakers: speakers.trim() || null, // Optional
        description,
      };

      if (editingAgenda) {
        await apiFetch(`/api/admin/agendas/${editingAgenda.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/admin/agendas', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setShowModal(false);
      await loadAgendas();
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan agenda.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ag: BimtekAgenda) => {
    try {
      await apiFetch(`/api/admin/agendas/${ag.id}`, { method: 'DELETE' });
      await loadAgendas();
    } catch (err: any) {
      setError(err.message || 'Gagal menghapus agenda.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Daftar Agenda Bimtek
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Kelola jadwal pembukaan pendaftaran, waktu mulai/selesai kegiatan, lokasi, materi, dan narasumber.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Agenda Bimtek</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-sm text-slate-500">Memuat daftar agenda...</div>
        ) : agendas.length === 0 ? (
          <div className="p-8 text-sm text-slate-500">
            Belum ada agenda Bimtek. Klik Tambah Agenda Bimtek untuk membuat jadwal baru.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {agendas.map((ag) => (
              <div
                key={ag.id}
                className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/70"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h2 className="font-display text-base font-bold text-slate-900">
                      {ag.title}
                    </h2>
                    <span
                      className={`text-xs font-semibold ${
                        ag.registrationOpen ? 'text-emerald-700' : 'text-slate-500'
                      }`}
                    >
                      {ag.registrationOpen ? 'Pendaftaran Terbuka' : 'Pendaftaran Tutup'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Kegiatan: {formatDateTimeId(ag.startDate)} – {formatDateTimeId(ag.endDate)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {ag.location}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 tabular-nums">
                    Pembukaan Pendaftaran: {formatDateTimeId(ag.registrationOpenAt)} s.d.{' '}
                    {formatDateTimeId(ag.registrationCloseAt)}
                  </div>

                  <div className="text-xs text-slate-600">
                    <span>Materi: {ag.materialTitle || 'Belum ditentukan'}</span>
                    <span className="mx-2 text-slate-300">·</span>
                    <span>Narasumber: {ag.speakers || 'Belum ditentukan'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    aria-label={`Edit ${ag.title}`}
                    onClick={() => openEditModal(ag)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Hapus ${ag.title}`}
                    onClick={() => handleDelete(ag)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-md"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Agenda Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="agenda-modal-title"
            className="bg-white border border-slate-200 rounded-lg max-w-xl w-full p-6 space-y-4 my-8"
          >
            <div className="flex items-center justify-between">
              <h2 id="agenda-modal-title" className="font-display text-lg font-bold text-slate-900">
                {editingAgenda ? 'Edit Agenda Bimtek' : 'Tambah Agenda Bimtek Baru'}
              </h2>
              <button
                type="button"
                aria-label="Tutup form agenda"
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label htmlFor="ag-title" className="block text-xs font-medium text-slate-700">
                  Nama Kegiatan Bimtek
                </label>
                <input
                  id="ag-title"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Bimtek Pengadaan Barang/Jasa LPSE Angkatan IV"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="ag-reg-open" className="block text-xs font-medium text-slate-700">
                    Waktu Pembukaan Pendaftaran
                  </label>
                  <input
                    id="ag-reg-open"
                    type="datetime-local"
                    required
                    value={registrationOpenAt}
                    onChange={(e) => setRegistrationOpenAt(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono-tabular"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="ag-reg-close" className="block text-xs font-medium text-slate-700">
                    Waktu Penutupan Pendaftaran
                  </label>
                  <input
                    id="ag-reg-close"
                    type="datetime-local"
                    required
                    value={registrationCloseAt}
                    onChange={(e) => setRegistrationCloseAt(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono-tabular"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="ag-start" className="block text-xs font-medium text-slate-700">
                    Waktu Kegiatan Mulai
                  </label>
                  <input
                    id="ag-start"
                    type="datetime-local"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono-tabular"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="ag-end" className="block text-xs font-medium text-slate-700">
                    Waktu Kegiatan Selesai
                  </label>
                  <input
                    id="ag-end"
                    type="datetime-local"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono-tabular"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="ag-location" className="block text-xs font-medium text-slate-700">
                  Lokasi Kegiatan
                </label>
                <input
                  id="ag-location"
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Contoh: Hotel Pullman Jakarta / Ruang Daring Zoom"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="ag-material" className="block text-xs font-medium text-slate-700">
                  Nama Materi (Opsional)
                </label>
                <input
                  id="ag-material"
                  type="text"
                  value={materialTitle}
                  onChange={(e) => setMaterialTitle(e.target.value)}
                  placeholder="Boleh dikosongkan jika materi menyusul"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="ag-speakers" className="block text-xs font-medium text-slate-700">
                  Nama Pemateri / Narasumber (Opsional — pisahkan dengan koma untuk Narasumber 1–6)
                </label>
                <input
                  id="ag-speakers"
                  type="text"
                  value={speakers}
                  onChange={(e) => setSpeakers(e.target.value)}
                  placeholder="Contoh: Narasumber 1, Narasumber 2, ... (boleh kosong)"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="ag-desc" className="block text-xs font-medium text-slate-700">
                  Keterangan Tambahan (Opsional)
                </label>
                <textarea
                  id="ag-desc"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : editingAgenda ? 'Simpan Perubahan' : 'Buat Agenda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
