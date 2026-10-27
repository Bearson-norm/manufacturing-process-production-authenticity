const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const {
  buildSessionExportWorkbook,
  buildImportTemplateWorkbook,
  parseImportWorkbook,
  writeWorkbookToBuffer,
} = require('../utils/qr-scan-excel.utils');

async function workbookFromTemplate(pic, shift, barcodes) {
  const workbook = buildImportTemplateWorkbook();
  const sessionSheet = workbook.getWorksheet('Sesi');
  sessionSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const label = String(row.getCell(1).value || '').trim();
    if (label === 'pic') row.getCell(2).value = pic;
    if (label === 'shift_number') row.getCell(2).value = shift;
  });
  const barcodeSheet = workbook.getWorksheet('Barcode');
  barcodeSheet.spliceRows(2, barcodeSheet.rowCount - 1);
  for (const bc of barcodes) {
    barcodeSheet.addRow({ barcode: bc, scanned_at: '' });
  }
  return writeWorkbookToBuffer(workbook);
}

describe('qr-scan-excel.utils', () => {
  it('export workbook has Sesi and Barcode sheets', async () => {
    const workbook = buildSessionExportWorkbook(
      {
        session_number: 3,
        pic: 'Test PIC',
        shift_number: '2',
        status: 'ongoing',
        created_at: new Date('2026-10-27T01:00:00.000Z'),
        finished_at: null,
      },
      [{ barcode: '8901234567890', scanned_at: new Date('2026-10-27T02:12:05.000Z') }]
    );
    assert.ok(workbook.getWorksheet('Sesi'));
    assert.ok(workbook.getWorksheet('Barcode'));
    const buffer = await writeWorkbookToBuffer(workbook);
    assert.ok(Buffer.isBuffer(buffer) || buffer instanceof ArrayBuffer);
  });

  it('parseImportWorkbook reads pic, shift, and barcodes', async () => {
    const buffer = await workbookFromTemplate('Rina Wulandari', '1', [
      '1111111111111',
      '2222222222222',
      '1111111111111',
    ]);
    const parsed = await parseImportWorkbook(Buffer.from(buffer));
    assert.equal(parsed.ok, true);
    assert.equal(parsed.pic, 'Rina Wulandari');
    assert.equal(parsed.shift_number, '1');
    assert.deepEqual(parsed.barcodes, [
      '1111111111111',
      '2222222222222',
      '1111111111111',
    ]);
  });

  it('parseImportWorkbook fails when Sesi sheet missing', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Barcode').addRow(['barcode', 'scanned_at']);
    const buffer = await writeWorkbookToBuffer(workbook);
    const parsed = await parseImportWorkbook(Buffer.from(buffer));
    assert.equal(parsed.ok, false);
    assert.equal(parsed.code, 'IMPORT_SHEET_MISSING');
  });
});
