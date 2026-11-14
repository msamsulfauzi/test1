import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import {
  getById,
  insertOne,
  listCollection,
  removeById,
  updateById,
  type AgendaRegistrationRow,
  type AgendaRow,
  type AttendanceRow,
  type BimtekStageRow,
  type DocumentUploadRow,
  type EvaluationRow,
  type LpseLocationRow,
  type QuestionRow,
  type SheetSyncLogRow,
  type TestSubmissionRow,
  type UserRow,
} from './src/db/firestore-store.ts';
import { ensureSeedData } from './src/db/seed.ts';
import {
  hashPassword,
  signSessionToken,
  verifyPassword,
} from './src/lib/auth-crypto.ts';
import { adminAuth } from './src/lib/firebase-admin.ts';
import {
  requireAuth,
  requireRole,
  resolveUserFromRequest,
  type AuthRequest,
} from './src/middleware/auth.ts';
import {
  buildParticipantChecklistMatrix,
  calculateTestScore,
  computeStageAvailability,
  extractSpreadsheetId,
  getAgendaDayInfo,
  getSpeakerName,
  isRegistrationOpen,
  resolveLpseSelection,
  toJakartaDateKey,
} from './src/utils/bimtekLogic.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function sanitizeUser(u: UserRow) {
  return {
    id: u.id,
    uid: u.uid,
    email: u.email,
    fullName: u.fullName,
    phone: u.phone,
    jabatan: u.jabatan,
    lpseLocation: u.lpseLocation,
    role: u.role,
    accountStatus: u.accountStatus,
    hasPassword: Boolean(u.passwordHash),
    createdAt: u.createdAt,
  };
}

function sortByStartDateDesc<T extends { startDate: Date }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
}

function sortByCreatedDesc<T extends { createdAt: Date }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

function sortStages<T extends { dayNumber: number; orderIndex: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) =>
    a.dayNumber !== b.dayNumber ? a.dayNumber - b.dayNumber : a.orderIndex - b.orderIndex
  );
}

function sortQuestions<T extends { testType: string; orderIndex: number; id: number }>(
  rows: T[]
): T[] {
  return [...rows].sort((a, b) => {
    if (a.testType !== b.testType) return a.testType.localeCompare(b.testType);
    if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
    return a.id - b.id;
  });
}

