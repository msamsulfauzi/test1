import type {
  AgendaDayInfo,
  ParticipantChecklistRow,
  StageAvailability,
  StageConfig,
} from '../utils/bimtekLogic';

export type UserRole = 'admin' | 'pic' | 'peserta';
export type AccountStatus = 'pending' | 'approved' | 'rejected';
export type RegistrationStatus = 'pending' | 'approved' | 'rejected';

export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  phone: string;
  jabatan: string;
  lpseLocation: string;
  role: UserRole;
  accountStatus: AccountStatus;
  hasPassword?: boolean;
  createdAt: string;
}

export interface LpseLocationItem {
  id: number;
  name: string;
  province: string;
  isActive: boolean;
}

export interface BimtekAgenda {
  id: number;
  title: string;
  registrationOpenAt: string;
  registrationCloseAt: string;
  startDate: string;
  endDate: string;
  location: string;
  materialTitle: string | null;
  speakers: string | null;
  description: string;
  registrationOpen?: boolean;
  dayInfo?: AgendaDayInfo;
  myRegistration?: {
    id: number;
    status: RegistrationStatus;
    createdAt: string;
  } | null;
}

export interface AgendaRegistrationRecord {
  id: number;
  agendaId: number;
  agendaTitle: string;
  agendaStartDate: string;
  agendaEndDate: string;
  agendaLocation: string;
  userId: number;
  userName: string;
  userEmail: string;
  userPhone: string;
  userJabatan: string;
  userLpse: string;
  status: RegistrationStatus;
  notes: string;
  createdAt: string;
}

export interface QuestionItem {
  id: number;
  testType: 'pretest' | 'posttest';
  questionText: string;
  optionsJson: string[];
  correctIndex?: number;
  weight: number;
  orderIndex: number;
  isActive: boolean;
}

export interface RoomStage extends StageConfig {
  availability: StageAvailability;
}

export interface AttendanceRecord {
  id: number;
  dayNumber: number;
  attendanceDate: string;
  checkedInAt: string;
}

export interface TestSubmissionRecord {
  id: number;
  testType: 'pretest' | 'posttest';
  score: number;
  maxScore: number;
  submittedAt: string;
}

export interface EvaluationRecord {
  id: number;
  targetType: 'speaker' | 'committee';
  speakerNumber: number | null;
  speakerName: string;
  ratingMastery: number;
  ratingDelivery: number;
  ratingMaterial: number;
  comments: string;
  submittedAt: string;
}

export interface DocumentUploadRecord {
  id: number;
  docType: 'komitmen' | 'tugas';
  fileName: string;
  mimeType: string;
  fileSize: number;
  driveFileId: string;
  driveWebViewLink: string;
  storageMode: string;
  uploadedAt: string;
}

export interface RoomData {
  agenda: BimtekAgenda;
  dayInfo: AgendaDayInfo;
  stages: RoomStage[];
  attendances: AttendanceRecord[];
  testSubmissions: TestSubmissionRecord[];
  evaluations: EvaluationRecord[];
  documentUploads: DocumentUploadRecord[];
  pretestQuestions: QuestionItem[];
  posttestQuestions: QuestionItem[];
}

export interface AgendaRekapRow {
  agendaId: number;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  registrationOpenAt: string;
  registrationCloseAt: string;
  totalRegistrants: number;
  approvedParticipants: number;
  pendingRegistrants: number;
  day1Attendance: number;
  day2Attendance: number;
  day3Attendance: number;
  pretestCompleted: number;
  avgPretest: number | null;
  posttestCompleted: number;
  avgPosttest: number | null;
  evaluationsCount: number;
  uploadsCount: number;
}

export interface ParticipantRekapDetail {
  registrationId: number;
  agendaTitle: string;
  fullName: string;
  email: string;
  lpseLocation: string;
  jabatan: string;
  registrationStatus: string;
  absenDay1: string;
  absenDay2: string;
  absenDay3: string;
  pretestScore: string;
  posttestScore: string;
  komitmenStatus: string;
  tugasStatus: string;
}

export interface SheetSyncLogItem {
  id: number;
  spreadsheetId: string;
  spreadsheetUrl: string;
  spreadsheetTitle: string;
  syncedAt: string;
}

export interface MonitoringAgendaSummary {
  id: number;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  speakers: string | null;
  dayInfo: AgendaDayInfo;
}

export interface MonitoringResponse {
  agendas: MonitoringAgendaSummary[];
  selectedAgenda: MonitoringAgendaSummary | null;
  stages: StageConfig[];
  participants: ParticipantChecklistRow[];
}

export interface ExportDatasetItem {
  key: string;
  fileName: string;
  title: string;
  description: string;
  category: 'Agenda & Kelas' | 'Peserta & User' | 'Aktivitas & Evaluasi' | 'Master Data';
  headers: string[];
  rows: Array<Array<string | number | boolean>>;
}

export interface AdminExportResponse {
  exportedAt: string;
  filterAgendaId: number | null;
  agendas: Array<{ id: number; title: string; startDate: string; endDate: string }>;
  summary: {
    totalAgendas: number;
    totalUsers: number;
    totalPeserta: number;
    totalRegistrations: number;
    totalAttendances: number;
    totalTestSubmissions: number;
    totalEvaluations: number;
    totalDocuments: number;
  };
  datasets: ExportDatasetItem[];
  rawBackup: Record<string, unknown[]>;
}

