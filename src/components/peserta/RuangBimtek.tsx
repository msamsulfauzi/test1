import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Clock,
  ExternalLink,
  FileUp,
  Lock,
  MessageSquare,
  X,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import type { QuestionItem, RoomData, RoomStage } from '../../types/bimtek';
import { GoogleSignInButton } from '../GoogleSignInButton';

interface RuangBimtekProps {
  agendaId: number;
  googleConnected: boolean;
  onConnectGoogle: () => Promise<void>;
  onBack: () => void;
}

export const RuangBimtek: React.FC<RuangBimtekProps> = ({
  agendaId,
  googleConnected,
  onConnectGoogle,
  onBack,
}) => {
  const [room, setRoom] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Active interaction modal
  const [activeStage, setActiveStage] = useState<RoomStage | null>(null);

  // Test modal state
  const [testAnswers, setTestAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  // Evaluation modal state
  const [ratingMastery, setRatingMastery] = useState(5);
  const [ratingDelivery, setRatingDelivery] = useState(5);
  const [ratingMaterial, setRatingMaterial] = useState(5);
  const [evalComments, setEvalComments] = useState('');

  // Upload modal state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState('');

  const loadRoom = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await apiFetch<RoomData>(`/api/peserta/room/${agendaId}`);
      setRoom(data);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat ruang Bimtek.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadRoom();
  }, [agendaId]);

  const handleOpenStage = (st: RoomStage) => {
    setUploadError('');
    setSuccessMsg('');
    if (st.stageType === 'pretest' || st.stageType === 'posttest') {
      setTestAnswers({});
    } else if (st.stageType === 'eval_speaker' || st.stageType === 'eval_committee') {
      setRatingMastery(5);
      setRatingDelivery(5);
      setRatingMaterial(5);
      setEvalComments('');
    } else if (st.stageType === 'upload') {
      setSelectedFile(null);
    }
    setActiveStage(st);
  };

  const handleSubmitAttendance = async (dayNumber: number) => {
    setSubmitting(true);
    setError('');
    try {
      await apiFetch(`/api/peserta/room/${agendaId}/attendance`, {
        method: 'POST',
        body: JSON.stringify({ dayNumber }),
      });
      setActiveStage(null);
      setSuccessMsg(`Absensi Hari ke-${dayNumber} berhasil dicatat sesuai tanggal sistem.`);
      await loadRoom(true);
    } catch (err: any) {
      setError(err.message || 'Gagal mencatat absensi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitTest = async (testType: 'pretest' | 'posttest') => {
    setSubmitting(true);
    setError('');
    try {
      const res = await apiFetch<{
        summary: { score: number; maxScore: number; percentage: number };
      }>(`/api/peserta/room/${agendaId}/test`, {
        method: 'POST',
        body: JSON.stringify({ testType, answers: testAnswers }),
      });
      setActiveStage(null);
      setSuccessMsg(
        `${testType === 'pretest' ? 'Pre-Test' : 'Post-Test'} selesai! Skor Anda: ${res.summary.score} / ${res.summary.maxScore} (${res.summary.percentage}%).`
      );
      await loadRoom(true);
    } catch (err: any) {
      setError(err.message || 'Gagal mengirim jawaban tes.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitEvaluation = async (st: RoomStage) => {
    setSubmitting(true);
    setError('');
    try {
      await apiFetch(`/api/peserta/room/${agendaId}/evaluation`, {
        method: 'POST',
        body: JSON.stringify({
          targetType: st.stageType === 'eval_committee' ? 'committee' : 'speaker',
          speakerNumber: st.speakerNumber,
          ratingMastery,
          ratingDelivery,
          ratingMaterial,
          comments: evalComments,
        }),
      });
      setActiveStage(null);
      setSuccessMsg(`Penilaian untuk ${st.title} berhasil disimpan.`);
      await loadRoom(true);
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan penilaian.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadFile = async (
    docType: 'komitmen' | 'tugas',
    allowPortalArchiveFallback = false
  ) => {
    if (!selectedFile) {
      setUploadError('Pilih file dokumen terlebih dahulu.');
      return;
    }
    setSubmitting(true);
    setUploadError('');
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || '');
          const idx = result.indexOf(',');
          resolve(idx >= 0 ? result.slice(idx + 1) : result);
        };
        reader.onerror = () => reject(new Error('Gagal membaca file.'));
        reader.readAsDataURL(selectedFile);
      });

      const uploaded = await apiFetch<{
        storageMode: string;
        driveWebViewLink: string;
      }>(`/api/peserta/room/${agendaId}/upload`, {
        method: 'POST',
        body: JSON.stringify({
          docType,
          fileName: selectedFile.name,
          mimeType: selectedFile.type || 'application/pdf',
          fileSize: selectedFile.size,
          fileBase64: base64,
          allowPortalArchiveFallback,
        }),
      });

      setActiveStage(null);
      setSuccessMsg(
        uploaded.storageMode === 'google_drive'
          ? `Dokumen ${selectedFile.name} berhasil diunggah otomatis ke Google Drive.`
          : `Dokumen ${selectedFile.name} berhasil disimpan ke arsip portal.`
      );
      await loadRoom(true);
    } catch (err: any) {
      setUploadError(err.message || 'Gagal mengunggah dokumen.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 text-sm text-slate-500">
        Memuat Ruang Bimtek...
      </div>
    );
  }

  if (!room) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-blue-700 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Daftar Agenda</span>
        </button>
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error || 'Ruang Bimtek tidak tersedia.'}
        </div>
      </div>
    );
  }

  const dayGroups = [1, 2, 3].map((dayNum) => ({
    dayNum,
    dateKey: room.dayInfo.dayDates[dayNum] || '-',
    isToday: room.dayInfo.currentDayNumber === dayNum,
    stages: room.stages.filter((s) => s.dayNumber === dayNum),
  }));

  const activeQuestions: QuestionItem[] =
    activeStage?.stageType === 'pretest'
      ? room.pretestQuestions
      : activeStage?.stageType === 'posttest'
      ? room.posttestQuestions
      : [];

  return (
    <div className="space-y-6">
      {/* Header & Back */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke Daftar Agenda</span>
          </button>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            {room.agenda.title}
          </h1>
          <div className="text-xs text-slate-600 tabular-nums">
            Tanggal Sistem: <strong className="text-slate-900">{room.dayInfo.todayKey}</strong>{' '}
            <span aria-hidden="true">·</span>{' '}
            {room.dayInfo.currentDayNumber
              ? `Pelaksanaan Hari ke-${room.dayInfo.currentDayNumber} dari ${room.dayInfo.totalDays}`
              : room.dayInfo.agendaStatus === 'upcoming'
              ? 'Agenda Belum Dimulai'
              : 'Periode Bimtek Berakhir'}{' '}
            <span aria-hidden="true">·</span> Lokasi: {room.agenda.location}
          </div>
        </div>

        <div className="shrink-0">
          <span
            className={`text-xs font-medium ${
              googleConnected ? 'text-emerald-700' : 'text-slate-500'
            }`}
          >
            {googleConnected
              ? 'Google Drive Aktif (Upload Otomatis)'
              : 'Hubungkan Google Drive di kanan atas untuk upload otomatis'}
          </span>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            aria-label="Tutup pesan sukses"
            onClick={() => setSuccessMsg('')}
            className="text-emerald-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Results Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Absensi Tercatat</div>
          <div className="mt-1 font-display text-xl font-bold text-slate-900 tabular-nums">
            {room.attendances.length} / 3 Hari
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Skor Pre-Test</div>
          <div className="mt-1 font-display text-xl font-bold text-slate-900 tabular-nums">
            {(() => {
              const p = room.testSubmissions.find((t) => t.testType === 'pretest');
              return p ? `${p.score}/${p.maxScore}` : 'Belum';
            })()}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Skor Post-Test</div>
          <div className="mt-1 font-display text-xl font-bold text-slate-900 tabular-nums">
            {(() => {
              const p = room.testSubmissions.find((t) => t.testType === 'posttest');
              return p ? `${p.score}/${p.maxScore}` : 'Belum';
            })()}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Dokumen Terunggah</div>
          <div className="mt-1 font-display text-xl font-bold text-slate-900 tabular-nums">
            {room.documentUploads.length} / 2 Berkas
          </div>
        </div>
      </div>

      {/* 3-Day Non-Locking Timeline */}
      <div className="space-y-5">
        {dayGroups.map((group) => (
          <section
            key={group.dayNum}
            className="bg-white border border-slate-200 rounded-lg overflow-hidden"
          >
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <h2 className="font-display text-base font-bold text-slate-900">
                  Hari ke-{group.dayNum} (Day {group.dayNum})
                </h2>
                <span className="text-xs text-slate-500 font-mono-tabular">
                  {group.dateKey}
                </span>
              </div>
              <span
                className={`text-xs font-semibold ${
                  group.isToday ? 'text-blue-700' : 'text-slate-500'
                }`}
              >
                {group.isToday
                  ? 'Aktif Hari Ini'
                  : room.dayInfo.currentDayNumber && room.dayInfo.currentDayNumber > group.dayNum
                  ? 'Tanggal Telah Berlalu'
                  : 'Terjadwal'}
              </span>
            </div>

            <div className="divide-y divide-slate-200">
              {group.stages.map((st) => {
                const av = st.availability;
                const docUpload =
                  st.stageKey === 'upload_komitmen'
                    ? room.documentUploads.find((d) => d.docType === 'komitmen')
                    : st.stageKey === 'upload_tugas'
                    ? room.documentUploads.find((d) => d.docType === 'tugas')
                    : undefined;

                const StageIcon =
                  st.stageType === 'attendance'
                    ? CalendarCheck
                    : st.stageType === 'upload'
                    ? FileUp
                    : st.stageType === 'pretest' || st.stageType === 'posttest'
                    ? ClipboardList
                    : MessageSquare;

                return (
                  <div
                    key={st.id}
                    className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <StageIcon
                        className={`w-5 h-5 mt-0.5 shrink-0 ${
                          av.status === 'completed'
                            ? 'text-emerald-700'
                            : av.active
                            ? 'text-blue-700'
                            : 'text-slate-400'
                        }`}
                      />
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-sm font-semibold text-slate-900">
                          {st.title}
                        </div>
                        <div className="text-xs text-slate-500">
                          {st.description}
                        </div>
                        {docUpload && (
                          <div className="text-xs text-emerald-700 flex items-center gap-2 pt-1">
                            <span>Berkas: {docUpload.fileName}</span>
                            {docUpload.driveWebViewLink && (
                              <a
                                href={docUpload.driveWebViewLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline"
                              >
                                <span>Lihat di Drive</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {av.status === 'completed' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 whitespace-nowrap">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Selesai</span>
                        </span>
                      ) : av.active ? (
                        <button
                          type="button"
                          onClick={() => handleOpenStage(st)}
                          className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md whitespace-nowrap"
                        >
                          {st.stageType === 'attendance'
                            ? 'Isi Absensi'
                            : st.stageType === 'upload'
                            ? 'Upload Dokumen'
                            : st.stageType === 'pretest'
                            ? 'Kerjakan Pre-Test'
                            : st.stageType === 'posttest'
                            ? 'Kerjakan Post-Test'
                            : 'Isi Penilaian'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-400 bg-slate-100 border border-slate-200 rounded-md cursor-not-allowed whitespace-nowrap"
                        >
                          {av.status === 'missed' ? (
                            <Lock className="w-3.5 h-3.5" />
                          ) : (
                            <Clock className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {av.status === 'missed' ? 'Tidak Aktif (Lewat)' : 'Belum Aktif'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Interactive Stage Modal */}
      {activeStage && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="stage-modal-title"
            className="bg-white border border-slate-200 rounded-lg max-w-xl w-full p-6 space-y-4 my-8"
          >
            <div className="flex items-center justify-between">
              <h2 id="stage-modal-title" className="font-display text-lg font-bold text-slate-900">
                {activeStage.title}
              </h2>
              <button
                type="button"
                aria-label="Tutup dialog tahapan"
                onClick={() => setActiveStage(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {activeStage.stageType === 'attendance' && (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  Konfirmasi kehadiran Anda untuk <strong>Hari ke-{activeStage.dayNumber}</strong>{' '}
                  pada tanggal sistem <strong className="font-mono-tabular">{room.dayInfo.todayKey}</strong>.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveStage(null)}
                    className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-md"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleSubmitAttendance(activeStage.dayNumber)}
                    className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md disabled:opacity-50"
                  >
                    {submitting ? 'Menyimpan...' : 'Catat Kehadiran Sekarang'}
                  </button>
                </div>
              </div>
            )}

            {activeStage.stageType === 'upload' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  {activeStage.stageKey === 'upload_komitmen'
                    ? 'Unggah Lembar Komitmen mengikuti Bimtek (PDF / gambar / dokumen). File akan tersimpan otomatis di Google Drive Anda.'
                    : 'Unggah Dokumen Tugas Akhir Bimtek (PDF / gambar / dokumen). File akan tersimpan otomatis di Google Drive Anda.'}
                </p>

                {!googleConnected && (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-md space-y-2.5">
                    <p className="text-xs text-amber-800">
                      Google Drive belum terhubung pada sesi ini. Hubungkan akun Google agar file tersimpan otomatis ke Google Drive.
                    </p>
                    <GoogleSignInButton
                      onClick={onConnectGoogle}
                      label="Hubungkan Google Drive"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="doc-file-input" className="block text-xs font-medium text-slate-700">
                    Pilih File Dokumen
                  </label>
                  <input
                    id="doc-file-input"
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-700 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border file:border-slate-300 file:bg-slate-50 file:text-xs file:font-semibold"
                  />
                </div>

                {uploadError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
                    {uploadError}
                  </div>
                )}

                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveStage(null)}
                    className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-md"
                  >
                    Batal
                  </button>
                  {!googleConnected && (
                    <button
                      type="button"
                      disabled={submitting || !selectedFile}
                      onClick={() =>
                        handleUploadFile(
                          activeStage.stageKey === 'upload_komitmen' ? 'komitmen' : 'tugas',
                          true
                        )
                      }
                      className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md disabled:opacity-50"
                    >
                      Simpan ke Arsip Portal
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={submitting || !selectedFile || !googleConnected}
                    onClick={() =>
                      handleUploadFile(
                        activeStage.stageKey === 'upload_komitmen' ? 'komitmen' : 'tugas',
                        false
                      )
                    }
                    className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md disabled:opacity-50"
                  >
                    {submitting ? 'Mengunggah...' : 'Upload Otomatis ke Google Drive'}
                  </button>
                </div>
              </div>
            )}

            {(activeStage.stageType === 'pretest' ||
              activeStage.stageType === 'posttest') && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSubmitTest(
                    activeStage.stageType === 'pretest' ? 'pretest' : 'posttest'
                  );
                }}
                className="space-y-5 max-h-[70vh] overflow-y-auto pr-1"
              >
                {activeQuestions.map((q, idx) => (
                  <div key={q.id} className="space-y-2 pb-4 border-b border-slate-200">
                    <div className="text-sm font-semibold text-slate-900">
                      {idx + 1}. {q.questionText}{' '}
                      <span className="text-xs font-normal text-slate-500">
                        (Bobot {q.weight} poin)
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {q.optionsJson.map((opt, optIdx) => (
                        <label
                          key={optIdx}
                          className="flex items-start gap-2.5 p-2 rounded hover:bg-slate-50 cursor-pointer text-xs text-slate-700"
                        >
                          <input
                            type="radio"
                            name={`q-${q.id}`}
                            required
                            checked={testAnswers[String(q.id)] === optIdx}
                            onChange={() =>
                              setTestAnswers((prev) => ({
                                ...prev,
                                [String(q.id)]: optIdx,
                              }))
                            }
                            className="mt-0.5"
                          />
                          <span>
                            {String.fromCharCode(65 + optIdx)}. {opt}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveStage(null)}
                    className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-md"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md disabled:opacity-50"
                  >
                    {submitting ? 'Mengirim...' : 'Kirim Jawaban Tes'}
                  </button>
                </div>
              </form>
            )}

            {(activeStage.stageType === 'eval_speaker' ||
              activeStage.stageType === 'eval_committee') && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSubmitEvaluation(activeStage);
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-700">
                      {activeStage.stageType === 'eval_committee'
                        ? 'Kesiapan Panitia (1-5)'
                        : 'Penguasaan Materi (1-5)'}
                    </label>
                    <select
                      value={ratingMastery}
                      onChange={(e) => setRatingMastery(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                    >
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {n} - {n === 5 ? 'Sangat Baik' : n === 4 ? 'Baik' : n === 3 ? 'Cukup' : n === 2 ? 'Kurang' : 'Sangat Kurang'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-700">
                      {activeStage.stageType === 'eval_committee'
                        ? 'Pelayanan & Respons (1-5)'
                        : 'Penyampaian Materi (1-5)'}
                    </label>
                    <select
                      value={ratingDelivery}
                      onChange={(e) => setRatingDelivery(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                    >
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {n} - {n === 5 ? 'Sangat Baik' : n === 4 ? 'Baik' : n === 3 ? 'Cukup' : n === 2 ? 'Kurang' : 'Sangat Kurang'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-700">
                      {activeStage.stageType === 'eval_committee'
                        ? 'Fasilitas & Sarana (1-5)'
                        : 'Kualitas Bahan Tayang (1-5)'}
                    </label>
                    <select
                      value={ratingMaterial}
                      onChange={(e) => setRatingMaterial(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                    >
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {n} - {n === 5 ? 'Sangat Baik' : n === 4 ? 'Baik' : n === 3 ? 'Cukup' : n === 2 ? 'Kurang' : 'Sangat Kurang'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Saran & Catatan Evaluasi (Opsional)
                  </label>
                  <textarea
                    rows={3}
                    value={evalComments}
                    onChange={(e) => setEvalComments(e.target.value)}
                    placeholder="Tuliskan masukan konstruktif Anda..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveStage(null)}
                    className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-md"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md disabled:opacity-50"
                  >
                    {submitting ? 'Menyimpan...' : 'Kirim Penilaian'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
