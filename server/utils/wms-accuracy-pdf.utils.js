const PDFDocument = require('pdfkit');

const PAGE_MARGIN = 40;
const ROW_HEIGHT = 16;
const HEADER_HEIGHT = 18;

const MO_SUMMARY_COLUMNS = [
  { key: 'mo_number', label: 'MO Number', width: 90 },
  { key: 'sku_name', label: 'SKU', width: 70 },
  { key: 'last_completed_at', label: 'Selesai terakhir', width: 70, format: formatDateTime },
  { key: 'session_count', label: 'Session', width: 35 },
  { key: 'wms_carton_count', label: 'Carton', width: 35 },
  { key: 'total_wms_qty', label: 'Qty WMS', width: 40 },
  { key: 'error_rate_percent', label: 'Error %', width: 40, format: formatPercent },
  {
    key: 'failed_qr',
    label: 'QR Gagal/Total',
    width: 55,
    format: (_, row) => `${row.failed_qr ?? 0}/${row.total_qr ?? 0}`
  },
  { key: 'failed_qty', label: 'Qty Gagal', width: 40 }
];

const REJECTED_UNIT_COLUMNS = [
  { key: 'mo_number', label: 'MO Number', width: 80 },
  { key: 'carton_barcode', label: 'Carton Barcode', width: 80 },
  { key: 'stock_transfer_order_id', label: 'SFP', width: 50 },
  {
    key: 'counting',
    label: 'Count/Total',
    width: 50,
    format: (_, row) => `${row.counting ?? '—'}/${row.total_carton ?? '—'}`
  },
  { key: 'qr_barcode', label: 'QR Barcode', width: 90 },
  { key: 'qty', label: 'Qty', width: 30 },
  { key: 'reason', label: 'Alasan', width: 70, format: formatRejectReason }
];

function formatPercent(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })}%`;
}

function formatDateTime(value) {
  if (!value) return '—';
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

function formatFilterDate(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'short',
      timeZone: 'Asia/Jakarta'
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function formatRejectReason(reason) {
  switch (reason) {
    case 'invalid_barcode':
      return 'Barcode invalid';
    case 'no_production_ranges':
      return 'Tidak ada range production';
    default:
      return 'Di luar range';
  }
}

function truncateText(text, maxLen) {
  const str = String(text ?? '');
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen - 1)}…`;
}

function ensureSpace(doc, neededHeight) {
  const bottom = doc.page.height - PAGE_MARGIN;
  if (doc.y + neededHeight > bottom) {
    doc.addPage();
    doc.y = PAGE_MARGIN;
  }
}

function drawSectionTitle(doc, title) {
  ensureSpace(doc, 28);
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827').text(title);
  doc.moveDown(0.3);
}

function drawKeyValueLines(doc, lines) {
  doc.font('Helvetica').fontSize(10).fillColor('#374151');
  for (const [label, value] of lines) {
    ensureSpace(doc, 14);
    doc.text(`${label}: ${value}`);
  }
  doc.moveDown(0.3);
}

function createStreamingTable(doc, columns) {
  const tableWidth = doc.page.width - PAGE_MARGIN * 2;
  const colWidths = columns.map((col) => col.width);
  const widthScale = tableWidth / colWidths.reduce((sum, w) => sum + w, 0);
  const scaledWidths = colWidths.map((w) => w * widthScale);
  let rowIndex = 0;
  let headerDrawn = false;

  const drawHeader = () => {
    ensureSpace(doc, HEADER_HEIGHT + 4);
    let x = PAGE_MARGIN;
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
    doc.rect(PAGE_MARGIN, y, tableWidth, HEADER_HEIGHT).fill('#374151');
    columns.forEach((col, i) => {
      doc.fillColor('#ffffff').text(col.label, x + 3, y + 4, {
        width: scaledWidths[i] - 6,
        lineBreak: false,
        ellipsis: true
      });
      x += scaledWidths[i];
    });
    doc.y = y + HEADER_HEIGHT;
    headerDrawn = true;
  };

  return {
    writeRow(row) {
      ensureSpace(doc, ROW_HEIGHT + 4);
      if (!headerDrawn || doc.y <= PAGE_MARGIN + 5) {
        drawHeader();
      }

      let x = PAGE_MARGIN;
      const y = doc.y;
      const bg = rowIndex % 2 === 0 ? '#f9fafb' : '#ffffff';
      doc.rect(PAGE_MARGIN, y, tableWidth, ROW_HEIGHT).fill(bg);

      doc.font('Helvetica').fontSize(7.5).fillColor('#111827');
      columns.forEach((col, i) => {
        const raw = row[col.key];
        const text = col.format ? col.format(raw, row) : String(raw ?? '—');
        doc.fillColor('#111827').text(truncateText(text, 80), x + 3, y + 4, {
          width: scaledWidths[i] - 6,
          lineBreak: false,
          ellipsis: true
        });
        x += scaledWidths[i];
      });
      doc.y = y + ROW_HEIGHT;
      rowIndex += 1;
    },
    finish() {
      if (!headerDrawn) {
        doc.font('Helvetica').fontSize(10).fillColor('#6b7280').text('Tidak ada data.');
      }
      doc.moveDown(0.5);
    },
    get rowCount() {
      return rowIndex;
    }
  };
}

