export interface StageConfig {
  id: number;
  stageKey: string;
  title: string;
  stageType: string;
  dayNumber: number;
  speakerNumber: number | null;
  orderIndex: number;
  isRequired: boolean;
  isActive: boolean;
  description: string;
}

export interface AgendaDayInfo {
  todayKey: string;
  startKey: string;
  endKey: string;
  totalDays: number;
  currentDayNumber: number | null;
  agendaStatus: 'upcoming' | 'ongoing' | 'ended';
  dayDates: Record<number, string>;
}

export type StageAvailabilityStatus =
  | 'completed'
  | 'active'
  | 'upcoming'
  | 'missed'
  | 'disabled';

export interface StageAvailability {
  status: StageAvailabilityStatus;
  active: boolean;
  canViewResult: boolean;
  reason: string;
  scheduledDateKey: string;
}

export interface ScorableQuestion {
  id: number;
  correctIndex: number;
  weight: number;
  isActive?: boolean;
}

export interface TestScoreSummary {
  score: number;
  maxScore: number;
  percentage: number;
  correctCount: number;
  totalQuestions: number;
}

export function toJakartaDateKey(
  dateInput: Date | string,
  timeZone = 'Asia/Jakarta'
): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date input');
  }
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

function parseDateKeyToUtcMs(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const ms = parseDateKeyToUtcMs(dateKey) + days * 86_400_000;
  const dt = new Date(ms);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function diffCalendarDays(laterKey: string, earlierKey: string): number {
  const diffMs = parseDateKeyToUtcMs(laterKey) - parseDateKeyToUtcMs(earlierKey);
  return Math.round(diffMs / 86_400_000);
}

export function getAgendaDayInfo(
  startDate: Date | string,
  endDate: Date | string,
  now: Date | string = new Date(),
  timeZone = 'Asia/Jakarta'
): AgendaDayInfo {
  const startKey = toJakartaDateKey(startDate, timeZone);
  const endKey = toJakartaDateKey(endDate, timeZone);
  const todayKey = toJakartaDateKey(now, timeZone);

  const totalDays = Math.max(1, diffCalendarDays(endKey, startKey) + 1);
  const mapCount = Math.max(3, totalDays);
  const dayDates: Record<number, string> = {};
  for (let i = 1; i <= mapCount; i++) {
    dayDates[i] = addDaysToDateKey(startKey, i - 1);
  }

  let agendaStatus: 'upcoming' | 'ongoing' | 'ended';
  let currentDayNumber: number | null = null;

  if (todayKey < startKey) {
    agendaStatus = 'upcoming';
  } else if (todayKey > endKey) {
    agendaStatus = 'ended';
  } else {
    agendaStatus = 'ongoing';
    currentDayNumber = diffCalendarDays(todayKey, startKey) + 1;
  }

  return {
    todayKey,
    startKey,
    endKey,
    totalDays,
    currentDayNumber,
    agendaStatus,
    dayDates,
  };
}

export function isRegistrationOpen(
  registrationOpenAt: Date | string,
  registrationCloseAt: Date | string,
  now: Date | string = new Date()
): boolean {
  const openMs = new Date(registrationOpenAt).getTime();
  const closeMs = new Date(registrationCloseAt).getTime();
  const nowMs = new Date(now).getTime();
  if ([openMs, closeMs, nowMs].some((v) => Number.isNaN(v))) {
    return false;
  }
  return nowMs >= openMs && nowMs <= closeMs;
}

/**
 * Evaluates stage availability strictly by system calendar date without locking future days.
 * Even if a participant misses Day 1 or Day 2, Day 3 stages remain active on Day 3.
 */
export function computeStageAvailability(
  stage: StageConfig,
  agendaDayInfo: AgendaDayInfo,
  completedKeys: Set<string>
): StageAvailability {
  const scheduledDateKey =
    agendaDayInfo.dayDates[stage.dayNumber] ??
    addDaysToDateKey(agendaDayInfo.startKey, stage.dayNumber - 1);

  if (completedKeys.has(stage.stageKey)) {
    return {
      status: 'completed',
      active: false,
      canViewResult: true,
      reason: 'Tahapan telah diselesaikan',
      scheduledDateKey,
    };
  }

  if (!stage.isActive) {
    return {
      status: 'disabled',
      active: false,
      canViewResult: false,
      reason: 'Dinonaktifkan oleh Admin',
      scheduledDateKey,
    };
  }

  if (agendaDayInfo.agendaStatus === 'upcoming') {
    return {
      status: 'upcoming',
      active: false,
      canViewResult: false,
      reason: `Aktif pada Hari ${stage.dayNumber} (${scheduledDateKey})`,
      scheduledDateKey,
    };
  }

  if (agendaDayInfo.agendaStatus === 'ended' || agendaDayInfo.currentDayNumber === null) {
    return {
      status: 'missed',
      active: false,
      canViewResult: false,
      reason: `Periode Bimtek telah berakhir (${scheduledDateKey})`,
      scheduledDateKey,
    };
  }

  if (agendaDayInfo.currentDayNumber === stage.dayNumber) {
    return {
      status: 'active',
      active: true,
      canViewResult: false,
      reason: 'Aktif hari ini sesuai tanggal sistem',
      scheduledDateKey,
    };
  }

  if (agendaDayInfo.currentDayNumber > stage.dayNumber) {
    return {
      status: 'missed',
      active: false,
      canViewResult: false,
      reason: `Tidak aktif (tanggal Hari ${stage.dayNumber} telah lewat)`,
      scheduledDateKey,
    };
  }

  return {
    status: 'upcoming',
    active: false,
    canViewResult: false,
    reason: `Terjadwal Hari ${stage.dayNumber} (${scheduledDateKey})`,
    scheduledDateKey,
  };
}

export function calculateTestScore(
  questions: ScorableQuestion[],
  answers: Record<string, number>
): TestScoreSummary {
  const activeQuestions = questions.filter((q) => q.isActive !== false);
  let score = 0;
  let maxScore = 0;
  let correctCount = 0;

  for (const q of activeQuestions) {
    const weight = Math.max(0, Number(q.weight) || 0);
    maxScore += weight;
    const selected = answers[String(q.id)];
    if (typeof selected === 'number' && selected === q.correctIndex) {
      score += weight;
      correctCount += 1;
    }
  }

  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  return {
    score,
    maxScore,
    percentage,
    correctCount,
    totalQuestions: activeQuestions.length,
  };
}

export function parseSpeakersList(speakersText: string | null | undefined): string[] {
  if (!speakersText || !speakersText.trim()) return [];
  return speakersText
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getSpeakerName(
  speakersText: string | null | undefined,
  speakerNumber: number | null
): string {
  if (!speakerNumber) return 'Narasumber';
  const list = parseSpeakersList(speakersText);
  return list[speakerNumber - 1] || `Narasumber ${speakerNumber}`;
}

export const LPSE_OTHER_OPTION = '__OTHER__';

export function resolveLpseSelection(
  selectedOption: string | null | undefined,
  customLpseName: string | null | undefined
): { valid: true; value: string } | { valid: false; error: string } {
  const selected = (selectedOption || '').trim();
  if (!selected) {
    return { valid: false, error: 'Lokasi LPSE wajib dipilih.' };
  }
  if (selected === LPSE_OTHER_OPTION || selected.toLowerCase() === 'lpse lainnya') {
    const custom = (customLpseName || '').trim();
    if (!custom) {
      return {
        valid: false,
        error: 'Nama LPSE wajib diisi ketika memilih LPSE Lainnya.',
      };
    }
    return { valid: true, value: custom };
  }
  return { valid: true, value: selected };
}

export function splitLpseValue(
  currentValue: string | null | undefined,
  knownLpseNames: string[]
): { selectedOption: string; customLpseName: string } {
  const val = (currentValue || '').trim();
  if (!val) {
    return {
      selectedOption: knownLpseNames[0] || LPSE_OTHER_OPTION,
      customLpseName: '',
    };
  }
  if (knownLpseNames.includes(val)) {
    return { selectedOption: val, customLpseName: '' };
  }
  return { selectedOption: LPSE_OTHER_OPTION, customLpseName: val };
}

export function extractSpreadsheetId(input: string | null | undefined): string {
  const raw = (input || '').trim();
  if (!raw) return '';
  const match = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : raw;
}

export interface MonitoringInputParticipant {
  userId: number;
  fullName: string;
  email: string;
  lpseLocation: string;
  jabatan: string;
  registrationStatus: string;
}

export interface MonitoringCellState {
  completed: boolean;
  detail: string;
}

export interface ParticipantChecklistRow extends MonitoringInputParticipant {
  completedCount: number;
  totalStages: number;
  stageStates: Record<string, MonitoringCellState>;
}

export function buildParticipantChecklistMatrix(params: {
  participants: MonitoringInputParticipant[];
  stages: StageConfig[];
  attendances: Array<{ userId: number; dayNumber: number; attendanceDate: string }>;
  tests: Array<{ userId: number; testType: string; score: number; maxScore: number }>;
  evaluations: Array<{
    userId: number;
    targetType: string;
    speakerNumber: number | null;
    ratingMastery: number;
    ratingDelivery: number;
    ratingMaterial: number;
  }>;
  documents: Array<{ userId: number; docType: string; fileName: string }>;
}): ParticipantChecklistRow[] {
  const activeStages = params.stages.filter((s) => s.isActive);

  return params.participants.map((p) => {
    const userAtt = params.attendances.filter((a) => a.userId === p.userId);
    const userTests = params.tests.filter((t) => t.userId === p.userId);
    const userEvals = params.evaluations.filter((e) => e.userId === p.userId);
    const userDocs = params.documents.filter((d) => d.userId === p.userId);

    const stageStates: Record<string, MonitoringCellState> = {};
    let completedCount = 0;

    for (const st of activeStages) {
      let state: MonitoringCellState = { completed: false, detail: 'Belum' };

      if (st.stageType === 'attendance') {
        const found = userAtt.find((a) => a.dayNumber === st.dayNumber);
        if (found) {
          state = { completed: true, detail: `Hadir (${found.attendanceDate})` };
        }
      } else if (st.stageType === 'pretest' || st.stageType === 'posttest') {
        const found = userTests.find((t) => t.testType === st.stageType);
        if (found) {
          state = { completed: true, detail: `${found.score}/${found.maxScore}` };
        }
      } else if (st.stageType === 'eval_speaker') {
        const found = userEvals.find(
          (e) => e.targetType === 'speaker' && e.speakerNumber === st.speakerNumber
        );
        if (found) {
          const avg = (
            (found.ratingMastery + found.ratingDelivery + found.ratingMaterial) /
            3
          ).toFixed(1);
          state = { completed: true, detail: `Skor ${avg}/5` };
        }
      } else if (st.stageType === 'eval_committee') {
        const found = userEvals.find((e) => e.targetType === 'committee');
        if (found) {
          const avg = (
            (found.ratingMastery + found.ratingDelivery + found.ratingMaterial) /
            3
          ).toFixed(1);
          state = { completed: true, detail: `Skor ${avg}/5` };
        }
      } else if (st.stageType === 'upload') {
        const targetDocType =
          st.stageKey === 'upload_komitmen' ? 'komitmen' : 'tugas';
        const found = userDocs.find((d) => d.docType === targetDocType);
        if (found) {
          state = { completed: true, detail: found.fileName };
        }
      }

      if (state.completed) completedCount += 1;
      stageStates[st.stageKey] = state;
    }

    return {
      ...p,
      completedCount,
      totalStages: activeStages.length,
      stageStates,
    };
  });
}

