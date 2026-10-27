const ExcelJS = require('exceljs');

const MAX_IMPORT_BARCODE_ROWS = 10000;

const SESSION_FIELD_ROWS = [
  { key: 'session_number', label: 'session_number', exportOnly: true },
  { key: 'pic', label: 'pic' },
  { key: 'shift_number', label: 'shift_number' },
  { key: 'status', label: 'status', exportOnly: true },
  { key: 'created_at', label: 'created_at', exportOnly: true },
  { key: 'finished_at', label: 'finished_at', exportOnly: true },
];

const BARCODE_COLUMNS = [
  { key: 'barcode', header: 'barcode', width: 28 },
  { key: 'scanned_at', header: 'scanned_at', width: 22 },
];

function formatDateTimeWib(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'short',
      timeStyle: 'medium',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function normalizeLabel(cell) {
  return String(cell ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function styleHeaderRow(sheet) {
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle' };
}

function buildExportFilename(sessionNumber) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value || '00';
  return `qr-scan-sesi-${sessionNumber}-${get('day')}${get('month')}${get('year')}-${get('hour')}${get('minute')}.xlsx`;
}

function buildTemplateFilename() {
  return 'qr-scan-import-template.xlsx';
}

function addSessionSheet(workbook, sessionRow, forTemplate = false) {
  const sheet = workbook.addWorksheet('Sesi');
  sheet.getColumn(1).width = 22;
  sheet.getColumn(2).width = 36;
  sheet.getCell('A1').font = { bold: true };
  sheet.getCell('B1').font = { bold: true };
  sheet.getCell('A1').value = 'field';
  sheet.getCell('B1').value = 'value';

  let rowIndex = 2;
  for (const field of SESSION_FIELD_ROWS) {
    if (forTemplate && field.exportOnly) continue;
    sheet.getCell(`A${rowIndex}`).value = field.label;
    if (!forTemplate && sessionRow) {
      if (field.key === 'created_at' || field.key === 'finished_at') {
        sheet.getCell(`B${rowIndex}`).value = formatDateTimeWib(sessionRow[field.key]);
      } else {
        sheet.getCell(`B${rowIndex}`).value = sessionRow[field.key] ?? '';
      }
    } else if (forTemplate) {
      sheet.getCell(`B${rowIndex}`).value = field.key === 'shift_number' ? '1' : '';
    }
    rowIndex += 1;
  }
  return sheet;
}

function addBarcodeSheet(workbook, items) {
  const sheet = workbook.addWorksheet('Barcode');
  sheet.columns = BARCODE_COLUMNS.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width,
  }));
  styleHeaderRow(sheet);
  for (const item of items || []) {
    sheet.addRow({
      barcode: item.barcode,
      scanned_at: formatDateTimeWib(item.scanned_at),
    });
  }
  return sheet;
}

function buildSessionExportWorkbook(sessionRow, items) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Manufacturing Process Production Authenticity';
  workbook.created = new Date();
  addSessionSheet(workbook, sessionRow, false);
  addBarcodeSheet(workbook, items);
  return workbook;
}

function buildImportTemplateWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Manufacturing Process Production Authenticity';
  workbook.created = new Date();
  addSessionSheet(workbook, null, true);
  addBarcodeSheet(workbook, [{ barcode: '', scanned_at: '' }]);
  const sheet = workbook.getWorksheet('Barcode');
  if (sheet && sheet.rowCount > 1) {
    sheet.spliceRows(2, 1);
  }
  return workbook;
}

async function writeWorkbookToBuffer(workbook) {
  return workbook.xlsx.writeBuffer();
}

function readSessionSheet(sheet) {
  const map = new Map();
  if (!sheet) {
    return { ok: false, error: 'Sheet Sesi tidak ditemukan', code: 'IMPORT_SHEET_MISSING' };
  }

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const label = normalizeLabel(row.getCell(1).value);
    const value = row.getCell(2).value;
    if (!label) return;
    map.set(label, value == null ? '' : String(value).trim());
  });

  const pic =
    map.get('pic') ||
    map.get('nama_pic') ||
    map.get('pic_input') ||
    '';
  const shift =
    map.get('shift_number') ||
    map.get('nomor_shift') ||
    map.get('shift') ||
    '';

  return { ok: true, pic, shift_number: shift };
}

function readBarcodeSheet(sheet) {
  if (!sheet) {
    return { ok: false, error: 'Sheet Barcode tidak ditemukan', code: 'IMPORT_SHEET_MISSING' };
  }

  const headerRow = sheet.getRow(1);
  let barcodeCol = 1;
  for (let c = 1; c <= headerRow.cellCount; c += 1) {
    const h = normalizeLabel(headerRow.getCell(c).value);
    if (h === 'barcode' || h === 'barcode_number') {
      barcodeCol = c;
      break;
    }
  }

  const barcodes = [];
  const lastRow = sheet.rowCount || 0;
  for (let r = 2; r <= lastRow; r += 1) {
    const raw = sheet.getRow(r).getCell(barcodeCol).value;
    const barcode = raw == null ? '' : String(raw).trim();
    if (barcode) barcodes.push(barcode);
  }

  return { ok: true, barcodes };
}

async function parseImportWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sessionSheet = workbook.getWorksheet('Sesi');
  const barcodeSheet = workbook.getWorksheet('Barcode');

  const sessionPart = readSessionSheet(sessionSheet);
  if (!sessionPart.ok) return sessionPart;

  const barcodePart = readBarcodeSheet(barcodeSheet);
  if (!barcodePart.ok) return barcodePart;

  if (barcodePart.barcodes.length > MAX_IMPORT_BARCODE_ROWS) {
    return {
      ok: false,
      error: `Terlalu banyak barcode (maks ${MAX_IMPORT_BARCODE_ROWS})`,
      code: 'IMPORT_TOO_MANY_ROWS',
    };
  }

  return {
    ok: true,
    pic: sessionPart.pic,
    shift_number: sessionPart.shift_number,
    barcodes: barcodePart.barcodes,
  };
}

module.exports = {
  MAX_IMPORT_BARCODE_ROWS,
  buildExportFilename,
  buildTemplateFilename,
  buildSessionExportWorkbook,
  buildImportTemplateWorkbook,
  writeWorkbookToBuffer,
  parseImportWorkbook,
  formatDateTimeWib,
};
