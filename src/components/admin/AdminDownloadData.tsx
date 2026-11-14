import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Download,
  Eye,
  FileJson,
  FileSpreadsheet,
  RefreshCw,
  X,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import type { AdminExportResponse, ExportDatasetItem } from '../../types/bimtek';
import { buildCsv, createZipArchive } from '../../utils/exportUtils';
import { formatDateId, formatDateTimeId } from '../../utils/formatters';

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getTodayStamp(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export const AdminDownloadData: React.FC = () => {
  const [data, setData] = useState<AdminExportResponse | null>(null);
  const [selectedAgendaId, setSelectedAgendaId] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewDataset, setPreviewDataset] = useState<ExportDatasetItem | null>(null);
  const [lastDownloadedNotice, setLastDownloadedNotice] = useState('');

  const loadExportData = async (agendaIdParam: string) => {
    setLoading(true);
    setError('');
    try {
      const qs = agendaIdParam ? `?agendaId=${encodeURIComponent(agendaIdParam)}` : '';
      const res = await apiFetch<AdminExportResponse>(`/api/admin/export${qs}`);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat paket data unduhan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExportData(selectedAgendaId);
  }, [selectedAgendaId]);

  const categories = useMemo(() => {
    if (!data) return [];
    const seen = new Set(data.datasets.map((d) => d.category));
    return Array.from(seen);
  }, [data]);

  const filteredDatasets = useMemo(() => {
    if (!data) return [];
    if (categoryFilter === 'all') return data.datasets;
    return data.datasets.filter((d) => d.category === categoryFilter);
  }, [data, categoryFilter]);

  const totalRecords = useMemo(() => {
    if (!data) return 0;
    return (
      data.summary.totalAttendances +
      data.summary.totalTestSubmissions +
      data.summary.totalEvaluations +
      data.summary.totalDocuments
    );
  }, [data]);

  const handleDownloadCsv = (dataset: ExportDatasetItem) => {
    const csv = buildCsv(dataset.headers, dataset.rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const prefix = selectedAgendaId ? `agenda-${selectedAgendaId}-` : '';
    const fileName = `${prefix}${dataset.fileName}`;
    triggerBlobDownload(blob, fileName);
    setLastDownloadedNotice(`Berhasil mengunduh ${fileName} (${dataset.rows.length} baris).`);
  };

  const handleDownloadAllZip = () => {
    if (!data) return;
    const entries = data.datasets.map((ds) => ({
      name: ds.fileName,
      content: buildCsv(ds.headers, ds.rows),
    }));
    const zipBytes = createZipArchive(entries);
    const arrayBuffer = zipBytes.buffer.slice(
      zipBytes.byteOffset,
      zipBytes.byteOffset + zipBytes.byteLength
    ) as ArrayBuffer;
    const blob = new Blob([arrayBuffer], { type: 'application/zip' });
    const scope = selectedAgendaId ? `agenda-${selectedAgendaId}` : 'semua-data';
    const fileName = `portal-bimtek-${scope}-${getTodayStamp()}.zip`;
    triggerBlobDownload(blob, fileName);
    setLastDownloadedNotice(
      `Berhasil mengunduh arsip lengkap ${fileName} berisi ${entries.length} file CSV.`
    );
  };

  const handleDownloadJson = () => {
    if (!data) return;
    const jsonString = JSON.stringify(
      {
        exportedAt: data.exportedAt,
        filterAgendaId: data.filterAgendaId,
        summary: data.summary,
        collections: data.rawBackup,
      },
      null,
      2
    );
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
    const scope = selectedAgendaId ? `agenda-${selectedAgendaId}` : 'backup-lengkap';
    const fileName = `portal-bimtek-${scope}-${getTodayStamp()}.json`;
    triggerBlobDownload(blob, fileName);
    setLastDownloadedNotice(`Berhasil mengunduh cadangan database ${fileName}.`);
  };

  return (
    <div className="space-y-6">
      {/* Header & Primary Batch Download CTAs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Download Data Portal Bimtek
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Unduh seluruh data agenda Bimtek, daftar user &amp; peserta, pendaftaran kelas, absensi, nilai tes, penilaian, dokumen, dan master data dalam format CSV (Excel) atau JSON.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => loadExportData(selectedAgendaId)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md whitespace-nowrap disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Muat Ulang</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadJson}
            disabled={!data || loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-md whitespace-nowrap disabled:opacity-50"
          >
            <FileJson className="w-4 h-4 text-slate-600" />
            <span>Download Backup (.json)</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadAllZip}
            disabled={!data || loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md whitespace-nowrap disabled:opacity-50"
          >
            <Archive className="w-4 h-4" />
            <span>Download Semua Data (.zip CSV)</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {lastDownloadedNotice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center justify-between gap-4">
          <span>{lastDownloadedNotice}</span>
          <button
            type="button"
            aria-label="Tutup pemberitahuan unduhan"
            onClick={() => setLastDownloadedNotice('')}
            className="text-emerald-700 hover:text-emerald-900 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs text-slate-500">Agenda Bimtek</div>
          <div className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
            {data?.summary.totalAgendas ?? '–'}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs text-slate-500">Akun User / Peserta</div>
          <div className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
            {data ? `${data.summary.totalUsers} (${data.summary.totalPeserta} peserta)` : '–'}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs text-slate-500">Pendaftaran Kelas</div>
          <div className="mt-1 font-display text-2xl font-bold text-emerald-700 tabular-nums">
            {data?.summary.totalRegistrations ?? '–'}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs text-slate-500">Rekaman Aktivitas &amp; Berkas</div>
          <div className="mt-1 font-display text-2xl font-bold text-blue-700 tabular-nums">
            {data ? totalRecords : '–'}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
          <label
            htmlFor="export-agenda-filter"
            className="text-xs font-semibold text-slate-700 whitespace-nowrap"
          >
            Cakupan Agenda
          </label>
          <select
            id="export-agenda-filter"
            value={selectedAgendaId}
            onChange={(e) => setSelectedAgendaId(e.target.value)}
            className="w-full sm:max-w-md px-3 py-2 text-xs border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
          >
            <option value="">Semua Agenda Bimtek (Data Lengkap)</option>
            {(data?.agendas || []).map((ag) => (
              <option key={ag.id} value={String(ag.id)}>
                {ag.title} ({formatDateId(ag.startDate)} – {formatDateId(ag.endDate)})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-md">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
              categoryFilter === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Semua ({data?.datasets.length ?? 0})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
                categoryFilter === cat
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Datasets Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-sm text-slate-500">
            Menyiapkan paket data unduhan dari database cloud...
          </div>
        ) : filteredDatasets.length === 0 ? (
          <div className="p-8 text-sm text-slate-500">
            Tidak ada dataset pada kategori yang dipilih.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Dataset &amp; Nama File</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-3 text-right">Kolom</th>
                  <th className="py-3 px-3 text-right">Jumlah Baris</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredDatasets.map((ds) => (
                  <tr key={ds.key} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{ds.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{ds.description}</div>
                      <div className="text-[11px] font-mono-tabular text-slate-400 mt-1">
                        {ds.fileName}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-700 whitespace-nowrap">
                      {ds.category}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono-tabular text-xs text-slate-700">
                      {ds.headers.length}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono-tabular text-xs font-semibold text-slate-900">
                      {ds.rows.length}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPreviewDataset(ds)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-md whitespace-nowrap"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Preview</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadCsv(ds)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md whitespace-nowrap"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download CSV</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data && (
        <div className="text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
          <span>
            Format CSV dilengkapi UTF-8 BOM sehingga aksara &amp; kolom langsung terbaca rapi di Microsoft Excel maupun Google Sheets.
          </span>
          <span className="tabular-nums">
            Diambil pada {formatDateTimeId(data.exportedAt)}
          </span>
        </div>
      )}

      {/* Preview Modal */}
      {previewDataset && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="preview-dataset-title"
            className="bg-white border border-slate-200 rounded-lg max-w-5xl w-full max-h-[85vh] flex flex-col"
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h2
                  id="preview-dataset-title"
                  className="font-display text-lg font-bold text-slate-900 truncate"
                >
                  Preview: {previewDataset.title}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                  {previewDataset.fileName} · Menampilkan maksimal 10 dari {previewDataset.rows.length} baris
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownloadCsv(previewDataset)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md whitespace-nowrap"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Download CSV</span>
                </button>
                <button
                  type="button"
                  aria-label="Tutup preview data"
                  onClick={() => setPreviewDataset(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {previewDataset.rows.length === 0 ? (
                <div className="p-6 text-sm text-slate-500 text-center">
                  Belum ada baris data pada dataset ini.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-md">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                        {previewDataset.headers.map((h, idx) => (
                          <th key={idx} className="py-2.5 px-3 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {previewDataset.rows.slice(0, 10).map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-50">
                          {row.map((cell, cIdx) => (
                            <td
                              key={cIdx}
                              className="py-2 px-3 text-slate-700 max-w-xs truncate"
                              title={String(cell)}
                            >
                              {String(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
