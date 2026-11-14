import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCsv, crc32, createZipArchive, escapeCsvCell } from './exportUtils';

test('escapeCsvCell handles commas, quotes, newlines, and nullish values', () => {
  assert.equal(escapeCsvCell(''), '');
  assert.equal(escapeCsvCell(null), '');
  assert.equal(escapeCsvCell(undefined), '');
  assert.equal(escapeCsvCell(42), '42');
  assert.equal(escapeCsvCell('LPSE Kota Bandung'), 'LPSE Kota Bandung');
  assert.equal(escapeCsvCell('Budi, S.Kom'), '"Budi, S.Kom"');
  assert.equal(escapeCsvCell('Materi "SPSE"'), '"Materi ""SPSE"""');
  assert.equal(escapeCsvCell('Baris 1\nBaris 2'), '"Baris 1\nBaris 2"');
});

test('buildCsv outputs UTF-8 BOM and CRLF delimited rows', () => {
  const csv = buildCsv(
    ['Nama', 'LPSE', 'Skor'],
    [
      ['Budi Santoso', 'LPSE Jabar', 85],
      ['Siti, M.Si', 'LPSE "Sleman"', 90],
    ]
  );
  assert.equal(csv.startsWith('\uFEFF'), true);
  const lines = csv.slice(1).split('\r\n');
  assert.equal(lines.length, 3);
  assert.equal(lines[0], 'Nama,LPSE,Skor');
  assert.equal(lines[1], 'Budi Santoso,LPSE Jabar,85');
  assert.equal(lines[2], '"Siti, M.Si","LPSE ""Sleman""",90');
});

test('createZipArchive writes valid PKZIP signatures, entry count, and CRC32', () => {
  const helloBytes = new TextEncoder().encode('Halo Portal Bimtek');
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);

  const zip = createZipArchive([
    { name: '01-agenda.csv', content: 'ID,Judul\r\n1,Bimtek' },
    { name: '02-peserta.csv', content: helloBytes },
  ]);

  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  // Local file header signature at byte 0
  assert.equal(view.getUint32(0, true), 0x04034b50);
  // EOCD signature at last 22 bytes
  const eocdOffset = zip.length - 22;
  assert.equal(view.getUint32(eocdOffset, true), 0x06054b50);
  assert.equal(view.getUint16(eocdOffset + 8, true), 2);
  assert.equal(view.getUint16(eocdOffset + 10, true), 2);

  // Verify filenames exist inside archive
  const ascii = new TextDecoder().decode(zip);
  assert.equal(ascii.includes('01-agenda.csv'), true);
  assert.equal(ascii.includes('02-peserta.csv'), true);
});
