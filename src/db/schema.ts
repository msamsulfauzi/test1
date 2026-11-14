import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  fullName: text('full_name').notNull(),
  phone: text('phone').notNull().default(''),
  jabatan: text('jabatan').notNull().default(''),
  lpseLocation: text('lpse_location').notNull().default(''),
  role: text('role').notNull().default('peserta'), // 'admin' | 'pic' | 'peserta'
  accountStatus: text('account_status').notNull().default('pending'), // 'pending' | 'approved' | 'rejected'
  verifiedBy: integer('verified_by'),
  verifiedAt: timestamp('verified_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const lpseLocations = pgTable('lpse_locations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  province: text('province').notNull().default(''),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const agendas = pgTable('agendas', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  registrationOpenAt: timestamp('registration_open_at').notNull(),
  registrationCloseAt: timestamp('registration_close_at').notNull(),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  location: text('location').notNull(),
  materialTitle: text('material_title'), // optional
  speakers: text('speakers'), // optional (comma/newline separated)
  description: text('description').notNull().default(''),
  createdBy: integer('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const agendaRegistrations = pgTable('agenda_registrations', {
  id: serial('id').primaryKey(),
  agendaId: integer('agenda_id')
    .references(() => agendas.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  status: text('status').notNull().default('pending'), // 'pending' | 'approved' | 'rejected'
  approvedBy: integer('approved_by'),
  approvedAt: timestamp('approved_at'),
  notes: text('notes').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const questions = pgTable('questions', {
  id: serial('id').primaryKey(),
  testType: text('test_type').notNull(), // 'pretest' | 'posttest'
  questionText: text('question_text').notNull(),
  optionsJson: jsonb('options_json').$type<string[]>().notNull(),
  correctIndex: integer('correct_index').notNull().default(0),
  weight: integer('weight').notNull().default(10),
  orderIndex: integer('order_index').notNull().default(1),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const bimtekStages = pgTable('bimtek_stages', {
  id: serial('id').primaryKey(),
  stageKey: text('stage_key').notNull().unique(),
  title: text('title').notNull(),
  stageType: text('stage_type').notNull(), // 'attendance' | 'upload' | 'pretest' | 'posttest' | 'eval_speaker' | 'eval_committee'
  dayNumber: integer('day_number').notNull().default(1),
  speakerNumber: integer('speaker_number'),
  orderIndex: integer('order_index').notNull().default(1),
  isRequired: boolean('is_required').notNull().default(true),
  isActive: boolean('is_active').notNull().default(true),
  description: text('description').notNull().default(''),
});

export const attendances = pgTable('attendances', {
  id: serial('id').primaryKey(),
  agendaId: integer('agenda_id')
    .references(() => agendas.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  dayNumber: integer('day_number').notNull(),
  attendanceDate: text('attendance_date').notNull(),
  checkedInAt: timestamp('checked_in_at').defaultNow().notNull(),
  notes: text('notes').notNull().default(''),
});

export const testSubmissions = pgTable('test_submissions', {
  id: serial('id').primaryKey(),
  agendaId: integer('agenda_id')
    .references(() => agendas.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  testType: text('test_type').notNull(), // 'pretest' | 'posttest'
  answersJson: jsonb('answers_json').$type<Record<string, number>>().notNull(),
  score: integer('score').notNull(),
  maxScore: integer('max_score').notNull(),
  submittedAt: timestamp('submitted_at').defaultNow().notNull(),
});

export const evaluations = pgTable('evaluations', {
  id: serial('id').primaryKey(),
  agendaId: integer('agenda_id')
    .references(() => agendas.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  targetType: text('target_type').notNull(), // 'speaker' | 'committee'
  speakerNumber: integer('speaker_number'),
  speakerName: text('speaker_name').notNull().default(''),
  ratingMastery: integer('rating_mastery').notNull(),
  ratingDelivery: integer('rating_delivery').notNull(),
  ratingMaterial: integer('rating_material').notNull(),
  comments: text('comments').notNull().default(''),
  submittedAt: timestamp('submitted_at').defaultNow().notNull(),
});

export const documentUploads = pgTable('document_uploads', {
  id: serial('id').primaryKey(),
  agendaId: integer('agenda_id')
    .references(() => agendas.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  docType: text('doc_type').notNull(), // 'komitmen' | 'tugas'
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type').notNull(),
  fileSize: integer('file_size').notNull().default(0),
  driveFileId: text('drive_file_id').notNull().default(''),
  driveWebViewLink: text('drive_web_view_link').notNull().default(''),
  storageMode: text('storage_mode').notNull().default('google_drive'),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
});

export const sheetSyncLogs = pgTable('sheet_sync_logs', {
  id: serial('id').primaryKey(),
  spreadsheetId: text('spreadsheet_id').notNull(),
  spreadsheetUrl: text('spreadsheet_url').notNull(),
  spreadsheetTitle: text('spreadsheet_title').notNull(),
  syncedBy: integer('synced_by'),
  syncedAt: timestamp('synced_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  registrations: many(agendaRegistrations),
  attendances: many(attendances),
  testSubmissions: many(testSubmissions),
  evaluations: many(evaluations),
  documentUploads: many(documentUploads),
}));

export const agendasRelations = relations(agendas, ({ many }) => ({
  registrations: many(agendaRegistrations),
  attendances: many(attendances),
  testSubmissions: many(testSubmissions),
  evaluations: many(evaluations),
  documentUploads: many(documentUploads),
}));

export const agendaRegistrationsRelations = relations(agendaRegistrations, ({ one }) => ({
  agenda: one(agendas, {
    fields: [agendaRegistrations.agendaId],
    references: [agendas.id],
  }),
  user: one(users, {
    fields: [agendaRegistrations.userId],
    references: [users.id],
  }),
}));
