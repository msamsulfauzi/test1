import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildParticipantChecklistMatrix,
  calculateTestScore,
  computeStageAvailability,
  extractSpreadsheetId,
  getAgendaDayInfo,
  getSpeakerName,
  isRegistrationOpen,
  LPSE_OTHER_OPTION,
  parseSpeakersList,
  resolveLpseSelection,
  splitLpseValue,
  type StageConfig,
} from './bimtekLogic';

const makeStage = (
  stageKey: string,
  dayNumber: number,
  stageType = 'attendance'
): StageConfig => ({
  id: dayNumber,
  stageKey,
  title: stageKey,
  stageType,
  dayNumber,
  speakerNumber: null,
  orderIndex: 1,
  isRequired: true,
  isActive: true,
  description: '',
});

test('getAgendaDayInfo identifies Day 1, Day 2, Day 3, upcoming, and ended', () => {
  const start = '2026-11-12T08:00:00+07:00';
  const end = '2026-11-14T16:00:00+07:00';

  assert.equal(
    getAgendaDayInfo(start, end, '2026-11-11T10:00:00+07:00').agendaStatus,
    'upcoming'
  );
  assert.equal(
    getAgendaDayInfo(start, end, '2026-11-12T09:00:00+07:00').currentDayNumber,
    1
  );
  assert.equal(
    getAgendaDayInfo(start, end, '2026-11-13T14:00:00+07:00').currentDayNumber,
    2
  );
  assert.equal(
    getAgendaDayInfo(start, end, '2026-11-14T15:00:00+07:00').currentDayNumber,
    3
  );
  assert.equal(
    getAgendaDayInfo(start, end, '2026-11-15T09:00:00+07:00').agendaStatus,
    'ended'
  );
});

test('non-locking stage rule: missing Day 2 does NOT lock Day 3 stages', () => {
  const start = '2026-11-12T08:00:00+07:00';
  const end = '2026-11-14T16:00:00+07:00';
  // System date is Day 3
  const dayInfo = getAgendaDayInfo(start, end, '2026-11-14T10:00:00+07:00');
  assert.equal(dayInfo.currentDayNumber, 3);

  // Participant completed Day 1 only, missed Day 2 completely
  const completed = new Set(['absen_day_1', 'upload_komitmen', 'pretest']);

  const day2Absen = computeStageAvailability(
    makeStage('absen_day_2', 2, 'attendance'),
    dayInfo,
    completed
  );
  const day2Speaker3 = computeStageAvailability(
    makeStage('eval_narasumber_3', 2, 'eval_speaker'),
    dayInfo,
    completed
  );
  assert.equal(day2Absen.active, false);
  assert.equal(day2Absen.status, 'missed');
  assert.equal(day2Speaker3.active, false);
  assert.equal(day2Speaker3.status, 'missed');

  // Day 3 buttons MUST remain active despite missed Day 2
  const day3Absen = computeStageAvailability(
    makeStage('absen_day_3', 3, 'attendance'),
    dayInfo,
    completed
  );
  const day3PostTest = computeStageAvailability(
    makeStage('posttest', 3, 'posttest'),
    dayInfo,
    completed
  );
  const day3Upload = computeStageAvailability(
    makeStage('upload_tugas', 3, 'upload'),
    dayInfo,
    completed
  );
  assert.equal(day3Absen.active, true);
  assert.equal(day3Absen.status, 'active');
  assert.equal(day3PostTest.active, true);
  assert.equal(day3Upload.active, true);
});

test('isRegistrationOpen enforces open and close timestamps', () => {
  const open = '2026-11-01T00:00:00+07:00';
  const close = '2026-11-14T23:59:59+07:00';

  assert.equal(isRegistrationOpen(open, close, '2026-10-31T23:59:00+07:00'), false);
  assert.equal(isRegistrationOpen(open, close, '2026-11-10T12:00:00+07:00'), true);
  assert.equal(isRegistrationOpen(open, close, '2026-11-15T00:01:00+07:00'), false);
});