/**
 * Create a streaming PDF writer for the WMS accuracy summary export.
 * Order: header → MO summary table → reject detail table → overall aggregate at end.
 */
function createWmsAccuracySummaryPdfStream(filters) {
  const doc = new PDFDocument({ margin: PAGE_MARGIN, size: 'A4', layout: 'landscape' });

  const generatedAt = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta'
  }).format(new Date());

  doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827')
    .text('Laporan Summary Keakuratan QR vs Production', { align: 'center' });
  doc.moveDown(0.5);

  drawKeyValueLines(doc, [
    ['Filter selesai dari', formatFilterDate(filters.dateFrom)],
    ['Filter selesai sampai', formatFilterDate(filters.dateTo)],
    ['Cari MO', filters.search || '—'],
    ['Dibuat pada', generatedAt]
  ]);

  drawSectionTitle(doc, 'Ringkasan per MO (hanya MO dengan QR gagal)');
  const moTable = createStreamingTable(doc, MO_SUMMARY_COLUMNS);

  let rejectTable = null;
  let moTableFinished = false;

  const finishMoTable = () => {
    if (moTableFinished) return;
    moTable.finish();
    moTableFinished = true;
  };

  return {
    doc,
    writeMoSummaryRow(row) {
      moTable.writeRow(row);
    },
    writeRejectedUnitRows(rejectedUnits) {
      if (!rejectedUnits || rejectedUnits.length === 0) return;

      if (!rejectTable) {
        finishMoTable();
        drawSectionTitle(doc, 'Detail Unit Reject');
        rejectTable = createStreamingTable(doc, REJECTED_UNIT_COLUMNS);
      }

      for (const unit of rejectedUnits) {
        rejectTable.writeRow(unit);
      }
    },
    writeOverallSummary(overall) {
      finishMoTable();
      if (rejectTable) {
        rejectTable.finish();
      } else {
        drawSectionTitle(doc, 'Detail Unit Reject');
        doc.font('Helvetica').fontSize(10).fillColor('#6b7280').text('Tidak ada data.');
        doc.moveDown(0.5);
      }

      drawSectionTitle(doc, 'Ringkasan Agregat (seluruh filter)');
      drawKeyValueLines(doc, [
        ['Total MO', String(overall.mo_count ?? 0)],
        ['MO dengan WMS', String(overall.with_wms ?? 0)],
        ['Total QR', String(overall.total_qr ?? 0)],
        ['QR Gagal', String(overall.failed_qr ?? 0)],
        ['Error Rate QR', formatPercent(overall.avg_error_rate_percent)],
        ['Total Qty WMS', String(overall.total_wms_qty ?? 0)],
        ['Qty Gagal', String(overall.failed_qty ?? 0)],
        ['Error Rate Qty', formatPercent(overall.qty_error_rate_percent)]
      ]);
    },
    end() {
      doc.end();
    }
  };
}

function buildExportFilename() {
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
  return `wms-accuracy-summary-${get('year')}${get('month')}${get('day')}-${get('hour')}${get('minute')}.pdf`;
}

module.exports = {
  createWmsAccuracySummaryPdfStream,
  buildExportFilename,
  formatRejectReason
};