async function computeRekapData() {
  const [allAgendasRaw, allRegs, allUsers, allAtt, allTests, allEvals, allDocs] =
    await Promise.all([
      listCollection<AgendaRow>('agendas'),
      listCollection<AgendaRegistrationRow>('agenda_registrations'),
      listCollection<UserRow>('users'),
      listCollection<AttendanceRow>('attendances'),
      listCollection<TestSubmissionRow>('test_submissions'),
      listCollection<EvaluationRow>('evaluations'),
      listCollection<DocumentUploadRow>('document_uploads'),
    ]);

  const allAgendas = sortByStartDateDesc(allAgendasRaw);
  const userMap = new Map(allUsers.map((u) => [u.id, u]));
  const agendaMap = new Map(allAgendas.map((a) => [a.id, a]));

  const agendaRekap = allAgendas.map((ag) => {
    const regs = allRegs.filter((r) => r.agendaId === ag.id);
    const approved = regs.filter((r) => r.status === 'approved');
    const pending = regs.filter((r) => r.status === 'pending');
    const att = allAtt.filter((a) => a.agendaId === ag.id);
    const tests = allTests.filter((t) => t.agendaId === ag.id);
    const pretests = tests.filter((t) => t.testType === 'pretest');
    const posttests = tests.filter((t) => t.testType === 'posttest');
    const evals = allEvals.filter((e) => e.agendaId === ag.id);
    const docs = allDocs.filter((d) => d.agendaId === ag.id);

    const avgPre =
      pretests.length > 0
        ? Math.round(
            pretests.reduce((sum, t) => sum + t.score, 0) / pretests.length
          )
        : null;
    const avgPost =
      posttests.length > 0
        ? Math.round(
            posttests.reduce((sum, t) => sum + t.score, 0) / posttests.length
          )
        : null;

    return {
      agendaId: ag.id,
      title: ag.title,
      location: ag.location,
      startDate: ag.startDate.toISOString(),
      endDate: ag.endDate.toISOString(),
      registrationOpenAt: ag.registrationOpenAt.toISOString(),
      registrationCloseAt: ag.registrationCloseAt.toISOString(),
      totalRegistrants: regs.length,
      approvedParticipants: approved.length,
      pendingRegistrants: pending.length,
      day1Attendance: att.filter((a) => a.dayNumber === 1).length,
      day2Attendance: att.filter((a) => a.dayNumber === 2).length,
      day3Attendance: att.filter((a) => a.dayNumber === 3).length,
      pretestCompleted: pretests.length,
      avgPretest: avgPre,
      posttestCompleted: posttests.length,
      avgPosttest: avgPost,
      evaluationsCount: evals.length,
      uploadsCount: docs.length,
    };
  });

  const participantDetails = allRegs.map((reg) => {
    const u = userMap.get(reg.userId);
    const ag = agendaMap.get(reg.agendaId);
    const userAtt = allAtt.filter(
      (a) => a.agendaId === reg.agendaId && a.userId === reg.userId
    );
    const userTests = allTests.filter(
      (t) => t.agendaId === reg.agendaId && t.userId === reg.userId
    );
    const userDocs = allDocs.filter(
      (d) => d.agendaId === reg.agendaId && d.userId === reg.userId
    );

    const pre = userTests.find((t) => t.testType === 'pretest');
    const post = userTests.find((t) => t.testType === 'posttest');
    const kom = userDocs.find((d) => d.docType === 'komitmen');
    const tgs = userDocs.find((d) => d.docType === 'tugas');

    return {
      registrationId: reg.id,
      agendaTitle: ag?.title || '-',
      fullName: u?.fullName || '-',
      email: u?.email || '-',
      lpseLocation: u?.lpseLocation || '-',
      jabatan: u?.jabatan || '-',
      registrationStatus: reg.status,
      absenDay1: userAtt.some((a) => a.dayNumber === 1) ? 'Hadir' : '-',
      absenDay2: userAtt.some((a) => a.dayNumber === 2) ? 'Hadir' : '-',
      absenDay3: userAtt.some((a) => a.dayNumber === 3) ? 'Hadir' : '-',
      pretestScore: pre ? `${pre.score}/${pre.maxScore}` : '-',
      posttestScore: post ? `${post.score}/${post.maxScore}` : '-',
      komitmenStatus: kom
        ? kom.driveWebViewLink || 'Terunggah'
        : 'Belum Unggah',
      tugasStatus: tgs
        ? tgs.driveWebViewLink || 'Terunggah'
        : 'Belum Unggah',
    };
  });

  return { agendaRekap, participantDetails };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));
  app.use(cookieParser());

  // Lazy DB seed on first API traffic
  app.use('/api', async (_req, res, next) => {
    try {
      await ensureSeedData();
      next();
    } catch (err) {
      console.error('Database initialization error:', err);
      res.status(500).json({
        error: 'Gagal terhubung ke database cloud. Silakan coba lagi.',
      });
    }
  });

  // ------------------------------------------------------------------
  // AUTH ROUTES
  // ------------------------------------------------------------------
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const {
        fullName,
        email,
        phone,
        jabatan,
        lpseLocation,
        customLpseName,
        password,
      } = req.body || {};

      const lpseCheck = resolveLpseSelection(lpseLocation, customLpseName);
      if (!lpseCheck.valid) {
        return res.status(400).json({ error: lpseCheck.error });
      }

      if (
        !fullName?.trim() ||
        !email?.trim() ||
        !phone?.trim() ||
        !jabatan?.trim() ||
        !password ||
        String(password).length < 6
      ) {
        return res.status(400).json({
          error:
            'Seluruh kolom pendaftaran wajib diisi dan password minimal 6 karakter.',
        });
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const allUsers = await listCollection<UserRow>('users');
      const existing = allUsers.find((u) => u.email === normalizedEmail);

      if (existing) {
        return res.status(409).json({
          error: 'Email tersebut sudah terdaftar di sistem.',
        });
      }

      const uid = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const inserted = await insertOne<UserRow>('users', {
        uid,
        email: normalizedEmail,
        passwordHash: hashPassword(String(password)),
        fullName: String(fullName).trim(),
        phone: String(phone).trim(),
        jabatan: String(jabatan).trim(),
        lpseLocation: lpseCheck.value,
        role: 'peserta',
        accountStatus: 'pending',
        verifiedBy: null,
        verifiedAt: null,
        createdAt: new Date(),
      });

      return res.status(201).json({
        user: sanitizeUser(inserted),
        message:
          'Pendaftaran berhasil dikirim. Akun Anda saat ini menunggu verifikasi oleh PIC.',
      });
    } catch (error) {
      console.error('Register error:', error);
      return res.status(500).json({ error: 'Gagal mendaftarkan peserta.' });
    }
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body || {};
      if (!email?.trim() || !password) {
        return res.status(400).json({
          error: 'Email dan password wajib diisi.',
        });
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const allUsers = await listCollection<UserRow>('users');
      const user = allUsers.find((u) => u.email === normalizedEmail);

      if (!user || !user.passwordHash || !verifyPassword(String(password), user.passwordHash)) {
        return res.status(401).json({
          error: 'Email atau password tidak sesuai.',
        });
      }

      const token = signSessionToken({
        userId: user.id,
        role: user.role,
        email: user.email,
      });

      res.cookie('bimtek_session', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.json({
        user: sanitizeUser(user),
        sessionToken: token,
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ error: 'Gagal memproses login.' });
    }
  });

  app.post('/api/auth/google', async (req: Request, res: Response) => {
    try {
      const { idToken } = req.body || {};
      if (!idToken) {
        return res.status(400).json({ error: 'Firebase ID token wajib disertakan.' });
      }
      const decoded = await adminAuth.verifyIdToken(String(idToken));
      const email = (decoded.email || '').toLowerCase();
      if (!email) {
        return res.status(400).json({ error: 'Email Google tidak ditemukan.' });
      }

      const allUsers = await listCollection<UserRow>('users');
      let user = allUsers.find((u) => u.email === email);
      if (!user) {
        const byUid = allUsers.find((u) => u.uid === decoded.uid);
        if (byUid) {
          user = (await updateById<UserRow>('users', byUid.id, { email })) || byUid;
        } else {
          user = await insertOne<UserRow>('users', {
            uid: decoded.uid,
            email,
            passwordHash: null,
            fullName: decoded.name || email.split('@')[0],
            phone: '',
            jabatan: '',
            lpseLocation: '',
            role: 'peserta',
            accountStatus: 'pending',
            verifiedBy: null,
            verifiedAt: null,
            createdAt: new Date(),
          });
        }
      }

      const token = signSessionToken({
        userId: user.id,
        role: user.role,
        email: user.email,
      });

      res.cookie('bimtek_session', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.json({
        user: sanitizeUser(user),
        sessionToken: token,
      });
    } catch (error) {
      console.error('Google auth error:', error);
      return res.status(401).json({ error: 'Token Google tidak valid.' });
    }
  });

  app.post('/api/auth/logout', (_req: Request, res: Response) => {
    res.clearCookie('bimtek_session');
    res.json({ ok: true });
  });

  app.get('/api/auth/me', async (req: Request, res: Response) => {
    try {
      const user = await resolveUserFromRequest(req);
      if (!user) {
        return res.json({ user: null });
      }
      return res.json({ user: sanitizeUser(user) });
    } catch (error) {
      console.error('Auth me error:', error);
      return res.json({ user: null });
    }
  });

  app.put('/api/auth/profile', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { fullName, email, phone, jabatan, lpseLocation, customLpseName } =
        req.body || {};

      if (!fullName?.trim() || !email?.trim()) {
        return res.status(400).json({
          error: 'Nama lengkap dan email wajib diisi.',
        });
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const allUsers = await listCollection<UserRow>('users');
      const duplicate = allUsers.find(
        (u) => u.email === normalizedEmail && u.id !== req.dbUser!.id
      );
      if (duplicate) {
        return res.status(409).json({
          error: 'Alamat email tersebut sudah digunakan oleh akun lain.',
        });
      }

      let resolvedLpse = req.dbUser!.lpseLocation;
      if (lpseLocation !== undefined) {
        const trimmedLpse = String(lpseLocation || '').trim();
        if (trimmedLpse) {
          const lpseCheck = resolveLpseSelection(trimmedLpse, customLpseName);
          if (!lpseCheck.valid) {
            return res.status(400).json({ error: lpseCheck.error });
          }
          resolvedLpse = lpseCheck.value;
        } else if (req.dbUser!.role === 'peserta') {
          return res.status(400).json({ error: 'Lokasi LPSE wajib dipilih.' });
        } else {
          resolvedLpse = '';
        }
      }

      const updated = await updateById<UserRow>('users', req.dbUser!.id, {
        fullName: String(fullName).trim(),
        email: normalizedEmail,
        phone: String(phone ?? '').trim(),
        jabatan: String(jabatan ?? '').trim(),
        lpseLocation: resolvedLpse,
      });

      if (!updated) {
        return res.status(404).json({ error: 'Akun tidak ditemukan.' });
      }

      return res.json({
        user: sanitizeUser(updated),
        message: 'Data profil berhasil diperbarui.',
      });
    } catch (error) {
      console.error('Update profile error:', error);
      return res.status(500).json({ error: 'Gagal memperbarui data profil.' });
    }
  });

  app.post(
    '/api/auth/change-password',
    requireAuth,
    async (req: AuthRequest, res: Response) => {
      try {
        const { currentPassword, newPassword } = req.body || {};

        if (!newPassword || String(newPassword).length < 6) {
          return res.status(400).json({
            error: 'Password baru minimal 6 karakter.',
          });
        }

        if (req.dbUser!.passwordHash) {
          if (!currentPassword || !verifyPassword(String(currentPassword), req.dbUser!.passwordHash)) {
            return res.status(400).json({
              error: 'Password saat ini tidak sesuai.',
            });
          }
        }

        const updated = await updateById<UserRow>('users', req.dbUser!.id, {
          passwordHash: hashPassword(String(newPassword)),
        });

        if (!updated) {
          return res.status(404).json({ error: 'Akun tidak ditemukan.' });
        }

        return res.json({
          ok: true,
          user: sanitizeUser(updated),
          message: 'Password akun berhasil diperbarui.',
        });
      } catch (error) {
        console.error('Change password error:', error);
        return res.status(500).json({ error: 'Gagal memperbarui password akun.' });
      }
    }
  );

  // ------------------------------------------------------------------
  // PUBLIC REFERENCE ROUTES
  // ------------------------------------------------------------------
  app.get('/api/public/lpse', async (_req: Request, res: Response) => {
    try {
      const list = (await listCollection<LpseLocationRow>('lpse_locations'))
        .filter((l) => l.isActive)
        .sort((a, b) => a.name.localeCompare(b.name));
      res.json(list);
    } catch (error) {
      console.error('Fetch LPSE error:', error);
      res.status(500).json({ error: 'Gagal memuat daftar LPSE.' });
    }
  });

  app.get('/api/public/agendas', async (_req: Request, res: Response) => {
    try {
      const list = sortByStartDateDesc(await listCollection<AgendaRow>('agendas'));
      const now = new Date();
      res.json(
        list.map((ag) => ({
          ...ag,
          registrationOpen: isRegistrationOpen(
            ag.registrationOpenAt,
            ag.registrationCloseAt,
            now
          ),
          dayInfo: getAgendaDayInfo(ag.startDate, ag.endDate, now),
        }))
      );
    } catch (error) {
      console.error('Fetch public agendas error:', error);
      res.status(500).json({ error: 'Gagal memuat jadwal Bimtek.' });
    }
  });

  // ------------------------------------------------------------------
  // ADMIN PENGGUNA ROUTES
  // ------------------------------------------------------------------
  app.get(
    '/api/admin/rekap',
    requireAuth,
    requireRole('admin'),
    async (_req: AuthRequest, res: Response) => {
      try {
        const data = await computeRekapData();
        const logs = (await listCollection<SheetSyncLogRow>('sheet_sync_logs'))
          .sort((a, b) => b.syncedAt.getTime() - a.syncedAt.getTime())
          .slice(0, 5);
        res.json({ ...data, syncLogs: logs });
      } catch (error) {
        console.error('Rekap error:', error);
        res.status(500).json({ error: 'Gagal memuat rekap Bimtek.' });
      }
    }
  );

  app.get(
    '/api/admin/monitoring',
    requireAuth,
    requireRole('admin'),
    async (req: AuthRequest, res: Response) => {
      try {
        const requestedAgendaId = req.query.agendaId
          ? Number(req.query.agendaId)
          : null;

        const allAgendas = sortByStartDateDesc(await listCollection<AgendaRow>('agendas'));
        const now = new Date();
        const agendaSummaries = allAgendas.map((ag) => ({
          id: ag.id,
          title: ag.title,
          location: ag.location,
          startDate: ag.startDate.toISOString(),
          endDate: ag.endDate.toISOString(),
          speakers: ag.speakers,
          dayInfo: getAgendaDayInfo(ag.startDate, ag.endDate, now),
        }));

        const selectedAgenda =
          (requestedAgendaId
            ? agendaSummaries.find((a) => a.id === requestedAgendaId)
            : null) ||
          agendaSummaries.find((a) => a.dayInfo.agendaStatus === 'ongoing') ||
          agendaSummaries[0] ||
          null;

        const stageRows = sortStages(
          (await listCollection<BimtekStageRow>('bimtek_stages')).filter((s) => s.isActive)
        );

        if (!selectedAgenda) {
          return res.json({
            agendas: [],
            selectedAgenda: null,
            stages: stageRows,
            participants: [],
          });
        }

        const [allRegs, allUsers, allAtt, allTests, allEvals, allDocs] =
          await Promise.all([
            listCollection<AgendaRegistrationRow>('agenda_registrations'),
            listCollection<UserRow>('users'),
            listCollection<AttendanceRow>('attendances'),
            listCollection<TestSubmissionRow>('test_submissions'),
            listCollection<EvaluationRow>('evaluations'),
            listCollection<DocumentUploadRow>('document_uploads'),
          ]);

        const userMap = new Map(allUsers.map((u) => [u.id, u]));
        const regRows = allRegs
          .filter((r) => r.agendaId === selectedAgenda.id)
          .map((r) => {
            const u = userMap.get(r.userId);
            return {
              userId: r.userId,
              fullName: u?.fullName || '-',
              email: u?.email || '-',
              lpseLocation: u?.lpseLocation || '-',
              jabatan: u?.jabatan || '-',
              registrationStatus: r.status,
            };
          })
          .sort((a, b) => a.fullName.localeCompare(b.fullName));

        const attRows = allAtt.filter((a) => a.agendaId === selectedAgenda.id);
        const testRows = allTests.filter((t) => t.agendaId === selectedAgenda.id);
        const evalRows = allEvals.filter((e) => e.agendaId === selectedAgenda.id);
        const docRows = allDocs.filter((d) => d.agendaId === selectedAgenda.id);

        const stagesWithSpeakers = stageRows.map((st) => ({
          ...st,
          title:
            st.stageType === 'eval_speaker' && st.speakerNumber
              ? `${st.title} (${getSpeakerName(selectedAgenda.speakers, st.speakerNumber)})`
              : st.title,
        }));

        const participants = buildParticipantChecklistMatrix({
          participants: regRows,
          stages: stagesWithSpeakers,
          attendances: attRows,
          tests: testRows,
          evaluations: evalRows,
          documents: docRows,
        });

        res.json({
          agendas: agendaSummaries,
          selectedAgenda,
          stages: stagesWithSpeakers,
          participants,
        });
      } catch (error) {
        console.error('Admin monitoring error:', error);
        res.status(500).json({ error: 'Gagal memuat monitoring kelas berjalan.' });
      }
    }
  );

  app.get(
    '/api/admin/agendas',
    requireAuth,
    requireRole('admin'),
    async (_req: AuthRequest, res: Response) => {
      try {
        const list = sortByStartDateDesc(await listCollection<AgendaRow>('agendas'));
        const now = new Date();
        res.json(
          list.map((ag) => ({
            ...ag,
            registrationOpen: isRegistrationOpen(
              ag.registrationOpenAt,
              ag.registrationCloseAt,
              now
            ),
            dayInfo: getAgendaDayInfo(ag.startDate, ag.endDate, now),
          }))
        );
      } catch (error) {
        console.error('Admin agendas error:', error);
        res.status(500).json({ error: 'Gagal memuat daftar agenda.' });
      }
    }
  );

  app.post(
    '/api/admin/agendas',
    requireAuth,
    requireRole('admin'),
    async (req: AuthRequest, res: Response) => {
      try {
        const {
          title,
          registrationOpenAt,
          registrationCloseAt,
          startDate,
          endDate,
          location,
          materialTitle,
          speakers,
          description,
        } = req.body || {};

        if (
          !title?.trim() ||
          !registrationOpenAt ||
          !registrationCloseAt ||
          !startDate ||
          !endDate ||
          !location?.trim()
        ) {
          return res.status(400).json({
            error:
              'Nama kegiatan, jadwal pendaftaran, waktu mulai/selesai, dan lokasi wajib diisi.',
          });
        }

        const inserted = await insertOne<AgendaRow>('agendas', {
          title: String(title).trim(),
          registrationOpenAt: new Date(registrationOpenAt),
          registrationCloseAt: new Date(registrationCloseAt),
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          location: String(location).trim(),
          materialTitle: materialTitle?.trim() || null,
          speakers: speakers?.trim() || null,
          description: description?.trim() || '',
          createdBy: req.dbUser!.id,
          createdAt: new Date(),
        });

        res.status(201).json(inserted);
      } catch (error) {
        console.error('Create agenda error:', error);
        res.status(500).json({ error: 'Gagal menambahkan agenda Bimtek.' });
      }
    }
  );

  app.put(
    '/api/admin/agendas/:id',
    requireAuth,
    requireRole('admin'),
    async (req: AuthRequest, res: Response) => {
      try {
        const agendaId = Number(req.params.id);
        const {
          title,
          registrationOpenAt,
          registrationCloseAt,
          startDate,
          endDate,
          location,
          materialTitle,
          speakers,
          description,
        } = req.body || {};

        if (
          !title?.trim() ||
          !registrationOpenAt ||
          !registrationCloseAt ||
          !startDate ||
          !endDate ||
          !location?.trim()
        ) {
          return res.status(400).json({
            error:
              'Nama kegiatan, jadwal pendaftaran, waktu mulai/selesai, dan lokasi wajib diisi.',
          });
        }

        const updated = await updateById<AgendaRow>('agendas', agendaId, {
          title: String(title).trim(),
          registrationOpenAt: new Date(registrationOpenAt),
          registrationCloseAt: new Date(registrationCloseAt),
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          location: String(location).trim(),
          materialTitle: materialTitle?.trim() || null,
          speakers: speakers?.trim() || null,
          description: description?.trim() || '',
        });

        if (!updated) {
          return res.status(404).json({ error: 'Agenda tidak ditemukan.' });
        }
        res.json(updated);
      } catch (error) {
        console.error('Update agenda error:', error);
        res.status(500).json({ error: 'Gagal memperbarui agenda Bimtek.' });
      }
    }
  );

  app.delete(
    '/api/admin/agendas/:id',
    requireAuth,
    requireRole('admin'),
    async (req: AuthRequest, res: Response) => {
      try {
        const agendaId = Number(req.params.id);
        await removeById('agendas', agendaId);

        const [regs, atts, tests, evals, docs] = await Promise.all([
          listCollection<AgendaRegistrationRow>('agenda_registrations'),
          listCollection<AttendanceRow>('attendances'),
          listCollection<TestSubmissionRow>('test_submissions'),
          listCollection<EvaluationRow>('evaluations'),
          listCollection<DocumentUploadRow>('document_uploads'),
        ]);

        await Promise.all([
          ...regs.filter((r) => r.agendaId === agendaId).map((r) => removeById('agenda_registrations', r.id)),
          ...atts.filter((a) => a.agendaId === agendaId).map((a) => removeById('attendances', a.id)),
          ...tests.filter((t) => t.agendaId === agendaId).map((t) => removeById('test_submissions', t.id)),
          ...evals.filter((e) => e.agendaId === agendaId).map((e) => removeById('evaluations', e.id)),
          ...docs.filter((d) => d.agendaId === agendaId).map((d) => removeById('document_uploads', d.id)),
        ]);

        res.json({ ok: true });
      } catch (error) {
        console.error('Delete agenda error:', error);
        res.status(500).json({ error: 'Gagal menghapus agenda.' });
      }
    }
  );

  app.get(
    '/api/admin/users',
    requireAuth,
    requireRole('admin'),
    async (_req: AuthRequest, res: Response) => {
      try {
        const list = sortByCreatedDesc(await listCollection<UserRow>('users'));
        res.json(list.map(sanitizeUser));
      } catch (error) {
        console.error('Admin users error:', error);
        res.status(500).json({ error: 'Gagal memuat daftar user.' });
      }
    }
  );

  app.post(
    '/api/admin/users',
    requireAuth,
    requireRole('admin'),
    async (req: AuthRequest, res: Response) => {
      try {
        const {
          fullName,
          email,
          phone,
          jabatan,
          lpseLocation,
          customLpseName,
          role,
          password,
          accountStatus,
        } = req.body || {};

        if (!fullName?.trim() || !email?.trim() || !password || String(password).length < 6) {
          return res.status(400).json({
            error: 'Nama lengkap, email, dan password (minimal 6 karakter) wajib diisi.',
          });
        }

        let resolvedLpse = String(lpseLocation || '').trim();
        if (resolvedLpse) {
          const lpseCheck = resolveLpseSelection(lpseLocation, customLpseName);
          if (!lpseCheck.valid) {
            return res.status(400).json({ error: lpseCheck.error });
          }
          resolvedLpse = lpseCheck.value;
        }

        const normalizedEmail = String(email).trim().toLowerCase();
        const allUsers = await listCollection<UserRow>('users');
        if (allUsers.some((u) => u.email === normalizedEmail)) {
          return res.status(409).json({ error: 'Email sudah digunakan.' });
        }

        const validRole = ['admin', 'pic', 'peserta'].includes(role) ? role : 'peserta';
        const validStatus = ['pending', 'approved', 'rejected'].includes(accountStatus)
          ? accountStatus
          : 'approved';

        const inserted = await insertOne<UserRow>('users', {
          uid: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          email: normalizedEmail,
          passwordHash: hashPassword(String(password)),
          fullName: String(fullName).trim(),
          phone: String(phone || '').trim(),
          jabatan: String(jabatan || '').trim(),
          lpseLocation: resolvedLpse,
          role: validRole,
          accountStatus: validStatus,
          verifiedBy: validStatus === 'approved' ? req.dbUser!.id : null,
          verifiedAt: validStatus === 'approved' ? new Date() : null,
          createdAt: new Date(),
        });

        res.status(201).json(sanitizeUser(inserted));
      } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Gagal menambahkan user baru.' });
      }
    }
  );

  app.patch(
    '/api/admin/users/:id/status',
    requireAuth,
    requireRole('admin'),
    async (req: AuthRequest, res: Response) => {
      try {
        const userId = Number(req.params.id);
        const { accountStatus } = req.body || {};
        if (!['approved', 'rejected', 'pending'].includes(accountStatus)) {
          return res.status(400).json({ error: 'Status verifikasi tidak valid.' });
        }

        const updated = await updateById<UserRow>('users', userId, {
          accountStatus,
          verifiedBy: req.dbUser!.id,
          verifiedAt: new Date(),
        });

        if (!updated) {
          return res.status(404).json({ error: 'User tidak ditemukan.' });
        }
        res.json(sanitizeUser(updated));
      } catch (error) {
        console.error('Update user status error:', error);
        res.status(500).json({ error: 'Gagal memperbarui status user.' });
      }
    }
  );

  app.post(
    '/api/admin/users/:id/reset-password',
    requireAuth,
    requireRole('admin'),
    async (req: AuthRequest, res: Response) => {
      try {
        const userId = Number(req.params.id);
        const { newPassword } = req.body || {};
        if (!newPassword || String(newPassword).length < 6) {
          return res.status(400).json({
            error: 'Password baru minimal 6 karakter.',
          });
        }

        const updated = await updateById<UserRow>('users', userId, {
          passwordHash: hashPassword(String(newPassword)),
        });

        if (!updated) {
          return res.status(404).json({ error: 'User tidak ditemukan.' });
        }
        res.json({ ok: true, message: 'Password user berhasil direset.' });
      } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Gagal mereset password user.' });
      }
    }
  );

  app.put(
    '/api/admin/users/:id',
    requireAuth,
    requireRole('admin'),
    async (req: AuthRequest, res: Response) => {
      try {
        const userId = Number(req.params.id);
        const target = await getById<UserRow>('users', userId);
        if (!target) {
          return res.status(404).json({ error: 'User tidak ditemukan.' });
        }

        const {
          fullName,
          email,
          phone,
          jabatan,
          lpseLocation,
          customLpseName,
          role,
          accountStatus,
        } = req.body || {};

        if (!fullName?.trim() || !email?.trim()) {
          return res.status(400).json({
            error: 'Nama lengkap dan email wajib diisi.',
          });
        }

        const normalizedEmail = String(email).trim().toLowerCase();
        const allUsers = await listCollection<UserRow>('users');
        if (allUsers.some((u) => u.email === normalizedEmail && u.id !== userId)) {
          return res.status(409).json({
            error: 'Alamat email tersebut sudah digunakan oleh user lain.',
          });
        }

        let resolvedLpse = String(lpseLocation || '').trim();
        if (resolvedLpse) {
          const lpseCheck = resolveLpseSelection(lpseLocation, customLpseName);
          if (!lpseCheck.valid) {
            return res.status(400).json({ error: lpseCheck.error });
          }
          resolvedLpse = lpseCheck.value;
        }

        const validRole = ['admin', 'pic', 'peserta'].includes(role)
          ? role
          : target.role;
        const validStatus = ['pending', 'approved', 'rejected'].includes(accountStatus)
          ? accountStatus
          : target.accountStatus;

        if (userId === req.dbUser!.id && (validRole !== 'admin' || validStatus !== 'approved')) {
          return res.status(400).json({
            error: 'Tidak dapat menurunkan role atau menonaktifkan akun Anda sendiri.',
          });
        }

        const updated = await updateById<UserRow>('users', userId, {
          fullName: String(fullName).trim(),
          email: normalizedEmail,
          phone: String(phone || '').trim(),
          jabatan: String(jabatan || '').trim(),
          lpseLocation: resolvedLpse,
          role: validRole,
          accountStatus: validStatus,
          verifiedBy: validStatus === 'approved' ? req.dbUser!.id : target.verifiedBy,
          verifiedAt: validStatus === 'approved' && !target.verifiedAt ? new Date() : target.verifiedAt,
        });

        if (!updated) {
          return res.status(404).json({ error: 'User tidak ditemukan.' });
        }

        res.json(sanitizeUser(updated));
      } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Gagal memperbarui data user.' });
      }
    }
  );

  app.delete(
    '/api/admin/users/:id',
    requireAuth,
    requireRole('admin'),
    async (req: AuthRequest, res: Response) => {
      try {
        const userId = Number(req.params.id);
        if (userId === req.dbUser!.id) {
          return res.status(400).json({
            error: 'Tidak dapat menghapus akun yang sedang Anda gunakan.',
          });
        }

        const target = await getById<UserRow>('users', userId);
        if (!target) {
          return res.status(404).json({ error: 'User tidak ditemukan.' });
        }

        await removeById('users', userId);

        const [regs, atts, tests, evals, docs] = await Promise.all([
          listCollection<AgendaRegistrationRow>('agenda_registrations'),
          listCollection<AttendanceRow>('attendances'),
          listCollection<TestSubmissionRow>('test_submissions'),
          listCollection<EvaluationRow>('evaluations'),
          listCollection<DocumentUploadRow>('document_uploads'),
        ]);

        await Promise.all([
          ...regs.filter((r) => r.userId === userId).map((r) => removeById('agenda_registrations', r.id)),
          ...atts.filter((a) => a.userId === userId).map((a) => removeById('attendances', a.id)),
          ...tests.filter((t) => t.userId === userId).map((t) => removeById('test_submissions', t.id)),
          ...evals.filter((e) => e.userId === userId).map((e) => removeById('evaluations', e.id)),
          ...docs.filter((d) => d.userId === userId).map((d) => removeById('document_uploads', d.id)),
        ]);

        res.json({ ok: true, message: `User ${target.fullName} berhasil dihapus.` });
      } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Gagal menghapus user.' });
      }
    }
  );

  // Admin & PIC Registration Approval
  app.get(
    '/api/admin/registrations',
    requireAuth,
    requireRole('admin', 'pic'),
    async (_req: AuthRequest, res: Response) => {
      try {
        const [regs, allAgendas, allUsers] = await Promise.all([
          listCollection<AgendaRegistrationRow>('agenda_registrations'),
          listCollection<AgendaRow>('agendas'),
          listCollection<UserRow>('users'),
        ]);

        const agendaMap = new Map(allAgendas.map((a) => [a.id, a]));
        const userMap = new Map(allUsers.map((u) => [u.id, u]));

        const rows = sortByCreatedDesc(regs)
          .filter((r) => agendaMap.has(r.agendaId) && userMap.has(r.userId))
          .map((r) => {
            const ag = agendaMap.get(r.agendaId)!;
            const u = userMap.get(r.userId)!;
            return {
              id: r.id,
              agendaId: r.agendaId,
              agendaTitle: ag.title,
              agendaStartDate: ag.startDate,
              agendaEndDate: ag.endDate,
              agendaLocation: ag.location,
              userId: r.userId,
              userName: u.fullName,
              userEmail: u.email,
              userPhone: u.phone,
              userJabatan: u.jabatan,
              userLpse: u.lpseLocation,
              status: r.status,
              notes: r.notes,
              createdAt: r.createdAt,
            };
          });

        res.json(rows);
      } catch (error) {
        console.error('Fetch registrations error:', error);
        res.status(500).json({ error: 'Gagal memuat pendaftaran Bimtek.' });
      }
    }
  );

  app.patch(
    '/api/admin/registrations/:id/status',
    requireAuth,
    requireRole('admin', 'pic'),
    async (req: AuthRequest, res: Response) => {
      try {
        const regId = Number(req.params.id);
        const { status, notes } = req.body || {};
        if (!['approved', 'rejected', 'pending'].includes(status)) {
          return res.status(400).json({ error: 'Status persetujuan tidak valid.' });
        }

        const updated = await updateById<AgendaRegistrationRow>(
          'agenda_registrations',
          regId,
          {
            status,
            notes: notes !== undefined ? String(notes) : '',
            approvedBy: req.dbUser!.id,
            approvedAt: new Date(),
          }
        );

        if (!updated) {
          return res.status(404).json({ error: 'Pendaftaran tidak ditemukan.' });
        }
        res.json(updated);
      } catch (error) {
        console.error('Update registration status error:', error);
        res.status(500).json({ error: 'Gagal memperbarui persetujuan Bimtek.' });
      }
    }
  );

  // Admin Atur Data: LPSE
  app.get(
    '/api/admin/lpse',
    requireAuth,
    requireRole('admin'),
    async (_req: AuthRequest, res: Response) => {
      try {
        const list = (await listCollection<LpseLocationRow>('lpse_locations')).sort((a, b) =>
          a.name.localeCompare(b.name)
        );
        res.json(list);
      } catch (error) {
        console.error('Admin LPSE error:', error);
        res.status(500).json({ error: 'Gagal memuat data LPSE.' });
      }
    }
  );

  app.post(
    '/api/admin/lpse',
    requireAuth,
    requireRole('admin'),
    async (req: AuthRequest, res: Response) => {
      try {
        const { name, province, isActive } = req.body || {};
        if (!name?.trim()) {
          return res.status(400).json({ error: 'Nama LPSE wajib diisi.' });
        }
        const inserted = await insertOne<LpseLocationRow>('lpse_locations', {
          name: String(name).trim(),
          province: String(province || '').trim(),
          isActive: isActive !== false,
          createdAt: new Date(),
        });
        res.status(201).json(inserted);
      } catch (error) {
        console.error('Create LPSE error:', error);
        res.status(500).json({ error: 'Gagal menambahkan nama LPSE.' });
      }
    }
  );

  app.put(
    '/api/admin/lpse/:id',
    requireAuth,
    requireRole('admin'),
    async (req: AuthRequest, res: Response) => {
      try {
        const id = Number(req.params.id);
        const { name, province, isActive } = req.body || {};
        if (!name?.trim()) {
          return res.status(400).json({ error: 'Nama LPSE wajib diisi.' });
        }
        const updated = await updateById<LpseLocationRow>('lpse_locations', id, {
          name: String(name).trim(),
          province: String(province || '').trim(),
          isActive: isActive !== false,
        });
        res.json(updated);
      } catch (error) {
        console.error('Update LPSE error:', error);
        res.status(500).json({ error: 'Gagal memperbarui LPSE.' });
      }
    }
  );

  app.delete(
    '/api/admin/lpse/:id',
    requireAuth,
    requireRole('admin'),
    async (req: AuthRequest, res: Response) => {
      try {
        await removeById('lpse_locations', Number(req.params.id));
        res.json({ ok: true });
      } catch (error) {
        console.error('Delete LPSE error:', error);
        res.status(500).json({ error: 'Gagal menghapus LPSE.' });
      }
    }
  );

  // Admin Atur Data: Questions (Pretest & Posttest)
  app.get(
    '/api/admin/questions',
    requireAuth,
    requireRole('admin'),
    async (req: AuthRequest, res: Response) => {
      try {
        const testType = req.query.testType as string | undefined;
        const all = sortQuestions(await listCollection<QuestionRow>('questions'));
        const rows = testType ? all.filter((q) => q.testType === testType) : all;
        res.json(rows);
      } catch (error) {
        console.error('Admin questions error:', error);
        res.status(500).json({ error: 'Gagal memuat daftar pertanyaan.' });
      }
    }
  );

  app.post(
    '/api/admin/questions',
    requireAuth,
    requireRole('admin'),
    async (req: AuthRequest, res: Response) => {
      try {
        const {
          testType,
          questionText,
          optionsJson,
          correctIndex,
          weight,
          orderIndex,
          isActive,
        } = req.body || {};

        if (
          !['pretest', 'posttest'].includes(testType) ||
          !questionText?.trim() ||
          !Array.isArray(optionsJson) ||
          optionsJson.length < 2
        ) {
          return res.status(400).json({
            error:
              'Tipe tes, teks pertanyaan, dan minimal 2 opsi jawaban wajib diisi.',
          });
        }

        const inserted = await insertOne<QuestionRow>('questions', {
          testType,
          questionText: String(questionText).trim(),
          optionsJson: optionsJson.map((o: string) => String(o).trim()),
          correctIndex: Math.max(0, Number(correctIndex) || 0),
          weight: Math.max(1, Number(weight) || 10),
          orderIndex: Math.max(1, Number(orderIndex) || 1),
          isActive: isActive !== false,
          createdAt: new Date(),
        });

        res.status(201).json(inserted);
      } catch (error) {
        console.error('Create question error:', error);
        res.status(500).json({ error: 'Gagal menambahkan pertanyaan.' });
      }
    }
  );

  app.put(
    '/api/admin/questions/:id',
    requireAuth,
    requireRole('admin'),
    async (req: AuthRequest, res: Response) => {
      try {
        const id = Number(req.params.id);
        const {
          testType,
          questionText,
          optionsJson,
          correctIndex,
          weight,
          orderIndex,
          isActive,
        } = req.body || {};

        if (!questionText?.trim() || !Array.isArray(optionsJson) || optionsJson.length < 2) {
          return res.status(400).json({
            error: 'Pertanyaan dan minimal 2 opsi jawaban wajib diisi.',
          });
        }

        const updated = await updateById<QuestionRow>('questions', id, {
          testType: ['pretest', 'posttest'].includes(testType) ? testType : 'pretest',
          questionText: String(questionText).trim(),
          optionsJson: optionsJson.map((o: string) => String(o).trim()),
          correctIndex: Math.max(0, Number(correctIndex) || 0),
          weight: Math.max(1, Number(weight) || 10),
          orderIndex: Math.max(1, Number(orderIndex) || 1),
          isActive: isActive !== false,
        });

        res.json(updated);
      } catch (error) {
        console.error('Update question error:', error);
        res.status(500).json({ error: 'Gagal memperbarui pertanyaan.' });
      }
    }
  );

  app.delete(
    '/api/admin/questions/:id',
    requireAuth,
    requireRole('admin'),
    async (req: AuthRequest, res: Response) => {
      try {
        await removeById('questions', Number(req.params.id));
        res.json({ ok: true });
      } catch (error) {
        console.error('Delete question error:', error);
        res.status(500).json({ error: 'Gagal menghapus pertanyaan.' });
      }
    }
  );

  // Admin Atur Data: Tahapan Peserta
  app.get(
    '/api/admin/stages',
    requireAuth,
    requireRole('admin'),
    async (_req: AuthRequest, res: Response) => {
      try {
        const rows = sortStages(await listCollection<BimtekStageRow>('bimtek_stages'));
        res.json(rows);
      } catch (error) {
        console.error('Admin stages error:', error);
        res.status(500).json({ error: 'Gagal memuat tahapan peserta.' });
      }
    }
  );

  app.post(
    '/api/admin/stages',
    requireAuth,
    requireRole('admin'),
    async (req: AuthRequest, res: Response) => {
      try {
        const {
          stageKey,
          title,
          stageType,
          dayNumber,
          speakerNumber,
          orderIndex,
          isRequired,
          isActive,
          description,
        } = req.body || {};

        if (!stageKey?.trim() || !title?.trim()) {
          return res.status(400).json({ error: 'Kode tahapan dan judul wajib diisi.' });
        }

        const inserted = await insertOne<BimtekStageRow>('bimtek_stages', {
          stageKey: String(stageKey).trim(),
          title: String(title).trim(),
          stageType: stageType || 'upload',
          dayNumber: Math.max(1, Number(dayNumber) || 1),
          speakerNumber: speakerNumber ? Number(speakerNumber) : null,
          orderIndex: Math.max(1, Number(orderIndex) || 1),
          isRequired: isRequired !== false,
          isActive: isActive !== false,
          description: String(description || '').trim(),
        });
        res.status(201).json(inserted);
      } catch (error) {
        console.error('Create stage error:', error);
        res.status(500).json({ error: 'Gagal menambahkan tahapan.' });
      }
    }
  );

  app.put(
    '/api/admin/stages/:id',
    requireAuth,
    requireRole('admin'),
    async (req: AuthRequest, res: Response) => {
      try {
        const id = Number(req.params.id);
        const {
          title,
          stageType,
          dayNumber,
          speakerNumber,
          orderIndex,
          isRequired,
          isActive,
          description,
        } = req.body || {};

        if (!title?.trim()) {
          return res.status(400).json({ error: 'Judul tahapan wajib diisi.' });
        }

        const updated = await updateById<BimtekStageRow>('bimtek_stages', id, {
          title: String(title).trim(),
          stageType: stageType || 'attendance',
          dayNumber: Math.max(1, Number(dayNumber) || 1),
          speakerNumber: speakerNumber ? Number(speakerNumber) : null,
          orderIndex: Math.max(1, Number(orderIndex) || 1),
          isRequired: isRequired !== false,
          isActive: isActive !== false,
          description: String(description || '').trim(),
        });
        res.json(updated);
      } catch (error) {
        console.error('Update stage error:', error);
        res.status(500).json({ error: 'Gagal memperbarui tahapan.' });
      }
    }
  );

  app.delete(
    '/api/admin/stages/:id',
    requireAuth,
    requireRole('admin'),
    async (req: AuthRequest, res: Response) => {
      try {
        await removeById('bimtek_stages', Number(req.params.id));
        res.json({ ok: true });
      } catch (error) {
        console.error('Delete stage error:', error);
        res.status(500).json({ error: 'Gagal menghapus tahapan.' });
      }
    }
  );

  // Admin Google Sheets Sync
  app.post(
    '/api/admin/sheets-sync',
    requireAuth,
    requireRole('admin'),
    async (req: AuthRequest, res: Response) => {
      try {
        const googleToken = req.headers['x-google-access-token'] as string | undefined;
        if (!googleToken) {
          return res.status(401).json({
            error:
              'Token Google Workspace belum aktif. Silakan klik Hubungkan Akun Google terlebih dahulu.',
            requiresGoogleAuth: true,
          });
        }

        const { spreadsheetId: existingId, title } = req.body || {};
        const { agendaRekap, participantDetails } = await computeRekapData();

        const rekapRows = [
          [
            'Nama Kegiatan Bimtek',
            'Lokasi',
            'Mulai',
            'Selesai',
            'Total Pendaftar',
            'Diterima',
            'Menunggu',
            'Absen Hari 1',
            'Absen Hari 2',
            'Absen Hari 3',
            'Pretest Selesai',
            'Rata-rata Pretest',
            'Posttest Selesai',
            'Rata-rata Posttest',
            'Jumlah Penilaian',
            'Dokumen Terunggah',
          ],
          ...agendaRekap.map((r) => [
            r.title,
            r.location,
            toJakartaDateKey(r.startDate),
            toJakartaDateKey(r.endDate),
            r.totalRegistrants,
            r.approvedParticipants,
            r.pendingRegistrants,
            r.day1Attendance,
            r.day2Attendance,
            r.day3Attendance,
            r.pretestCompleted,
            r.avgPretest ?? '-',
            r.posttestCompleted,
            r.avgPosttest ?? '-',
            r.evaluationsCount,
            r.uploadsCount,
          ]),
        ];

        const detailRows = [
          [
            'Agenda Bimtek',
            'Nama Peserta',
            'Email',
            'Lokasi LPSE',
            'Jabatan',
            'Status Kepesertaan',
            'Absen Day 1',
            'Absen Day 2',
            'Absen Day 3',
            'Skor Pretest',
            'Skor Posttest',
            'Lembar Komitmen',
            'Tugas Akhir',
          ],
          ...participantDetails.map((d) => [
            d.agendaTitle,
            d.fullName,
            d.email,
            d.lpseLocation,
            d.jabatan,
            d.registrationStatus,
            d.absenDay1,
            d.absenDay2,
            d.absenDay3,
            d.pretestScore,
            d.posttestScore,
            d.komitmenStatus,
            d.tugasStatus,
          ]),
        ];

        let targetSpreadsheetId = extractSpreadsheetId(existingId);
        let spreadsheetUrl = '';
        let spreadsheetTitle =
          title?.trim() ||
          `Rekap Portal Bimtek LPSE (${toJakartaDateKey(new Date())})`;
        let rekapTabName = 'Rekap Agenda';
        let detailTabName = 'Detail Peserta';

        if (!targetSpreadsheetId) {
          const createRes = await fetch(
            'https://sheets.googleapis.com/v4/spreadsheets',
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${googleToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                properties: { title: spreadsheetTitle },
                sheets: [
                  { properties: { title: rekapTabName } },
                  { properties: { title: detailTabName } },
                ],
              }),
            }
          );

          if (!createRes.ok) {
            const errBody = await createRes.text();
            console.error('Google Sheets create error:', errBody);
            return res.status(502).json({
              error:
                'Gagal membuat Google Spreadsheet. Pastikan izin Google Sheets sudah diberikan.',
            });
          }

          const created = (await createRes.json()) as {
            spreadsheetId: string;
            spreadsheetUrl: string;
            properties?: { title?: string };
          };
          targetSpreadsheetId = created.spreadsheetId;
          spreadsheetUrl = created.spreadsheetUrl;
          spreadsheetTitle = created.properties?.title || spreadsheetTitle;
        } else {
          const metaRes = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(targetSpreadsheetId)}?fields=spreadsheetUrl,properties.title,sheets.properties.title`,
            {
              headers: { Authorization: `Bearer ${googleToken}` },
            }
          );
          if (!metaRes.ok) {
            return res.status(400).json({
              error:
                'Spreadsheet tujuan tidak dapat diakses. Periksa URL/ID Spreadsheet atau buat spreadsheet baru.',
            });
          }
          const meta = (await metaRes.json()) as {
            spreadsheetUrl: string;
            properties?: { title?: string };
            sheets?: Array<{ properties?: { title?: string } }>;
          };
          spreadsheetUrl = meta.spreadsheetUrl;
          spreadsheetTitle = meta.properties?.title || spreadsheetTitle;
          const existingTabs =
            meta.sheets?.map((s) => s.properties?.title).filter(Boolean) || [];
          if (existingTabs.length >= 1) rekapTabName = existingTabs[0]!;
          if (existingTabs.length >= 2) detailTabName = existingTabs[1]!;
          else detailTabName = existingTabs[0] || rekapTabName;
        }

        const batchPayload = {
          valueInputOption: 'USER_ENTERED',
          data: [
            {
              range: `'${rekapTabName}'!A1`,
              values: rekapRows,
            },
            ...(detailTabName !== rekapTabName
              ? [
                  {
                    range: `'${detailTabName}'!A1`,
                    values: detailRows,
                  },
                ]
              : []),
          ],
        };

        const updateRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(targetSpreadsheetId)}/values:batchUpdate`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${googleToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(batchPayload),
          }
        );

        if (!updateRes.ok) {
          const errText = await updateRes.text();
          console.error('Google Sheets batchUpdate error:', errText);
          return res.status(502).json({
            error: 'Gagal menulis data ke Google Sheets.',
          });
        }

        const logRow = await insertOne<SheetSyncLogRow>('sheet_sync_logs', {
          spreadsheetId: targetSpreadsheetId,
          spreadsheetUrl,
          spreadsheetTitle,
          syncedBy: req.dbUser!.id,
          syncedAt: new Date(),
        });

        res.json({
          ok: true,
          syncLog: logRow,
          rekapRowCount: rekapRows.length - 1,
          detailRowCount: detailRows.length - 1,
        });
      } catch (error) {
        console.error('Sheets sync error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan saat sinkronisasi Sheets.' });
      }
    }
  );

  // Admin Export All Data
  app.get(
    '/api/admin/export',
    requireAuth,
    requireRole('admin'),
    async (req: AuthRequest, res: Response) => {
      try {
        const filterAgendaId = req.query.agendaId
          ? Number(req.query.agendaId)
          : null;

        const [
          allAgendasRaw,
          allUsersRaw,
          allRegsRaw,
          allAttRaw,
          allTestsRaw,
          allEvalsRaw,
          allDocsRaw,
          allLpseRaw,
          allQuestionsRaw,
          allStagesRaw,
          allSyncLogsRaw,
        ] = await Promise.all([
          listCollection<AgendaRow>('agendas'),
          listCollection<UserRow>('users'),
          listCollection<AgendaRegistrationRow>('agenda_registrations'),
          listCollection<AttendanceRow>('attendances'),
          listCollection<TestSubmissionRow>('test_submissions'),
          listCollection<EvaluationRow>('evaluations'),
          listCollection<DocumentUploadRow>('document_uploads'),
          listCollection<LpseLocationRow>('lpse_locations'),
          listCollection<QuestionRow>('questions'),
          listCollection<BimtekStageRow>('bimtek_stages'),
          listCollection<SheetSyncLogRow>('sheet_sync_logs'),
        ]);

        const allAgendas = sortByStartDateDesc(allAgendasRaw);
        const allUsers = sortByCreatedDesc(allUsersRaw);
        const userMap = new Map(allUsers.map((u) => [u.id, u]));
        const agendaMap = new Map(allAgendas.map((a) => [a.id, a]));

        const matchAgenda = (agendaId: number) =>
          !filterAgendaId || agendaId === filterAgendaId;

        const filteredAgendas = filterAgendaId
          ? allAgendas.filter((a) => a.id === filterAgendaId)
          : allAgendas;
        const filteredRegs = sortByCreatedDesc(
          allRegsRaw.filter((r) => matchAgenda(r.agendaId))
        );
        const filteredAtt = allAttRaw
          .filter((a) => matchAgenda(a.agendaId))
          .sort((a, b) => b.checkedInAt.getTime() - a.checkedInAt.getTime());
        const filteredTests = allTestsRaw
          .filter((t) => matchAgenda(t.agendaId))
          .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
        const filteredEvals = allEvalsRaw
          .filter((e) => matchAgenda(e.agendaId))
          .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
        const filteredDocs = allDocsRaw
          .filter((d) => matchAgenda(d.agendaId))
          .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());

        const filteredParticipantIds = new Set(filteredRegs.map((r) => r.userId));
        const filteredUsers = filterAgendaId
          ? allUsers.filter((u) => filteredParticipantIds.has(u.id))
          : allUsers;

        const lpseSorted = [...allLpseRaw].sort((a, b) =>
          a.name.localeCompare(b.name)
        );
        const stagesSorted = sortStages(allStagesRaw);
        const questionsSorted = sortQuestions(allQuestionsRaw);

        const datasets = [
          {
            key: 'agendas',
            fileName: '01-agenda-bimtek.csv',
            title: 'Agenda Kegiatan Bimtek',
            description:
              'Daftar jadwal kegiatan Bimtek, periode pendaftaran, lokasi, materi, pemateri, dan total peserta.',
            category: 'Agenda & Kelas',
            headers: [
              'ID Agenda',
              'Nama Kegiatan',
              'Lokasi',
              'Pembukaan Pendaftaran',
              'Penutupan Pendaftaran',
              'Tanggal Mulai',
              'Tanggal Selesai',
              'Nama Materi',
              'Narasumber / Pemateri',
              'Total Pendaftar',
              'Peserta Diterima',
            ],
            rows: filteredAgendas.map((ag) => {
              const regs = allRegsRaw.filter((r) => r.agendaId === ag.id);
              const approved = regs.filter((r) => r.status === 'approved');
              return [
                ag.id,
                ag.title,
                ag.location,
                ag.registrationOpenAt.toISOString(),
                ag.registrationCloseAt.toISOString(),
                toJakartaDateKey(ag.startDate),
                toJakartaDateKey(ag.endDate),
                ag.materialTitle || '-',
                ag.speakers || '-',
                regs.length,
                approved.length,
              ];
            }),
          },
          {
            key: 'users',
            fileName: '02-daftar-user-dan-peserta.csv',
            title: 'Daftar User & Profil Peserta',
            description:
              'Seluruh akun terdaftar beserta nama lengkap, email, nomor HP, jabatan, lokasi LPSE, peran, dan status verifikasi.',
            category: 'Peserta & User',
            headers: [
              'ID User',
              'Nama Lengkap',
              'Email',
              'No. HP',
              'Jabatan',
              'Lokasi LPSE',
              'Peran',
              'Status Akun',
              'Tanggal Registrasi',
            ],
            rows: filteredUsers.map((u) => [
              u.id,
              u.fullName,
              u.email,
              u.phone || '-',
              u.jabatan || '-',
              u.lpseLocation || '-',
              u.role,
              u.accountStatus,
              u.createdAt.toISOString(),
            ]),
          },
          {
            key: 'registrations',
            fileName: '03-pendaftaran-kelas-bimtek.csv',
            title: 'Pendaftaran Kelas & Rekap Progres Peserta',
            description:
              'Daftar kepesertaan per agenda lengkap dengan status persetujuan PIC, rekap absensi H1-H3, skor tes, dan status berkas.',
            category: 'Peserta & User',
            headers: [
              'ID Pendaftaran',
              'Agenda Bimtek',
              'Nama Peserta',
              'Email',
              'No. HP',
              'Jabatan',
              'Lokasi LPSE',
              'Status Kepesertaan',
              'Absen Hari 1',
              'Absen Hari 2',
              'Absen Hari 3',
              'Skor Pre-Test',
              'Skor Post-Test',
              'Lembar Komitmen',
              'Tugas Akhir',
              'Waktu Mendaftar',
            ],
            rows: filteredRegs.map((reg) => {
              const u = userMap.get(reg.userId);
              const ag = agendaMap.get(reg.agendaId);
              const uAtt = filteredAtt.filter(
                (a) => a.agendaId === reg.agendaId && a.userId === reg.userId
              );
              const uTests = filteredTests.filter(
                (t) => t.agendaId === reg.agendaId && t.userId === reg.userId
              );
              const uDocs = filteredDocs.filter(
                (d) => d.agendaId === reg.agendaId && d.userId === reg.userId
              );
              const pre = uTests.find((t) => t.testType === 'pretest');
              const post = uTests.find((t) => t.testType === 'posttest');
              const kom = uDocs.find((d) => d.docType === 'komitmen');
              const tgs = uDocs.find((d) => d.docType === 'tugas');
              return [
                reg.id,
                ag?.title || '-',
                u?.fullName || '-',
                u?.email || '-',
                u?.phone || '-',
                u?.jabatan || '-',
                u?.lpseLocation || '-',
                reg.status,
                uAtt.some((a) => a.dayNumber === 1) ? 'Hadir' : 'Belum',
                uAtt.some((a) => a.dayNumber === 2) ? 'Hadir' : 'Belum',
                uAtt.some((a) => a.dayNumber === 3) ? 'Hadir' : 'Belum',
                pre ? `${pre.score}/${pre.maxScore}` : '-',
                post ? `${post.score}/${post.maxScore}` : '-',
                kom ? kom.driveWebViewLink || kom.fileName : 'Belum Unggah',
                tgs ? tgs.driveWebViewLink || tgs.fileName : 'Belum Unggah',
                reg.createdAt.toISOString(),
              ];
            }),
          },
          {
            key: 'attendances',
            fileName: '04-absensi-harian.csv',
            title: 'Log Absensi Harian Peserta',
            description:
              'Rekaman absensi harian peserta per agenda beserta tanggal sistem dan waktu check-in.',
            category: 'Aktivitas & Evaluasi',
            headers: [
              'ID Absensi',
              'Agenda Bimtek',
              'Nama Peserta',
              'Email',
              'Lokasi LPSE',
              'Hari Ke',
              'Tanggal Absen',
              'Waktu Check-In',
              'Catatan',
            ],
            rows: filteredAtt.map((a) => {
              const u = userMap.get(a.userId);
              const ag = agendaMap.get(a.agendaId);
              return [
                a.id,
                ag?.title || '-',
                u?.fullName || '-',
                u?.email || '-',
                u?.lpseLocation || '-',
                a.dayNumber,
                a.attendanceDate,
                a.checkedInAt.toISOString(),
                a.notes || '',
              ];
            }),
          },
          {
            key: 'tests',
            fileName: '05-hasil-pretest-posttest.csv',
            title: 'Hasil Pre-Test & Post-Test',
            description:
              'Skor, nilai maksimal, dan persentase pengerjaan Pre-Test serta Post-Test seluruh peserta.',
            category: 'Aktivitas & Evaluasi',
            headers: [
              'ID Tes',
              'Agenda Bimtek',
              'Nama Peserta',
              'Email',
              'Lokasi LPSE',
              'Jenis Tes',
              'Skor Diperoleh',
              'Skor Maksimal',
              'Persentase (%)',
              'Waktu Submit',
            ],
            rows: filteredTests.map((t) => {
              const u = userMap.get(t.userId);
              const ag = agendaMap.get(t.agendaId);
              const pct =
                t.maxScore > 0 ? Math.round((t.score / t.maxScore) * 100) : 0;
              return [
                t.id,
                ag?.title || '-',
                u?.fullName || '-',
                u?.email || '-',
                u?.lpseLocation || '-',
                t.testType === 'pretest' ? 'Pre-Test' : 'Post-Test',
                t.score,
                t.maxScore,
                pct,
                t.submittedAt.toISOString(),
              ];
            }),
          },
          {
            key: 'evaluations',
            fileName: '06-penilaian-narasumber-panitia.csv',
            title: 'Penilaian Narasumber & Panitia',
            description:
              'Rekap rating penguasaan materi, penyampaian, kualitas materi, dan komentar peserta.',
            category: 'Aktivitas & Evaluasi',
            headers: [
              'ID Penilaian',
              'Agenda Bimtek',
              'Nama Peserta',
              'Target',
              'Narasumber Ke',
              'Nama Narasumber / Panitia',
              'Penguasaan Materi (1-5)',
              'Penyampaian (1-5)',
              'Kualitas Materi (1-5)',
              'Rata-rata',
              'Komentar',
              'Waktu Submit',
            ],
            rows: filteredEvals.map((ev) => {
              const u = userMap.get(ev.userId);
              const ag = agendaMap.get(ev.agendaId);
              const avg = (
                (ev.ratingMastery + ev.ratingDelivery + ev.ratingMaterial) /
                3
              ).toFixed(2);
              return [
                ev.id,
                ag?.title || '-',
                u?.fullName || '-',
                ev.targetType === 'committee' ? 'Panitia Pelaksana' : 'Narasumber',
                ev.speakerNumber ?? '-',
                ev.speakerName,
                ev.ratingMastery,
                ev.ratingDelivery,
                ev.ratingMaterial,
                avg,
                ev.comments || '',
                ev.submittedAt.toISOString(),
              ];
            }),
          },
          {
            key: 'documents',
            fileName: '07-dokumen-komitmen-tugas.csv',
            title: 'Dokumen Komitmen & Tugas (Google Drive)',
            description:
              'Daftar berkas Lembar Komitmen dan Tugas Akhir yang diunggah peserta beserta tautan Google Drive.',
            category: 'Aktivitas & Evaluasi',
            headers: [
              'ID Dokumen',
              'Agenda Bimtek',
              'Nama Peserta',
              'Email',
              'Jenis Dokumen',
              'Nama File',
              'Ukuran (Bytes)',
              'Mode Penyimpanan',
              'Link Google Drive',
              'Waktu Unggah',
            ],
            rows: filteredDocs.map((d) => {
              const u = userMap.get(d.userId);
              const ag = agendaMap.get(d.agendaId);
              return [
                d.id,
                ag?.title || '-',
                u?.fullName || '-',
                u?.email || '-',
                d.docType === 'komitmen' ? 'Lembar Komitmen' : 'Tugas Akhir',
                d.fileName,
                d.fileSize,
                d.storageMode,
                d.driveWebViewLink || '-',
                d.uploadedAt.toISOString(),
              ];
            }),
          },
          {
            key: 'master_lpse_stages',
            fileName: '08-master-lpse-dan-tahapan.csv',
            title: 'Master Lokasi LPSE & Tahapan Kelas',
            description:
              'Data referensi lokasi LPSE terdaftar serta konfigurasi urutan tahapan kelas peserta.',
            category: 'Master Data',
            headers: [
              'Jenis Referensi',
              'Kode / Provinsi',
              'Nama LPSE / Tahapan',
              'Hari / Status',
              'Keterangan',
            ],
            rows: [
              ...lpseSorted.map((l) => [
                'Lokasi LPSE',
                l.province || '-',
                l.name,
                l.isActive ? 'Aktif' : 'Nonaktif',
                `ID #${l.id}`,
              ]),
              ...stagesSorted.map((s) => [
                'Tahapan Peserta',
                s.stageKey,
                s.title,
                `Hari ${s.dayNumber} · ${s.isActive ? 'Aktif' : 'Nonaktif'}`,
                s.description || s.stageType,
              ]),
            ],
          },
          {
            key: 'questions',
            fileName: '09-bank-soal-tes.csv',
            title: 'Bank Soal Pre-Test & Post-Test',
            description:
              'Daftar pertanyaan, opsi jawaban, indeks kunci jawaban, dan bobot nilai soal.',
            category: 'Master Data',
            headers: [
              'ID Soal',
              'Jenis Tes',
              'Urutan',
              'Pertanyaan',
              'Opsi Jawaban',
              'Kunci Jawaban (Index 0)',
              'Bobot Nilai',
              'Status Aktif',
            ],
            rows: questionsSorted.map((q) => [
              q.id,
              q.testType === 'pretest' ? 'Pre-Test' : 'Post-Test',
              q.orderIndex,
              q.questionText,
              q.optionsJson.join(' | '),
              q.correctIndex,
              q.weight,
              q.isActive ? 'Aktif' : 'Nonaktif',
            ]),
          },
        ];

        res.json({
          exportedAt: new Date().toISOString(),
          filterAgendaId,
          agendas: allAgendas.map((a) => ({
            id: a.id,
            title: a.title,
            startDate: a.startDate.toISOString(),
            endDate: a.endDate.toISOString(),
          })),
          summary: {
            totalAgendas: filteredAgendas.length,
            totalUsers: filteredUsers.length,
            totalPeserta: filteredUsers.filter((u) => u.role === 'peserta').length,
            totalRegistrations: filteredRegs.length,
            totalAttendances: filteredAtt.length,
            totalTestSubmissions: filteredTests.length,
            totalEvaluations: filteredEvals.length,
            totalDocuments: filteredDocs.length,
          },
          datasets,
          rawBackup: {
            agendas: filteredAgendas,
            users: filteredUsers.map(sanitizeUser),
            agenda_registrations: filteredRegs,
            attendances: filteredAtt,
            test_submissions: filteredTests,
            evaluations: filteredEvals,
            document_uploads: filteredDocs,
            lpse_locations: lpseSorted,
            questions: questionsSorted,
            bimtek_stages: stagesSorted,
            sheet_sync_logs: allSyncLogsRaw,
          },
        });
      } catch (error) {
        console.error('Admin export error:', error);
        res.status(500).json({ error: 'Gagal menyiapkan data untuk diunduh.' });
      }
    }
  );

  // ------------------------------------------------------------------
  // PIC ROUTES (Verify Users & Approve Bimtek Registrations)
  // ------------------------------------------------------------------
  app.get(
    '/api/pic/users',
    requireAuth,
    requireRole('pic', 'admin'),
    async (_req: AuthRequest, res: Response) => {
      try {
        const list = sortByCreatedDesc(
          (await listCollection<UserRow>('users')).filter((u) => u.role === 'peserta')
        );
        res.json(list.map(sanitizeUser));
      } catch (error) {
        console.error('PIC users error:', error);
        res.status(500).json({ error: 'Gagal memuat daftar pendaftar peserta.' });
      }
    }
  );

  app.patch(
    '/api/pic/users/:id/status',
    requireAuth,
    requireRole('pic', 'admin'),
    async (req: AuthRequest, res: Response) => {
      try {
        const userId = Number(req.params.id);
        const { accountStatus } = req.body || {};
        if (!['approved', 'rejected', 'pending'].includes(accountStatus)) {
          return res.status(400).json({ error: 'Status verifikasi tidak valid.' });
        }

        const updated = await updateById<UserRow>('users', userId, {
          accountStatus,
          verifiedBy: req.dbUser!.id,
          verifiedAt: new Date(),
        });

        if (!updated) {
          return res.status(404).json({ error: 'Peserta tidak ditemukan.' });
        }
        res.json(sanitizeUser(updated));
      } catch (error) {
        console.error('PIC verify user error:', error);
        res.status(500).json({ error: 'Gagal memverifikasi akun peserta.' });
      }
    }
  );

  // ------------------------------------------------------------------
  // PESERTA ROUTES
  // ------------------------------------------------------------------
  app.get(
    '/api/peserta/agendas',
    requireAuth,
    async (req: AuthRequest, res: Response) => {
      try {
        const [allAgendasRaw, allRegs] = await Promise.all([
          listCollection<AgendaRow>('agendas'),
          listCollection<AgendaRegistrationRow>('agenda_registrations'),
        ]);

        const allAgendas = sortByStartDateDesc(allAgendasRaw);
        const myRegs = allRegs.filter((r) => r.userId === req.dbUser!.id);

        const now = new Date();
        const regByAgenda = new Map(myRegs.map((r) => [r.agendaId, r]));

        res.json(
          allAgendas.map((ag) => {
            const reg = regByAgenda.get(ag.id);
            return {
              ...ag,
              registrationOpen: isRegistrationOpen(
                ag.registrationOpenAt,
                ag.registrationCloseAt,
                now
              ),
              dayInfo: getAgendaDayInfo(ag.startDate, ag.endDate, now),
              myRegistration: reg
                ? {
                    id: reg.id,
                    status: reg.status,
                    createdAt: reg.createdAt,
                  }
                : null,
            };
          })
        );
      } catch (error) {
        console.error('Peserta agendas error:', error);
        res.status(500).json({ error: 'Gagal memuat daftar agenda Bimtek.' });
      }
    }
  );

  app.post(
    '/api/peserta/agendas/:id/register',
    requireAuth,
    async (req: AuthRequest, res: Response) => {
      try {
        if (req.dbUser!.accountStatus !== 'approved') {
          return res.status(403).json({
            error: 'Akun Anda belum diverifikasi oleh PIC.',
          });
        }

        const agendaId = Number(req.params.id);
        const agenda = await getById<AgendaRow>('agendas', agendaId);
        if (!agenda) {
          return res.status(404).json({ error: 'Agenda tidak ditemukan.' });
        }

        if (
          !isRegistrationOpen(
            agenda.registrationOpenAt,
            agenda.registrationCloseAt,
            new Date()
          )
        ) {
          return res.status(400).json({
            error: 'Waktu pendaftaran untuk agenda ini sudah ditutup atau belum dibuka.',
          });
        }

        const allRegs = await listCollection<AgendaRegistrationRow>('agenda_registrations');
        const existing = allRegs.find(
          (r) => r.agendaId === agendaId && r.userId === req.dbUser!.id
        );

        if (existing) {
          return res.status(409).json({
            error: 'Anda sudah mendaftar pada agenda Bimtek ini.',
          });
        }

        const inserted = await insertOne<AgendaRegistrationRow>('agenda_registrations', {
          agendaId,
          userId: req.dbUser!.id,
          status: 'pending',
          approvedBy: null,
          approvedAt: null,
          notes: '',
          createdAt: new Date(),
        });

        res.status(201).json(inserted);
      } catch (error) {
        console.error('Register agenda error:', error);
        res.status(500).json({ error: 'Gagal mendaftar ke agenda Bimtek.' });
      }
    }
  );

  type RoomContextResult =
    | { ok: false; errorStatus: number; error: string }
    | {
        ok: true;
        agenda: AgendaRow;
        reg: AgendaRegistrationRow;
        dayInfo: ReturnType<typeof getAgendaDayInfo>;
      };

  async function loadApprovedRoomContext(
    agendaId: number,
    userId: number
  ): Promise<RoomContextResult> {
    const [agenda, allRegs] = await Promise.all([
      getById<AgendaRow>('agendas', agendaId),
      listCollection<AgendaRegistrationRow>('agenda_registrations'),
    ]);

    const reg = allRegs.find((r) => r.agendaId === agendaId && r.userId === userId);
    if (!agenda) {
      return { ok: false, errorStatus: 404, error: 'Agenda tidak ditemukan.' };
    }
    if (!reg || reg.status !== 'approved') {
      return {
        ok: false,
        errorStatus: 403,
        error: 'Anda belum disetujui PIC untuk memasuki ruang Bimtek ini.',
      };
    }

    const dayInfo = getAgendaDayInfo(agenda.startDate, agenda.endDate, new Date());
    return { ok: true, agenda, reg, dayInfo };
  }

  app.get(
    '/api/peserta/room/:agendaId',
    requireAuth,
    async (req: AuthRequest, res: Response) => {
      try {
        const agendaId = Number(req.params.agendaId);
        const ctx = await loadApprovedRoomContext(agendaId, req.dbUser!.id);
        if (ctx.ok === false) {
          return res.status(ctx.errorStatus).json({ error: ctx.error });
        }

        const [allStages, allAtt, allTests, allEvals, allDocs, allQuestions] =
          await Promise.all([
            listCollection<BimtekStageRow>('bimtek_stages'),
            listCollection<AttendanceRow>('attendances'),
            listCollection<TestSubmissionRow>('test_submissions'),
            listCollection<EvaluationRow>('evaluations'),
            listCollection<DocumentUploadRow>('document_uploads'),
            listCollection<QuestionRow>('questions'),
          ]);

        const stageRows = sortStages(allStages);
        const attRows = allAtt.filter(
          (a) => a.agendaId === agendaId && a.userId === req.dbUser!.id
        );
        const testRows = allTests.filter(
          (t) => t.agendaId === agendaId && t.userId === req.dbUser!.id
        );
        const evalRows = allEvals.filter(
          (e) => e.agendaId === agendaId && e.userId === req.dbUser!.id
        );
        const docRows = allDocs.filter(
          (d) => d.agendaId === agendaId && d.userId === req.dbUser!.id
        );
        const qRows = sortQuestions(allQuestions.filter((q) => q.isActive));

        const completedKeys = new Set<string>();
        for (const a of attRows) {
          completedKeys.add(`absen_day_${a.dayNumber}`);
        }
        for (const t of testRows) {
          completedKeys.add(t.testType);
        }
        for (const e of evalRows) {
          if (e.targetType === 'committee') {
            completedKeys.add('eval_panitia');
          } else if (e.speakerNumber) {
            completedKeys.add(`eval_narasumber_${e.speakerNumber}`);
          }
        }
        for (const d of docRows) {
          completedKeys.add(d.docType === 'komitmen' ? 'upload_komitmen' : 'upload_tugas');
        }

        const stagesWithAvailability = stageRows.map((st) => ({
          ...st,
          title:
            st.stageType === 'eval_speaker' && st.speakerNumber
              ? `${st.title} (${getSpeakerName(ctx.agenda.speakers, st.speakerNumber)})`
              : st.title,
          availability: computeStageAvailability(st, ctx.dayInfo, completedKeys),
        }));

        const sanitizeQuestion = (q: QuestionRow) => ({
          id: q.id,
          testType: q.testType,
          questionText: q.questionText,
          optionsJson: q.optionsJson,
          weight: q.weight,
          orderIndex: q.orderIndex,
          isActive: q.isActive,
        });

        res.json({
          agenda: ctx.agenda,
          dayInfo: ctx.dayInfo,
          stages: stagesWithAvailability,
          attendances: attRows,
          testSubmissions: testRows,
          evaluations: evalRows,
          documentUploads: docRows,
          pretestQuestions: qRows
            .filter((q) => q.testType === 'pretest')
            .map(sanitizeQuestion),
          posttestQuestions: qRows
            .filter((q) => q.testType === 'posttest')
            .map(sanitizeQuestion),
        });
      } catch (error) {
        console.error('Load room error:', error);
        res.status(500).json({ error: 'Gagal memuat ruang Bimtek.' });
      }
    }
  );

  app.post(
    '/api/peserta/room/:agendaId/attendance',
    requireAuth,
    async (req: AuthRequest, res: Response) => {
      try {
        const agendaId = Number(req.params.agendaId);
        const dayNumber = Number(req.body?.dayNumber);
        const ctx = await loadApprovedRoomContext(agendaId, req.dbUser!.id);
        if (ctx.ok === false) {
          return res.status(ctx.errorStatus).json({ error: ctx.error });
        }

        if (ctx.dayInfo.currentDayNumber !== dayNumber) {
          return res.status(400).json({
            error: `Absensi Hari ke-${dayNumber} hanya aktif pada tanggal sistem ${ctx.dayInfo.dayDates[dayNumber] || '-'}.`,
          });
        }

        const allAtt = await listCollection<AttendanceRow>('attendances');
        const existing = allAtt.find(
          (a) =>
            a.agendaId === agendaId &&
            a.userId === req.dbUser!.id &&
            a.dayNumber === dayNumber
        );

        if (existing) {
          return res.status(409).json({ error: 'Anda sudah melakukan absensi untuk hari ini.' });
        }

        const inserted = await insertOne<AttendanceRow>('attendances', {
          agendaId,
          userId: req.dbUser!.id,
          dayNumber,
          attendanceDate: ctx.dayInfo.todayKey,
          checkedInAt: new Date(),
          notes: String(req.body?.notes || '').trim(),
        });

        res.status(201).json(inserted);
      } catch (error) {
        console.error('Attendance error:', error);
        res.status(500).json({ error: 'Gagal menyimpan absensi.' });
      }
    }
  );

  app.post(
    '/api/peserta/room/:agendaId/test',
    requireAuth,
    async (req: AuthRequest, res: Response) => {
      try {
        const agendaId = Number(req.params.agendaId);
        const { testType, answers } = req.body || {};
        if (!['pretest', 'posttest'].includes(testType)) {
          return res.status(400).json({ error: 'Tipe tes tidak valid.' });
        }

        const ctx = await loadApprovedRoomContext(agendaId, req.dbUser!.id);
        if (ctx.ok === false) {
          return res.status(ctx.errorStatus).json({ error: ctx.error });
        }

        const targetDay = testType === 'pretest' ? 1 : 3;
        if (ctx.dayInfo.currentDayNumber !== targetDay) {
          return res.status(400).json({
            error: `${testType === 'pretest' ? 'Pre Test' : 'Post Test'} hanya aktif pada Hari ke-${targetDay} (${ctx.dayInfo.dayDates[targetDay]}).`,
          });
        }

        const [allTests, allQuestions] = await Promise.all([
          listCollection<TestSubmissionRow>('test_submissions'),
          listCollection<QuestionRow>('questions'),
        ]);

        const existing = allTests.find(
          (t) =>
            t.agendaId === agendaId &&
            t.userId === req.dbUser!.id &&
            t.testType === testType
        );

        if (existing) {
          return res.status(409).json({ error: 'Tes ini sudah pernah dikerjakan.' });
        }

        const activeQuestions = allQuestions.filter(
          (q) => q.testType === testType && q.isActive
        );

        const summary = calculateTestScore(activeQuestions, answers || {});

        const inserted = await insertOne<TestSubmissionRow>('test_submissions', {
          agendaId,
          userId: req.dbUser!.id,
          testType,
          answersJson: answers || {},
          score: summary.score,
          maxScore: summary.maxScore,
          submittedAt: new Date(),
        });

        res.status(201).json({ submission: inserted, summary });
      } catch (error) {
        console.error('Submit test error:', error);
        res.status(500).json({ error: 'Gagal menyimpan jawaban tes.' });
      }
    }
  );

  app.post(
    '/api/peserta/room/:agendaId/evaluation',
    requireAuth,
    async (req: AuthRequest, res: Response) => {
      try {
        const agendaId = Number(req.params.agendaId);
        const {
          targetType,
          speakerNumber,
          ratingMastery,
          ratingDelivery,
          ratingMaterial,
          comments,
        } = req.body || {};

        if (!['speaker', 'committee'].includes(targetType)) {
          return res.status(400).json({ error: 'Jenis penilaian tidak valid.' });
        }

        const ctx = await loadApprovedRoomContext(agendaId, req.dbUser!.id);
        if (ctx.ok === false) {
          return res.status(ctx.errorStatus).json({ error: ctx.error });
        }

        let requiredDay = 3;
        let spNum: number | null = null;
        if (targetType === 'speaker') {
          spNum = Number(speakerNumber);
          if (spNum < 1 || spNum > 6) {
            return res.status(400).json({ error: 'Nomor narasumber harus 1 sampai 6.' });
          }
          requiredDay = spNum <= 2 ? 1 : spNum <= 4 ? 2 : 3;
        }

        if (ctx.dayInfo.currentDayNumber !== requiredDay) {
          return res.status(400).json({
            error: `Penilaian ini hanya aktif pada Hari ke-${requiredDay} (${ctx.dayInfo.dayDates[requiredDay]}).`,
          });
        }

        const allEvals = await listCollection<EvaluationRow>('evaluations');
        const existing = allEvals.filter(
          (e) =>
            e.agendaId === agendaId &&
            e.userId === req.dbUser!.id &&
            e.targetType === targetType
        );

        const alreadyExists =
          targetType === 'committee'
            ? existing.length > 0
            : existing.some((e) => e.speakerNumber === spNum);

        if (alreadyExists) {
          return res.status(409).json({ error: 'Penilaian ini sudah dikirim.' });
        }

        const clampRating = (val: unknown) =>
          Math.min(5, Math.max(1, Number(val) || 5));

        const speakerName =
          targetType === 'committee'
            ? 'Panitia Pelaksana'
            : getSpeakerName(ctx.agenda.speakers, spNum);

        const inserted = await insertOne<EvaluationRow>('evaluations', {
          agendaId,
          userId: req.dbUser!.id,
          targetType,
          speakerNumber: spNum,
          speakerName,
          ratingMastery: clampRating(ratingMastery),
          ratingDelivery: clampRating(ratingDelivery),
          ratingMaterial: clampRating(ratingMaterial),
          comments: String(comments || '').trim(),
          submittedAt: new Date(),
        });

        res.status(201).json(inserted);
      } catch (error) {
        console.error('Submit evaluation error:', error);
        res.status(500).json({ error: 'Gagal menyimpan penilaian.' });
      }
    }
  );

  app.post(
    '/api/peserta/room/:agendaId/upload',
    requireAuth,
    async (req: AuthRequest, res: Response) => {
      try {
        const agendaId = Number(req.params.agendaId);
        const {
          docType,
          fileName,
          mimeType,
          fileBase64,
          fileSize,
          allowPortalArchiveFallback,
        } = req.body || {};

        if (!['komitmen', 'tugas'].includes(docType) || !fileName?.trim()) {
          return res.status(400).json({
            error: 'Jenis dokumen dan nama file wajib disertakan.',
          });
        }

        const ctx = await loadApprovedRoomContext(agendaId, req.dbUser!.id);
        if (ctx.ok === false) {
          return res.status(ctx.errorStatus).json({ error: ctx.error });
        }

        const requiredDay = docType === 'komitmen' ? 1 : 3;
        if (ctx.dayInfo.currentDayNumber !== requiredDay) {
          return res.status(400).json({
            error: `Upload ${docType === 'komitmen' ? 'Lembar Komitmen' : 'Tugas'} hanya aktif pada Hari ke-${requiredDay} (${ctx.dayInfo.dayDates[requiredDay]}).`,
          });
        }

        const googleToken = req.headers['x-google-access-token'] as string | undefined;
        let driveFileId = '';
        let driveWebViewLink = '';
        let storageMode = 'google_drive';

        if (googleToken && fileBase64) {
          const cleanName = `[Bimtek-${agendaId}][${docType.toUpperCase()}]_${req.dbUser!.fullName}_${String(fileName).trim()}`;
          const metadata = JSON.stringify({
            name: cleanName,
            description: `Dokumen ${docType} Portal Bimtek LPSE - ${ctx.agenda.title}`,
          });
          const boundary = `bimtek_boundary_${Date.now()}`;
          const fileBuffer = Buffer.from(String(fileBase64), 'base64');

          const part1 = Buffer.from(
            `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType || 'application/octet-stream'}\r\n\r\n`
          );
          const part2 = Buffer.from(`\r\n--${boundary}--`);
          const multipartBody = Buffer.concat([part1, fileBuffer, part2]);

          const driveRes = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${googleToken}`,
                'Content-Type': `multipart/related; boundary=${boundary}`,
              },
              body: multipartBody,
            }
          );

          if (!driveRes.ok) {
            const errTxt = await driveRes.text();
            console.error('Google Drive upload error:', errTxt);
            return res.status(502).json({
              error:
                'Gagal mengunggah dokumen ke Google Drive. Pastikan izin Google Drive aktif.',
            });
          }

          const driveData = (await driveRes.json()) as {
            id: string;
            webViewLink?: string;
          };
          driveFileId = driveData.id;
          driveWebViewLink =
            driveData.webViewLink ||
            `https://drive.google.com/file/d/${driveData.id}/view`;
        } else if (allowPortalArchiveFallback) {
          storageMode = 'portal_archive';
          driveFileId = `archive-${Date.now()}`;
        } else {
          return res.status(400).json({
            error:
              'Hubungkan akun Google Drive terlebih dahulu agar dokumen tersimpan otomatis di Google Drive.',
            requiresGoogleAuth: true,
          });
        }

        const allDocs = await listCollection<DocumentUploadRow>('document_uploads');
        const oldDocs = allDocs.filter(
          (d) =>
            d.agendaId === agendaId &&
            d.userId === req.dbUser!.id &&
            d.docType === docType
        );
        await Promise.all(oldDocs.map((d) => removeById('document_uploads', d.id)));

        const inserted = await insertOne<DocumentUploadRow>('document_uploads', {
          agendaId,
          userId: req.dbUser!.id,
          docType,
          fileName: String(fileName).trim(),
          mimeType: String(mimeType || 'application/pdf'),
          fileSize: Number(fileSize) || 0,
          driveFileId,
          driveWebViewLink,
          storageMode,
          uploadedAt: new Date(),
        });

        res.status(201).json(inserted);
      } catch (error) {
        console.error('Upload document error:', error);
        res.status(500).json({ error: 'Gagal menyimpan dokumen upload.' });
      }
    }
  );

  // ------------------------------------------------------------------
  // VITE / STATIC SERVING
  // ------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Portal Bimtek server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Portal Bimtek server:', err);
  process.exit(1);
});
