import { getApps, initializeApp } from 'firebase/app';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  setDoc,
  updateDoc,
} from 'firebase/firestore/lite';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

const BRIDGE_KEY =
  process.env.FIRESTORE_BRIDGE_KEY ||
  '53ad33dfef4c0de282438dded3c2bf452069f80f307cfa5c';

const app = getApps().find((a) => a.name === 'portal-server-firestore')
  ? getApps().find((a) => a.name === 'portal-server-firestore')!
  : initializeApp(firebaseConfig, 'portal-server-firestore');

const firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export interface UserRow {
  id: number;
  uid: string;
  email: string;
  passwordHash: string | null;
  fullName: string;
  phone: string;
  jabatan: string;
  lpseLocation: string;
  role: string;
  accountStatus: string;
  verifiedBy: number | null;
  verifiedAt: Date | null;
  createdAt: Date;
}

export interface LpseLocationRow {
  id: number;
  name: string;
  province: string;
  isActive: boolean;
  createdAt: Date;
}

export interface AgendaRow {
  id: number;
  title: string;
  registrationOpenAt: Date;
  registrationCloseAt: Date;
  startDate: Date;
  endDate: Date;
  location: string;
  materialTitle: string | null;
  speakers: string | null;
  description: string;
  createdBy: number | null;
  createdAt: Date;
}

export interface AgendaRegistrationRow {
  id: number;
  agendaId: number;
  userId: number;
  status: string;
  approvedBy: number | null;
  approvedAt: Date | null;
  notes: string;
  createdAt: Date;
}

export interface QuestionRow {
  id: number;
  testType: string;
  questionText: string;
  optionsJson: string[];
  correctIndex: number;
  weight: number;
  orderIndex: number;
  isActive: boolean;
  createdAt: Date;
}

export interface BimtekStageRow {
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

export interface AttendanceRow {
  id: number;
  agendaId: number;
  userId: number;
  dayNumber: number;
  attendanceDate: string;
  checkedInAt: Date;
  notes: string;
}

export interface TestSubmissionRow {
  id: number;
  agendaId: number;
  userId: number;
  testType: string;
  answersJson: Record<string, number>;
  score: number;
  maxScore: number;
  submittedAt: Date;
}

export interface EvaluationRow {
  id: number;
  agendaId: number;
  userId: number;
  targetType: string;
  speakerNumber: number | null;
  speakerName: string;
  ratingMastery: number;
  ratingDelivery: number;
  ratingMaterial: number;
  comments: string;
  submittedAt: Date;
}

export interface DocumentUploadRow {
  id: number;
  agendaId: number;
  userId: number;
  docType: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  driveFileId: string;
  driveWebViewLink: string;
  storageMode: string;
  uploadedAt: Date;
}

export interface SheetSyncLogRow {
  id: number;
  spreadsheetId: string;
  spreadsheetUrl: string;
  spreadsheetTitle: string;
  syncedBy: number | null;
  syncedAt: Date;
}

type CollectionName =
  | 'users'
  | 'lpse_locations'
  | 'agendas'
  | 'agenda_registrations'
  | 'questions'
  | 'bimtek_stages'
  | 'attendances'
  | 'test_submissions'
  | 'evaluations'
  | 'document_uploads'
  | 'sheet_sync_logs';

const DATE_FIELDS = new Set([
  'verifiedAt',
  'createdAt',
  'registrationOpenAt',
  'registrationCloseAt',
  'startDate',
  'endDate',
  'approvedAt',
  'checkedInAt',
  'submittedAt',
  'uploadedAt',
  'syncedAt',
]);

function serializeDoc(record: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(record)) {
    if (v === undefined) continue;
    if (v instanceof Date) {
      out[k] = v.toISOString();
    } else {
      out[k] = v;
    }
  }
  return out;
}

function hydrateDoc<T>(data: Record<string, any>): T {
  const out: Record<string, any> = { ...data };
  for (const field of DATE_FIELDS) {
    if (out[field] !== undefined && out[field] !== null) {
      out[field] = new Date(out[field]);
    }
  }
  return out as T;
}

let counterMutex: Promise<void> = Promise.resolve();

async function allocateIds(
  collectionName: CollectionName,
  count: number
): Promise<number[]> {
  let resultIds: number[] = [];
  const next = counterMutex.then(async () => {
    const counterRef = doc(
      firestoreDb,
      'portal_data',
      BRIDGE_KEY,
      '_meta',
      'counters'
    );
    const snap = await getDoc(counterRef);
    const counters = snap.exists() ? (snap.data() as Record<string, number>) : {};
    const current = Number(counters[collectionName] || 0);
    const ids: number[] = [];
    for (let i = 1; i <= count; i++) {
      ids.push(current + i);
    }
    await setDoc(
      counterRef,
      { ...counters, [collectionName]: current + count },
      { merge: true }
    );
    resultIds = ids;
  });
  counterMutex = next.catch(() => {});
  await next;
  return resultIds;
}

function colRef(name: CollectionName) {
  return collection(firestoreDb, 'portal_data', BRIDGE_KEY, name);
}

function itemRef(name: CollectionName, id: number | string) {
  return doc(firestoreDb, 'portal_data', BRIDGE_KEY, name, String(id));
}

export async function listCollection<T>(name: CollectionName): Promise<T[]> {
  const snap = await getDocs(colRef(name));
  return snap.docs.map((d) => hydrateDoc<T>(d.data()));
}

export async function getById<T>(
  name: CollectionName,
  id: number
): Promise<T | null> {
  const snap = await getDoc(itemRef(name, id));
  if (!snap.exists()) return null;
  return hydrateDoc<T>(snap.data());
}

export async function insertMany<T extends { id: number }>(
  name: CollectionName,
  items: Array<Omit<T, 'id'>>
): Promise<T[]> {
  if (items.length === 0) return [];
  const ids = await allocateIds(name, items.length);
  const created: T[] = [];
  await Promise.all(
    items.map(async (item, idx) => {
      const id = ids[idx];
      const full = { ...item, id } as T;
      await setDoc(itemRef(name, id), serializeDoc(full));
      created[idx] = full;
    })
  );
  return created;
}

export async function insertOne<T extends { id: number }>(
  name: CollectionName,
  item: Omit<T, 'id'>
): Promise<T> {
  const [created] = await insertMany<T>(name, [item]);
  return created;
}

export async function updateById<T>(
  name: CollectionName,
  id: number,
  patch: Partial<T>
): Promise<T | null> {
  const ref = itemRef(name, id);
  const existing = await getDoc(ref);
  if (!existing.exists()) return null;
  const serialized = serializeDoc(patch as Record<string, any>);
  await updateDoc(ref, serialized);
  const updatedSnap = await getDoc(ref);
  return updatedSnap.exists() ? hydrateDoc<T>(updatedSnap.data()) : null;
}

export async function removeById(
  name: CollectionName,
  id: number
): Promise<void> {
  await deleteDoc(itemRef(name, id));
}
