import React, { useEffect, useState } from 'react';
import { Edit3, Plus, Trash2, X } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import type { LpseLocationItem, QuestionItem } from '../../types/bimtek';
import type { StageConfig } from '../../utils/bimtekLogic';

export const AdminAturData: React.FC = () => {
  const [subTab, setSubTab] = useState<'lpse' | 'pretest' | 'posttest' | 'stages'>('lpse');
  const [lpseList, setLpseList] = useState<LpseLocationItem[]>([]);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [stages, setStages] = useState<StageConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // LPSE Modal
  const [showLpseModal, setShowLpseModal] = useState(false);
  const [editingLpse, setEditingLpse] = useState<LpseLocationItem | null>(null);
  const [lpseName, setLpseName] = useState('');
  const [lpseProvince, setLpseProvince] = useState('');

  // Question Modal
  const [showQModal, setShowQModal] = useState(false);
  const [editingQ, setEditingQ] = useState<QuestionItem | null>(null);
  const [qText, setQText] = useState('');
  const [qOptions, setQOptions] = useState<string[]>(['', '', '', '']);
  const [qCorrectIdx, setQCorrectIdx] = useState(0);
  const [qWeight, setQWeight] = useState(25);
  const [qOrder, setQOrder] = useState(1);

  // Stage Modal
  const [showStageModal, setShowStageModal] = useState(false);
  const [editingStage, setEditingStage] = useState<StageConfig | null>(null);
  const [stKey, setStKey] = useState('');
  const [stTitle, setStTitle] = useState('');
  const [stType, setStType] = useState('upload');
  const [stDay, setStDay] = useState(1);
  const [stOrder, setStOrder] = useState(1);
  const [stRequired, setStRequired] = useState(true);
  const [stActive, setStActive] = useState(true);
  const [stDesc, setStDesc] = useState('');

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [lp, qs, st] = await Promise.all([
        apiFetch<LpseLocationItem[]>('/api/admin/lpse'),
        apiFetch<QuestionItem[]>('/api/admin/questions'),
        apiFetch<StageConfig[]>('/api/admin/stages'),
      ]);
      setLpseList(lp);
      setQuestions(qs);
      setStages(st);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat master data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // LPSE handlers
  const handleSaveLpse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingLpse) {
        await apiFetch(`/api/admin/lpse/${editingLpse.id}`, {
          method: 'PUT',
          body: JSON.stringify({ name: lpseName, province: lpseProvince, isActive: true }),
        });
      } else {
        await apiFetch('/api/admin/lpse', {
          method: 'POST',
          body: JSON.stringify({ name: lpseName, province: lpseProvince, isActive: true }),
        });
      }
      setShowLpseModal(false);
      await loadAll();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan LPSE.');
    }
  };

  const handleDeleteLpse = async (item: LpseLocationItem) => {
    await apiFetch(`/api/admin/lpse/${item.id}`, { method: 'DELETE' });
    await loadAll();
  };

  // Question handlers
  const currentQuestions = questions.filter(
    (q) => q.testType === (subTab === 'posttest' ? 'posttest' : 'pretest')
  );

  const openQuestionModal = (q: QuestionItem | null) => {
    setEditingQ(q);
    if (q) {
      setQText(q.questionText);
      const opts = [...(q.optionsJson || [])];
      while (opts.length < 4) opts.push('');
      setQOptions(opts.slice(0, 4));
      setQCorrectIdx(q.correctIndex ?? 0);
      setQWeight(q.weight);
      setQOrder(q.orderIndex);
    } else {
      setQText('');
      setQOptions(['', '', '', '']);
      setQCorrectIdx(0);
      setQWeight(25);
      setQOrder(currentQuestions.length + 1);
    }
    setShowQModal(true);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedOptions = qOptions.map((o) => o.trim()).filter(Boolean);
    if (cleanedOptions.length < 2) {
      setError('Minimal isi 2 opsi jawaban.');
      return;
    }
    const testType = subTab === 'posttest' ? 'posttest' : 'pretest';
    const payload = {
      testType,
      questionText: qText,
      optionsJson: cleanedOptions,
      correctIndex: Math.min(qCorrectIdx, cleanedOptions.length - 1),
      weight: qWeight,
      orderIndex: qOrder,
      isActive: true,
    };

    if (editingQ) {
      await apiFetch(`/api/admin/questions/${editingQ.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch('/api/admin/questions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
    setShowQModal(false);
    await loadAll();
  };

  const handleDeleteQuestion = async (q: QuestionItem) => {
    await apiFetch(`/api/admin/questions/${q.id}`, { method: 'DELETE' });
    await loadAll();
  };

  // Stage handlers
  const openStageModal = (st: StageConfig | null) => {
    setEditingStage(st);
    if (st) {
      setStKey(st.stageKey);
      setStTitle(st.title);
      setStType(st.stageType);
      setStDay(st.dayNumber);
      setStOrder(st.orderIndex);
      setStRequired(st.isRequired);
      setStActive(st.isActive);
      setStDesc(st.description);
    } else {
      setStKey(`custom_stage_${Date.now()}`);
      setStTitle('');
      setStType('upload');
      setStDay(1);
      setStOrder(stages.length + 1);
      setStRequired(true);
      setStActive(true);
      setStDesc('');
    }
    setShowStageModal(true);
  };

  const handleSaveStage = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      stageKey: stKey,
      title: stTitle,
      stageType: stType,
      dayNumber: stDay,
      orderIndex: stOrder,
      isRequired: stRequired,
      isActive: stActive,
      description: stDesc,
    };
    if (editingStage) {
      await apiFetch(`/api/admin/stages/${editingStage.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch('/api/admin/stages', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
    setShowStageModal(false);
    await loadAll();
  };

  const toggleStageActive = async (st: StageConfig) => {
    await apiFetch(`/api/admin/stages/${st.id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...st, isActive: !st.isActive }),
    });
    await loadAll();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">
          Atur Data Master Bimtek
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Kelola daftar nama LPSE, bank soal Pre-Test & Post-Test beserta bobot nilai, serta alur tahapan peserta.
        </p>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex flex-wrap p-1 bg-slate-200/70 rounded-md gap-1">
          <button
            type="button"
            onClick={() => setSubTab('lpse')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
              subTab === 'lpse'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Nama LPSE ({lpseList.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('pretest')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
              subTab === 'pretest'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pertanyaan Pre-Test ({questions.filter((q) => q.testType === 'pretest').length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('posttest')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
              subTab === 'posttest'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pertanyaan Post-Test ({questions.filter((q) => q.testType === 'posttest').length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('stages')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
              subTab === 'stages'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tahapan Peserta ({stages.length})
          </button>
        </div>

        {subTab === 'lpse' && (
          <button
            type="button"
            onClick={() => {
              setEditingLpse(null);
              setLpseName('');
              setLpseProvince('');
              setShowLpseModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah LPSE</span>
          </button>
        )}

        {(subTab === 'pretest' || subTab === 'posttest') && (
          <button
            type="button"
            onClick={() => openQuestionModal(null)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Pertanyaan {subTab === 'pretest' ? 'Pre-Test' : 'Post-Test'}</span>
          </button>
        )}

        {subTab === 'stages' && (
          <button
            type="button"
            onClick={() => openStageModal(null)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Tahapan</span>
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-sm text-slate-500">Memuat data...</div>
        ) : subTab === 'lpse' ? (
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Nama LPSE</th>
                <th className="py-3 px-4">Provinsi / Wilayah</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {lpseList.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-medium text-slate-900">{item.name}</td>
                  <td className="py-3 px-4 text-xs text-slate-600">{item.province || '-'}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Edit ${item.name}`}
                        onClick={() => {
                          setEditingLpse(item);
                          setLpseName(item.name);
                          setLpseProvince(item.province);
                          setShowLpseModal(true);
                        }}
                        className="p-1.5 text-slate-600 hover:text-slate-900"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Hapus ${item.name}`}
                        onClick={() => handleDeleteLpse(item)}
                        className="p-1.5 text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : subTab === 'pretest' || subTab === 'posttest' ? (
          <div className="divide-y divide-slate-200">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <span>Daftar soal {subTab === 'pretest' ? 'Pre-Test' : 'Post-Test'}</span>
              <span className="font-semibold text-slate-900 tabular-nums">
                Total Bobot Nilai:{' '}
                {currentQuestions.reduce((sum, q) => sum + q.weight, 0)} Poin
              </span>
            </div>
            {currentQuestions.map((q, idx) => (
              <div key={q.id} className="p-5 flex items-start justify-between gap-4">
                <div className="space-y-2 min-w-0">
                  <div className="text-sm font-semibold text-slate-900">
                    {idx + 1}. {q.questionText}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                    {(q.optionsJson || []).map((opt, optIdx) => (
                      <div
                        key={optIdx}
                        className={
                          optIdx === q.correctIndex
                            ? 'text-emerald-700 font-semibold'
                            : 'text-slate-600'
                        }
                      >
                        {String.fromCharCode(65 + optIdx)}. {opt}
                        {optIdx === q.correctIndex ? ' (Benar)' : ''}
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-slate-500 tabular-nums">
                    Bobot Nilai: {q.weight} poin · Urutan: #{q.orderIndex}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    aria-label={`Edit soal ${idx + 1}`}
                    onClick={() => openQuestionModal(q)}
                    className="p-1.5 text-slate-600 hover:text-slate-900 border border-slate-200 rounded"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Hapus soal ${idx + 1}`}
                    onClick={() => handleDeleteQuestion(q)}
                    className="p-1.5 text-red-600 hover:text-red-800 border border-red-200 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Urutan</th>
                <th className="py-3 px-4">Nama Tahapan</th>
                <th className="py-3 px-3">Hari Aktif</th>
                <th className="py-3 px-3">Tipe</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {stages.map((st) => (
                <tr key={st.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono-tabular text-xs text-slate-600">
                    #{st.orderIndex}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">{st.title}</div>
                    <div className="text-xs text-slate-500">{st.description}</div>
                  </td>
                  <td className="py-3 px-3 text-xs font-semibold text-slate-700 tabular-nums">
                    Day {st.dayNumber}
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-600">{st.stageType}</td>
                  <td className="py-3 px-3 text-xs">
                    <button
                      type="button"
                      onClick={() => toggleStageActive(st)}
                      className={`font-semibold ${
                        st.isActive ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                    >
                      {st.isActive ? 'Aktif' : 'Nonaktif'}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      aria-label={`Edit tahapan ${st.title}`}
                      onClick={() => openStageModal(st)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-300 rounded hover:bg-slate-50"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* LPSE Modal */}
      {showLpseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-slate-900">
                {editingLpse ? 'Edit Nama LPSE' : 'Tambah Nama LPSE'}
              </h2>
              <button
                type="button"
                onClick={() => setShowLpseModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveLpse} className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">Nama LPSE</label>
                <input
                  type="text"
                  required
                  value={lpseName}
                  onChange={(e) => setLpseName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">Provinsi</label>
                <input
                  type="text"
                  value={lpseProvince}
                  onChange={(e) => setLpseProvince(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLpseModal(false)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-md"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Question Modal */}
      {showQModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-lg max-w-lg w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-slate-900">
                {editingQ ? 'Edit Pertanyaan' : 'Tambah Pertanyaan'}{' '}
                {subTab === 'posttest' ? 'Post-Test' : 'Pre-Test'}
              </h2>
              <button
                type="button"
                onClick={() => setShowQModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveQuestion} className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">Pertanyaan</label>
                <textarea
                  rows={2}
                  required
                  value={qText}
                  onChange={(e) => setQText(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-700">
                  Opsi Jawaban (Pilih radio button untuk kunci jawaban benar)
                </label>
                {qOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correctOpt"
                      checked={qCorrectIdx === i}
                      onChange={() => setQCorrectIdx(i)}
                      aria-label={`Opsi ${String.fromCharCode(65 + i)} benar`}
                    />
                    <span className="text-xs font-semibold text-slate-500 w-5">
                      {String.fromCharCode(65 + i)}.
                    </span>
                    <input
                      type="text"
                      required={i < 2}
                      value={opt}
                      onChange={(e) => {
                        const next = [...qOptions];
                        next[i] = e.target.value;
                        setQOptions(next);
                      }}
                      placeholder={`Opsi ${String.fromCharCode(65 + i)}`}
                      className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-md"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Bobot Nilai</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    required
                    value={qWeight}
                    onChange={(e) => setQWeight(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-tabular"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Urutan Tampil</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={qOrder}
                    onChange={(e) => setQOrder(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-tabular"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQModal(false)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-md"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md"
                >
                  Simpan Pertanyaan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stage Modal */}
      {showStageModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-slate-900">
                {editingStage ? 'Edit Tahapan Peserta' : 'Tambah Tahapan Peserta'}
              </h2>
              <button
                type="button"
                onClick={() => setShowStageModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveStage} className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">Judul Tahapan</label>
                <input
                  type="text"
                  required
                  value={stTitle}
                  onChange={(e) => setStTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Aktif di Hari ke-</label>
                  <select
                    value={stDay}
                    onChange={(e) => setStDay(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    <option value={1}>Day 1</option>
                    <option value={2}>Day 2</option>
                    <option value={3}>Day 3</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Urutan</label>
                  <input
                    type="number"
                    min={1}
                    value={stOrder}
                    onChange={(e) => setStOrder(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-tabular"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">Deskripsi</label>
                <textarea
                  rows={2}
                  value={stDesc}
                  onChange={(e) => setStDesc(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div className="flex items-center gap-4 text-xs">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={stRequired}
                    onChange={(e) => setStRequired(e.target.checked)}
                  />
                  <span>Wajib</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={stActive}
                    onChange={(e) => setStActive(e.target.checked)}
                  />
                  <span>Aktif</span>
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStageModal(false)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-md"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