test('calculateTestScore computes weighted scores accurately', () => {
  const questions = [
    { id: 1, correctIndex: 2, weight: 25, isActive: true },
    { id: 2, correctIndex: 0, weight: 35, isActive: true },
    { id: 3, correctIndex: 1, weight: 40, isActive: true },
    { id: 4, correctIndex: 0, weight: 20, isActive: false },
  ];
  const answers = { '1': 2, '2': 1, '3': 1 };

  const summary = calculateTestScore(questions, answers);
  assert.equal(summary.score, 65);
  assert.equal(summary.maxScore, 100);
  assert.equal(summary.percentage, 65);
  assert.equal(summary.correctCount, 2);
  assert.equal(summary.totalQuestions, 3);
});

test('parseSpeakersList and getSpeakerName handle optional/partial inputs', () => {
  assert.deepEqual(parseSpeakersList(''), []);
  assert.deepEqual(parseSpeakersList(null), []);
  const parsed = parseSpeakersList('Dr. Andi Wijaya, Siti Aminah, Budi H.');
  assert.equal(parsed.length, 3);
  assert.equal(getSpeakerName('Dr. Andi Wijaya, Siti Aminah', 2), 'Siti Aminah');
  assert.equal(getSpeakerName('Dr. Andi Wijaya, Siti Aminah', 5), 'Narasumber 5');
});

test('resolveLpseSelection handles standard LPSE and LPSE Lainnya freetext', () => {
  assert.deepEqual(resolveLpseSelection('LPSE Kota Bandung', ''), {
    valid: true,
    value: 'LPSE Kota Bandung',
  });
  assert.equal(resolveLpseSelection(LPSE_OTHER_OPTION, '   ').valid, false);
  assert.deepEqual(resolveLpseSelection(LPSE_OTHER_OPTION, 'LPSE Kabupaten Sleman'), {
    valid: true,
    value: 'LPSE Kabupaten Sleman',
  });
  assert.deepEqual(
    splitLpseValue('LPSE Kota Bandung', ['LPSE Kota Bandung', 'LPSE Provinsi Jawa Barat']),
    { selectedOption: 'LPSE Kota Bandung', customLpseName: '' }
  );
  assert.deepEqual(
    splitLpseValue('LPSE Kabupaten Sleman', ['LPSE Kota Bandung', 'LPSE Provinsi Jawa Barat']),
    { selectedOption: LPSE_OTHER_OPTION, customLpseName: 'LPSE Kabupaten Sleman' }
  );
});

test('extractSpreadsheetId parses full Google Sheets URL or raw ID', () => {
  assert.equal(
    extractSpreadsheetId(
      'https://docs.google.com/spreadsheets/d/1AbC_xyz-123/edit#gid=0'
    ),
    '1AbC_xyz-123'
  );
  assert.equal(extractSpreadsheetId('1AbC_xyz-123'), '1AbC_xyz-123');
  assert.equal(extractSpreadsheetId(''), '');
});

test('buildParticipantChecklistMatrix maps completion per participant across stages', () => {
  const stages: StageConfig[] = [
    makeStage('absen_day_1', 1, 'attendance'),
    makeStage('upload_komitmen', 1, 'upload'),
    makeStage('pretest', 1, 'pretest'),
    { ...makeStage('eval_narasumber_1', 1, 'eval_speaker'), speakerNumber: 1 },
  ];
  const rows = buildParticipantChecklistMatrix({
    participants: [
      {
        userId: 10,
        fullName: 'Budi',
        email: 'budi@lpse.go.id',
        lpseLocation: 'LPSE Jabar',
        jabatan: 'Admin',
        registrationStatus: 'approved',
      },
    ],
    stages,
    attendances: [{ userId: 10, dayNumber: 1, attendanceDate: '2026-11-14' }],
    tests: [{ userId: 10, testType: 'pretest', score: 75, maxScore: 100 }],
    evaluations: [],
    documents: [{ userId: 10, docType: 'komitmen', fileName: 'komitmen.pdf' }],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].completedCount, 3);
  assert.equal(rows[0].totalStages, 4);
  assert.equal(rows[0].stageStates['absen_day_1'].completed, true);
  assert.equal(rows[0].stageStates['upload_komitmen'].completed, true);
  assert.equal(rows[0].stageStates['pretest'].detail, '75/100');
  assert.equal(rows[0].stageStates['eval_narasumber_1'].completed, false);
});
