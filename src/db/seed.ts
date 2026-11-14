import {
  insertMany,
  insertOne,
  listCollection,
  type AgendaRegistrationRow,
  type AgendaRow,
  type AttendanceRow,
  type BimtekStageRow,
  type DocumentUploadRow,
  type EvaluationRow,
  type LpseLocationRow,
  type QuestionRow,
  type TestSubmissionRow,
  type UserRow,
} from './firestore-store.ts';
import { hashPassword } from '../lib/auth-crypto.ts';
import { addDaysToDateKey, toJakartaDateKey } from '../utils/bimtekLogic.ts';

let seedPromise: Promise<void> | null = null;

function jakartaTimestamp(dateKey: string, timeStr: string): Date {
  return new Date(`${dateKey}T${timeStr}+07:00`);
}

export async function ensureSeedData(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}

async function runSeed(): Promise<void> {
  const [existingLpse, existingStages, existingQuestions, existingUsers, existingAgendas] =
    await Promise.all([
      listCollection<LpseLocationRow>('lpse_locations'),
      listCollection<BimtekStageRow>('bimtek_stages'),
      listCollection<QuestionRow>('questions'),
      listCollection<UserRow>('users'),
      listCollection<AgendaRow>('agendas'),
    ]);

  // 1. Seed LPSE Locations if empty
  if (existingLpse.length === 0) {
    const now = new Date();
    await insertMany<LpseLocationRow>('lpse_locations', [
      { name: 'LPSE Kementerian Keuangan', province: 'DKI Jakarta', isActive: true, createdAt: now },
      { name: 'LPSE Provinsi DKI Jakarta', province: 'DKI Jakarta', isActive: true, createdAt: now },
      { name: 'LPSE Provinsi Jawa Barat', province: 'Jawa Barat', isActive: true, createdAt: now },
      { name: 'LPSE Provinsi Jawa Tengah', province: 'Jawa Tengah', isActive: true, createdAt: now },
      { name: 'LPSE Provinsi Jawa Timur', province: 'Jawa Timur', isActive: true, createdAt: now },
      { name: 'LPSE Kota Bandung', province: 'Jawa Barat', isActive: true, createdAt: now },
      { name: 'LPSE Kota Surabaya', province: 'Jawa Timur', isActive: true, createdAt: now },
      { name: 'LPSE Kabupaten Bogor', province: 'Jawa Barat', isActive: true, createdAt: now },
    ]);
  }

  // 2. Seed 14 Default Bimtek Stages if empty
  if (existingStages.length === 0) {
    await insertMany<BimtekStageRow>('bimtek_stages', [
      {
        stageKey: 'absen_day_1',
        title: 'Absen Day 1',
        stageType: 'attendance',
        dayNumber: 1,
        speakerNumber: null,
        orderIndex: 1,
        isRequired: true,
        isActive: true,
        description: 'Presensi kehadiran peserta pada hari pertama pelaksanaan Bimtek.',
      },
      {
        stageKey: 'upload_komitmen',
        title: 'Upload Lembar Komitmen',
        stageType: 'upload',
        dayNumber: 1,
        speakerNumber: null,
        orderIndex: 2,
        isRequired: true,
        isActive: true,
        description: 'Unggah pindaian lembar komitmen peserta (tersimpan otomatis di Google Drive).',
      },
      {
        stageKey: 'pretest',
        title: 'Pre Test',
        stageType: 'pretest',
        dayNumber: 1,
        speakerNumber: null,
        orderIndex: 3,
        isRequired: true,
        isActive: true,
        description: 'Evaluasi pemahaman awal peserta sebelum materi hari pertama dimulai.',
      },
      {
        stageKey: 'eval_narasumber_1',
        title: 'Penilaian Narasumber 1',
        stageType: 'eval_speaker',
        dayNumber: 1,
        speakerNumber: 1,
        orderIndex: 4,
        isRequired: true,
        isActive: true,
        description: 'Evaluasi penyampaian materi oleh Narasumber sesi 1.',
      },
      {
        stageKey: 'eval_narasumber_2',
        title: 'Penilaian Narasumber 2',
        stageType: 'eval_speaker',
        dayNumber: 1,
        speakerNumber: 2,
        orderIndex: 5,
        isRequired: true,
        isActive: true,
        description: 'Evaluasi penyampaian materi oleh Narasumber sesi 2.',
      },
      {
        stageKey: 'absen_day_2',
        title: 'Absen Day 2',
        stageType: 'attendance',
        dayNumber: 2,
        speakerNumber: null,
        orderIndex: 6,
        isRequired: true,
        isActive: true,
        description: 'Presensi kehadiran peserta pada hari kedua pelaksanaan Bimtek.',
      },
      {
        stageKey: 'eval_narasumber_3',
        title: 'Penilaian Narasumber 3',
        stageType: 'eval_speaker',
        dayNumber: 2,
        speakerNumber: 3,
        orderIndex: 7,
        isRequired: true,
        isActive: true,
        description: 'Evaluasi penyampaian materi oleh Narasumber sesi 3.',
      },
      {
        stageKey: 'eval_narasumber_4',
        title: 'Penilaian Narasumber 4',
        stageType: 'eval_speaker',
        dayNumber: 2,
        speakerNumber: 4,
        orderIndex: 8,
        isRequired: true,
        isActive: true,
        description: 'Evaluasi penyampaian materi oleh Narasumber sesi 4.',
      },
      {
        stageKey: 'absen_day_3',
        title: 'Absen Day 3',
        stageType: 'attendance',
        dayNumber: 3,
        speakerNumber: null,
        orderIndex: 9,
        isRequired: true,
        isActive: true,
        description: 'Presensi kehadiran peserta pada hari ketiga pelaksanaan Bimtek.',
      },
      {
        stageKey: 'eval_narasumber_5',
        title: 'Penilaian Narasumber 5',
        stageType: 'eval_speaker',
        dayNumber: 3,
        speakerNumber: 5,
        orderIndex: 10,
        isRequired: true,
        isActive: true,
        description: 'Evaluasi penyampaian materi oleh Narasumber sesi 5.',
      },
      {
        stageKey: 'eval_narasumber_6',
        title: 'Penilaian Narasumber 6',
        stageType: 'eval_speaker',
        dayNumber: 3,
        speakerNumber: 6,
        orderIndex: 11,
        isRequired: true,
        isActive: true,
        description: 'Evaluasi penyampaian materi oleh Narasumber sesi 6.',
      },
      {
        stageKey: 'eval_panitia',
        title: 'Penilaian Panitia Pelaksana',
        stageType: 'eval_committee',
        dayNumber: 3,
        speakerNumber: null,
        orderIndex: 12,
        isRequired: true,
        isActive: true,
        description: 'Evaluasi penyelenggaraan dan layanan panitia pelaksana Bimtek.',
      },
      {
        stageKey: 'posttest',
        title: 'Post Test',
        stageType: 'posttest',
        dayNumber: 3,
        speakerNumber: null,
        orderIndex: 13,
        isRequired: true,
        isActive: true,
        description: 'Evaluasi akhir pencapaian kompetensi peserta setelah seluruh materi selesai.',
      },
      {
        stageKey: 'upload_tugas',
        title: 'Upload Tugas',
        stageType: 'upload',
        dayNumber: 3,
        speakerNumber: null,
        orderIndex: 14,
        isRequired: true,
        isActive: true,
        description: 'Unggah dokumen tugas akhir / rencana tindak lanjut ke Google Drive.',
      },
    ]);
  }

  // 3. Seed Pretest and Posttest questions if empty
  if (existingQuestions.length === 0) {
    const now = new Date();
    await insertMany<QuestionRow>('questions', [
      {
        testType: 'pretest',
        questionText: 'Apa tujuan utama penerapan Sistem Pengadaan Secara Elektronik (SPSE) pada LPSE?',
        optionsJson: [
          'Meningkatkan transparansi, efisiensi, dan akuntabilitas pengadaan pemerintah',
          'Mengurangi jumlah penyedia barang/jasa lokal',
          'Menghapus tahapan verifikasi kualifikasi penyedia',
          'Memperpanjang waktu proses lelang manual',
        ],
        correctIndex: 0,
        weight: 25,
        orderIndex: 1,
        isActive: true,
        createdAt: now,
      },
      {
        testType: 'pretest',
        questionText: 'Dokumen apa yang wajib diunggah oleh peserta pada hari pertama sebagai bukti kesungguhan mengikuti Bimtek?',
        optionsJson: [
          'Surat Perjalanan Dinas selesai acara',
          'Lembar Komitmen mengikuti Bimtek',
          'Berita Acara Serah Terima Barang',
          'Laporan Pertanggungjawaban Keuangan',
        ],
        correctIndex: 1,
        weight: 25,
        orderIndex: 2,
        isActive: true,
        createdAt: now,
      },
      {
        testType: 'pretest',
        questionText: 'Dalam tata kelola LPSE, siapakah yang berwenang melakukan verifikasi awal dokumen penyedia?',
        optionsJson: [
          'Verifikator LPSE sesuai standar layanan',
          'Auditor eksternal setelah kontrak berakhir',
          'Panitia acara seremonial',
          'Penyedia jasa kurir dokumen',
        ],
        correctIndex: 0,
        weight: 25,
        orderIndex: 3,
        isActive: true,
        createdAt: now,
      },
      {
        testType: 'pretest',
        questionText: 'Prinsip keamanan informasi utama yang harus dijaga admin dan operator LPSE meliputi aspek apa saja?',
        optionsJson: [
          'Kerahasiaan, integritas, dan ketersediaan data (CIA)',
          'Publikasi password secara terbuka',
          'Menghapus log aktivitas setiap akhir pekan',
          'Berbagi akun admin antar instansi',
        ],
        correctIndex: 0,
        weight: 25,
        orderIndex: 4,
        isActive: true,
        createdAt: now,
      },
      {
        testType: 'posttest',
        questionText: 'Setelah mengikuti Bimtek, langkah pertama ketika menemukan indikasi anomali akses pada aplikasi SPSE adalah?',
        optionsJson: [
          'Mengabaikan catatan log hingga akhir tahun anggaran',
          'Mencatat log insiden, mengamankan akun terkait, dan eskalasi sesuai SOP LPSE',
          'Membagikan kredensial admin kepada pihak ketiga',
          'Menonaktifkan seluruh server tanpa pemberitahuan',
        ],
        correctIndex: 1,
        weight: 25,
        orderIndex: 1,
        isActive: true,
        createdAt: now,
      },
      {
        testType: 'posttest',
        questionText: 'Bagaimana peran E-Katalog dalam percepatan pengadaan barang/jasa pemerintah?',
        optionsJson: [
          'Mempersingkat proses pemilihan penyedia untuk produk terstandar secara transparan',
          'Menggantikan seluruh proses perencanaan anggaran daerah',
          'Menghapus kewajiban pelaporan realisasi kontrak',
          'Membatasi akses hanya untuk satu wilayah provinsi',
        ],
        correctIndex: 0,
        weight: 25,
        orderIndex: 2,
        isActive: true,
        createdAt: now,
      },
      {
        testType: 'posttest',
        questionText: 'Apa manfaat utama sinkronisasi laporan Bimtek ke Google Sheets dan arsip Google Drive?',
        optionsJson: [
          'Memastikan rekapitulasi absensi, evaluasi, dan dokumen peserta terdokumentasi real-time',
          'Menggantikan kewajiban verifikasi identitas peserta',
          'Mengurangi jumlah narasumber yang dibutuhkan',
          'Menutup akses peserta terhadap materi pelatihan',
        ],
        correctIndex: 0,
        weight: 25,
        orderIndex: 3,
        isActive: true,
        createdAt: now,
      },
      {
        testType: 'posttest',
        questionText: 'Standar layanan LPSE menekankan penilaian berkala terhadap aspek apa untuk peningkatan mutu?',
        optionsJson: [
          'Kompetensi narasumber, kualitas materi, dan kinerja panitia pelaksana',
          'Warna seragam peserta selama kegiatan',
          'Jumlah halaman brosur cetak yang dibagikan',
          'Jarak tempat tinggal peserta dari lokasi hotel',
        ],
        correctIndex: 0,
        weight: 25,
        orderIndex: 4,
        isActive: true,
        createdAt: now,
      },
    ]);
  }

  // 4. Seed Demo Users if empty
  let adminUser: UserRow | undefined;
  let picUser: UserRow | undefined;
  let pesertaBudi: UserRow | undefined;

  if (existingUsers.length === 0) {
    const now = new Date();
    const insertedUsers = await insertMany<UserRow>('users', [
      {
        uid: 'local-admin-001',
        email: 'admin@bimtek.go.id',
        passwordHash: hashPassword('Admin123!'),
        fullName: 'Raden Pratama',
        phone: '08119001001',
        jabatan: 'Administrator Sistem Bimtek',
        lpseLocation: 'LPSE Kementerian Keuangan',
        role: 'admin',
        accountStatus: 'approved',
        verifiedBy: null,
        verifiedAt: now,
        createdAt: now,
      },
      {
        uid: 'local-pic-001',
        email: 'pic@bimtek.go.id',
        passwordHash: hashPassword('Pic123!'),
        fullName: 'Dewi Anggraini',
        phone: '08129002002',
        jabatan: 'PIC Verifikasi & Operasional Kelas',
        lpseLocation: 'LPSE Provinsi DKI Jakarta',
        role: 'pic',
        accountStatus: 'approved',
        verifiedBy: null,
        verifiedAt: now,
        createdAt: now,
      },
      {
        uid: 'local-peserta-001',
        email: 'budi.santoso@lpse.go.id',
        passwordHash: hashPassword('Peserta123!'),
        fullName: 'Budi Santoso',
        phone: '08138887771',
        jabatan: 'Pranata Komputer Ahli Pertama',
        lpseLocation: 'LPSE Provinsi Jawa Barat',
        role: 'peserta',
        accountStatus: 'approved',
        verifiedBy: null,
        verifiedAt: now,
        createdAt: now,
      },
      {
        uid: 'local-peserta-002',
        email: 'siti.rahma@lpse.go.id',
        passwordHash: hashPassword('Peserta123!'),
        fullName: 'Siti Rahmawati',
        phone: '08157776662',
        jabatan: 'Verifikator Layanan LPSE',
        lpseLocation: 'LPSE Kota Bandung',
        role: 'peserta',
        accountStatus: 'pending',
        verifiedBy: null,
        verifiedAt: null,
        createdAt: now,
      },
    ]);

    adminUser = insertedUsers.find((u) => u.role === 'admin');
    picUser = insertedUsers.find((u) => u.role === 'pic');
    pesertaBudi = insertedUsers.find((u) => u.email === 'budi.santoso@lpse.go.id');
  } else {
    adminUser = existingUsers.find((u) => u.role === 'admin');
    picUser = existingUsers.find((u) => u.role === 'pic');
    pesertaBudi = existingUsers.find((u) => u.email === 'budi.santoso@lpse.go.id');
  }

  // 5. Seed Agendas anchored to today's Jakarta date
  if (existingAgendas.length === 0 && adminUser && picUser && pesertaBudi) {
    const now = new Date();
    const todayKey = toJakartaDateKey(now);
    const yesterdayKey = addDaysToDateKey(todayKey, -1);
    const twoDaysAgoKey = addDaysToDateKey(todayKey, -2);
    const fiveDaysAgoKey = addDaysToDateKey(todayKey, -5);
    const twoDaysLaterKey = addDaysToDateKey(todayKey, 2);
    const fiveDaysLaterKey = addDaysToDateKey(todayKey, 5);
    const sevenDaysLaterKey = addDaysToDateKey(todayKey, 7);

    const insertedAgendas = await insertMany<AgendaRow>('agendas', [
      {
        title: 'Bimtek Pengadaan Elektronik & SPSE v4.5 (Angkatan I)',
        registrationOpenAt: jakartaTimestamp(fiveDaysAgoKey, '08:00:00'),
        registrationCloseAt: jakartaTimestamp(todayKey, '23:59:00'),
        startDate: jakartaTimestamp(todayKey, '08:00:00'),
        endDate: jakartaTimestamp(twoDaysLaterKey, '16:30:00'),
        location: 'Hotel Mercure Convention Center, Jakarta',
        materialTitle: 'Tata Kelola SPSE, Keamanan Akun, dan Verifikasi Penyedia',
        speakers:
          'Dr. Hendra Wijaya, Ir. Ratna Kusuma, Agus Salim S.Kom, Dra. Maya Sari, Bambang Sutrisno, Rina Hartati M.TI',
        description:
          'Pelatihan intensif 3 hari untuk operator dan verifikator LPSE mengenai pengoperasian SPSE v4.5 serta audit kepatuhan.',
        createdBy: adminUser.id,
        createdAt: now,
      },
      {
        title: 'Bimtek E-Katalog & Audit Pengadaan Digital (Angkatan II)',
        registrationOpenAt: jakartaTimestamp(addDaysToDateKey(todayKey, -10), '08:00:00'),
        registrationCloseAt: jakartaTimestamp(twoDaysAgoKey, '23:59:00'),
        startDate: jakartaTimestamp(twoDaysAgoKey, '08:00:00'),
        endDate: jakartaTimestamp(todayKey, '17:00:00'),
        location: 'Balai Diklat Keuangan, Bandung',
        materialTitle: 'Optimalisasi E-Katalog Nasional & Lokal serta Pelaporan Kontrak',
        speakers:
          'Prof. Arif Rahman, Dian Permata M.Si, Eko Prasetyo, Nia Kurniawati, Fajar Nugroho, Yulia Fitriana',
        description:
          'Bimbingan teknis lanjutan hari ke-3 yang mencakup evaluasi narasumber, panitia, post-test, dan unggah tugas akhir.',
        createdBy: adminUser.id,
        createdAt: now,
      },
      {
        title: 'Bimtek Keamanan Informasi & Integrasi Data LPSE (Angkatan III)',
        registrationOpenAt: jakartaTimestamp(yesterdayKey, '08:00:00'),
        registrationCloseAt: jakartaTimestamp(addDaysToDateKey(todayKey, 4), '23:59:00'),
        startDate: jakartaTimestamp(fiveDaysLaterKey, '08:30:00'),
        endDate: jakartaTimestamp(sevenDaysLaterKey, '16:00:00'),
        location: 'Grand Mercure Surabaya City',
        materialTitle: null,
        speakers: null,
        description:
          'Agenda mendatang dengan pendaftaran yang sedang dibuka untuk seluruh perwakilan LPSE daerah.',
        createdBy: adminUser.id,
        createdAt: now,
      },
    ]);

    const agendaDay1 = insertedAgendas[0];
    const agendaDay3 = insertedAgendas[1];

    await insertMany<AgendaRegistrationRow>('agenda_registrations', [
      {
        agendaId: agendaDay1.id,
        userId: pesertaBudi.id,
        status: 'approved',
        approvedBy: picUser.id,
        approvedAt: now,
        notes: 'Disetujui mengikuti angkatan I',
        createdAt: now,
      },
      {
        agendaId: agendaDay3.id,
        userId: pesertaBudi.id,
        status: 'approved',
        approvedBy: picUser.id,
        approvedAt: jakartaTimestamp(twoDaysAgoKey, '07:45:00'),
        notes: 'Disetujui mengikuti angkatan II',
        createdAt: jakartaTimestamp(twoDaysAgoKey, '07:30:00'),
      },
    ]);

    await Promise.all([
      insertOne<AttendanceRow>('attendances', {
        agendaId: agendaDay3.id,
        userId: pesertaBudi.id,
        dayNumber: 1,
        attendanceDate: twoDaysAgoKey,
        checkedInAt: jakartaTimestamp(twoDaysAgoKey, '08:12:00'),
        notes: '',
      }),
      insertOne<DocumentUploadRow>('document_uploads', {
        agendaId: agendaDay3.id,
        userId: pesertaBudi.id,
        docType: 'komitmen',
        fileName: 'Lembar_Komitmen_Budi_Santoso.pdf',
        mimeType: 'application/pdf',
        fileSize: 245120,
        driveFileId: 'sample-drive-doc-001',
        driveWebViewLink: '',
        storageMode: 'portal_archive',
        uploadedAt: jakartaTimestamp(twoDaysAgoKey, '08:25:00'),
      }),
      insertOne<TestSubmissionRow>('test_submissions', {
        agendaId: agendaDay3.id,
        userId: pesertaBudi.id,
        testType: 'pretest',
        answersJson: { '1': 0, '2': 1, '3': 0, '4': 1 },
        score: 75,
        maxScore: 100,
        submittedAt: jakartaTimestamp(twoDaysAgoKey, '08:40:00'),
      }),
      insertMany<EvaluationRow>('evaluations', [
        {
          agendaId: agendaDay3.id,
          userId: pesertaBudi.id,
          targetType: 'speaker',
          speakerNumber: 1,
          speakerName: 'Prof. Arif Rahman',
          ratingMastery: 5,
          ratingDelivery: 5,
          ratingMaterial: 4,
          comments: 'Materi sangat aplikatif dan jelas.',
          submittedAt: jakartaTimestamp(twoDaysAgoKey, '12:00:00'),
        },
        {
          agendaId: agendaDay3.id,
          userId: pesertaBudi.id,
          targetType: 'speaker',
          speakerNumber: 2,
          speakerName: 'Dian Permata M.Si',
          ratingMastery: 5,
          ratingDelivery: 4,
          ratingMaterial: 5,
          comments: 'Studi kasus E-Katalog sangat membantu.',
          submittedAt: jakartaTimestamp(twoDaysAgoKey, '15:30:00'),
        },
      ]),
    ]);
  }
}
