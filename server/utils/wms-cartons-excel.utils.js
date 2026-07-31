const ExcelJS = require('exceljs');

const CARTON_COLUMNS = [
  { key: 'mo_number', header: 'MO Number', width: 18 },
  { key: 'barcode', header: 'Carton Barcode', width: 22 },
  { key: 'stock_transfer_order_id', header: 'SFP', width: 14 },
  { key: 'sku', header: 'SKU', width: 14 },
  { key: 'description', header: 'Description', width: 28 },
  { key: 'created_time', header: 'Created Time', width: 18 },
  { key: 'production_date', header: 'Production Date', width: 18 },
  { key: 'expired_date', header: 'Expired Date', width: 18 },
  { key: 'counting', header: 'Counting', width: 10 },
  { key: 'total_carton', header: 'Total Carton', width: 12 },
  { key: 'qty', header: 'Qty', width: 8 },
  { key: 'uom', header: 'UOM', width: 8 },
  { key: 'status', header: 'Status', width: 10 },
  { key: 'team_name', header: 'Team', width: 14 },
  { key: 'sloc', header: 'SLOC', width: 10 },
  { key: 'line', header: 'Line', width: 10 },
  { key: 'carton_label', header: 'Carton Label', width: 18 },
  { key: 'synced_at', header: 'Synced At', width: 18 }
];

const QR_COLUMNS = [
  { key: 'mo_number', header: 'MO Number', width: 18 },
  { key: 'carton_barcode', header: 'Carton Barcode', width: 22 },
  { key: 'stock_transfer_order_id', header: 'SFP', width: 14 },
  { key: 'qr_barcode', header: 'QR Barcode', width: 24 },
  { key: 'qty', header: 'Qty', width: 8 }
];

function formatDateTime(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'Asia/Jakarta'
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function formatStatus(status) {
  if (status === 1) return 'Active';
  if (status == null) return '';
  return String(status);
}

function sanitizeMoForFilename(moNumber) {
  return String(moNumber || 'unknown')
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'unknown';
}

function buildCartonsExportFilename(moNumber) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(now);

  const get = (type) => parts.find((p) => p.type === type)?.value || '00';
  const moPart = sanitizeMoForFilename(moNumber);
  return `wms-cartons-${moPart}-${get('day')}${get('month')}${get('year')}-${get('hour')}${get('minute')}.xlsx`;
}

function styleHeaderRow(sheet) {
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle' };
}

function addSheetWithColumns(workbook, sheetName, columns) {
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width
  }));
  styleHeaderRow(sheet);
  return sheet;
}

function mapCartonRow(carton, moNumber) {
  return {
    mo_number: moNumber,
    barcode: carton.barcode || '',
    stock_transfer_order_id: carton.stock_transfer_order_id || '',
    sku: carton.sku || '',
    description: carton.description || '',
    created_time: formatDateTime(carton.created_time),
    production_date: formatDateTime(carton.production_date),
    expired_date: formatDateTime(carton.expired_date),
    counting: carton.counting ?? '',
    total_carton: carton.total_carton ?? '',
    qty: carton.qty ?? '',
    uom: carton.uom || '',
    status: formatStatus(carton.status),
    team_name: carton.team_name || '',
    sloc: carton.sloc || '',
    line: carton.line || '',
    carton_label: carton.carton_label || '',
    synced_at: formatDateTime(carton.synced_at)
  };
}

function buildWmsCartonsWorkbook({ moNumber, cartons }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Manufacturing Process Production Authenticity';
  workbook.created = new Date();

  const cartonsSheet = addSheetWithColumns(workbook, 'Cartons', CARTON_COLUMNS);
  const qrSheet = addSheetWithColumns(workbook, 'QR Barcodes', QR_COLUMNS);

  for (const carton of cartons) {
    cartonsSheet.addRow(mapCartonRow(carton, moNumber));

    const qrList = carton.qr_list || [];
    for (const qr of qrList) {
      qrSheet.addRow({
        mo_number: moNumber,
        carton_barcode: carton.barcode || '',
        stock_transfer_order_id: carton.stock_transfer_order_id || '',
        qr_barcode: qr.barcode || '',
        qty: qr.qty ?? 1
      });
    }
  }

  return workbook;
}

async function writeWorkbookToBuffer(workbook) {
  return workbook.xlsx.writeBuffer();
}

module.exports = {
  buildCartonsExportFilename,
  buildWmsCartonsWorkbook,
  writeWorkbookToBuffer
};
