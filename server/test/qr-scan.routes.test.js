const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { randomUUID } = require('crypto');

process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-ci-only';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test-admin-pass';
process.env.PRODUCTION_PASSWORD = process.env.PRODUCTION_PASSWORD || 'test-prod-pass';

function apiRequest(server, method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const { port } = server.address();
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => {
          data += c;
        });
        res.on('end', () => {
          let parsed = {};
          try {
            parsed = data ? JSON.parse(data) : {};
          } catch {
            parsed = { raw: data };
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function probeDatabase() {
  try {
    const { pool } = require('../database');
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      return { ok: true, pool, client };
    } catch (e) {
      client.release();
      return { ok: false, error: e };
    }
  } catch (e) {
    return { ok: false, error: e };
  }
}

describe('qr-scan API integration', () => {
  let dbOk = false;
  let pool;
  let probeClient;
  let server;
  let token;
  let testPicName;
  let digitCount;
  before(async () => {
    const probe = await probeDatabase();
    if (!probe.ok) {
      dbOk = false;
      return;
    }
    dbOk = true;
    pool = probe.pool;
    probeClient = probe.client;

    const tableCheck = await probeClient.query(
      `SELECT to_regclass('public.qr_scan_session') AS reg`
    );
    if (!tableCheck.rows[0]?.reg) {
      const migration = require('../migrations/003_qr_scan_sessions');
      await migration.up(probeClient);
    }

    testPicName = `QRScanTestPIC_${Date.now()}`;
    await probeClient.query(
      `INSERT INTO pic_list (name, is_active) VALUES ($1, 1)
       ON CONFLICT (name) DO UPDATE SET is_active = 1`,
      [testPicName]
    );

    const vendorRes = await probeClient.query(
      'SELECT digit_count FROM authenticity_vendor WHERE is_active = 1 LIMIT 1'
    );
    if (vendorRes.rowCount > 0) {
      digitCount = vendorRes.rows[0].digit_count;
    } else {
      digitCount = 13;
      await probeClient.query(
        `INSERT INTO authenticity_vendor (name, digit_count, is_active)
         VALUES ($1, $2, 1)`,
        [`QRScanTestVendor_${Date.now()}`, digitCount]
      );
    }

    const { signToken } = require('../middleware/auth.middleware');
    token = signToken({ sub: 'production', role: 'production' });

    delete require.cache[require.resolve('../app')];
    const app = require('../app');
    server = app.listen(0);
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (probeClient) {
      probeClient.release();
    }
    delete require.cache[require.resolve('../app')];
  });

  function makeBarcode(suffix) {
    const base = String(suffix).replace(/\D/g, '') || '1';
    let s = base;
    while (s.length < digitCount) s += '7';
    return s.slice(0, digitCount);
  }

  it('POST session with valid PIC', async (t) => {
    if (!dbOk) {
      t.skip('PostgreSQL not available');
      return;
    }
    const res = await apiRequest(server, 'POST', '/api/qr-scan/sessions', { pic: testPicName }, token);
    assert.equal(res.status, 201);
    assert.ok(res.body.session_number >= 1);
    assert.equal(res.body.status, 'ongoing');
  });

  it('POST session rejects unknown PIC', async (t) => {
    if (!dbOk) {
      t.skip('PostgreSQL not available');
      return;
    }
    const res = await apiRequest(
      server,
      'POST',
      '/api/qr-scan/sessions',
      { pic: '___nonexistent_pic___' },
      token
    );
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'PIC_NOT_FOUND');
  });

  it('scan, duplicate, global duplicate, idempotent client_scan_id, finish lock', async (t) => {
    if (!dbOk) {
      t.skip('PostgreSQL not available');
      return;
    }

    const create1 = await apiRequest(
      server,
      'POST',
      '/api/qr-scan/sessions',
      { pic: testPicName },
      token
    );
    const sn1 = create1.body.session_number;
    const barcode = makeBarcode(String(sn1) + Date.now());

    const scan1 = await apiRequest(
      server,
      'POST',
      `/api/qr-scan/sessions/${sn1}/scans`,
      { barcode },
      token
    );
    assert.equal(scan1.status, 201);
    assert.equal(scan1.body.qty, 1);

    const scanDup = await apiRequest(
      server,
      'POST',
      `/api/qr-scan/sessions/${sn1}/scans`,
      { barcode },
      token
    );
    assert.equal(scanDup.status, 409);
    assert.equal(scanDup.body.code, 'BARCODE_ALREADY_USED');

    const create2 = await apiRequest(
      server,
      'POST',
      '/api/qr-scan/sessions',
      { pic: testPicName },
      token
    );
    const sn2 = create2.body.session_number;
    const scanOther = await apiRequest(
      server,
      'POST',
      `/api/qr-scan/sessions/${sn2}/scans`,
      { barcode },
      token
    );
    assert.equal(scanOther.status, 409);
    assert.equal(scanOther.body.code, 'BARCODE_ALREADY_USED');

    const clientScanId = randomUUID();
    const idem1 = await apiRequest(
      server,
      'POST',
      `/api/qr-scan/sessions/${sn1}/scans`,
      { barcode: makeBarcode('99' + Date.now()), client_scan_id: clientScanId },
      token
    );
    assert.equal(idem1.status, 201);
    const idem2 = await apiRequest(
      server,
      'POST',
      `/api/qr-scan/sessions/${sn1}/scans`,
      {
        barcode: makeBarcode('88' + Date.now()),
        client_scan_id: clientScanId,
      },
      token
    );
    assert.equal(idem2.status, 200);
    assert.equal(idem2.body.idempotent, true);
    assert.equal(idem2.body.qty, 2);

    await apiRequest(server, 'PATCH', `/api/qr-scan/sessions/${sn1}/finish`, null, token);
    const afterFinish = await apiRequest(
      server,
      'POST',
      `/api/qr-scan/sessions/${sn1}/scans`,
      { barcode: makeBarcode('77' + Date.now()) },
      token
    );
    assert.equal(afterFinish.status, 403);
    assert.equal(afterFinish.body.code, 'SESSION_FINISHED');
  });
});
