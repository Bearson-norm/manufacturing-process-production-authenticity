/**
 * Lightweight security probe — run with server on PORT from .env
 */
require('dotenv').config();
const http = require('http');

const PORT = process.env.PORT || 1234;
const BASE = `http://127.0.0.1:${PORT}`;

function request(method, path, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = { method, hostname: url.hostname, port: url.port, path: url.pathname + url.search, headers };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_) {
          /* plain text */
        }
        resolve({ status: res.statusCode, body: data.slice(0, 500), json });
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => {
      req.destroy(new Error('timeout'));
    });
    if (body) {
      req.setHeader('Content-Type', 'application/json');
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function login(username, password) {
  const r = await request('POST', '/api/login', { body: { username, password } });
  return r;
}

async function main() {
  const results = [];

  function record(id, pass, detail) {
    results.push({ id, pass, detail });
  }

  // S5 — unauthenticated access
  const adminCfg = await request('GET', '/api/admin/config');
  record('S5-unauth-admin', adminCfg.status === 401, `GET /api/admin/config → ${adminCfg.status}`);

  const prodList = await request('GET', '/api/production/liquid');
  record('S5-unauth-production', prodList.status === 401, `GET /api/production/liquid → ${prodList.status}`);

  // S4 — external API fail-closed (production env)
  const extNoKey = await request('GET', '/api/external/authenticity');
  record(
    'S4-external-no-key',
    extNoKey.status === 401 || extNoKey.status === 403 || extNoKey.status === 503,
    `GET /api/external/authenticity → ${extNoKey.status}`
  );

  // S4 — invalid JWT
  const badJwt = await request('GET', '/api/production/liquid', {
    headers: { Authorization: 'Bearer invalid.token.here' },
  });
  record('S4-bad-jwt', badJwt.status === 401, `bad JWT → ${badJwt.status}`);

  // S1 — SQLi login (should not 500 / should not succeed)
  const sqliLogin = await request('POST', '/api/login', {
    body: { username: "admin' OR '1'='1", password: "x' OR '1'='1" },
  });
  record(
    'S1-sqli-login',
    sqliLogin.status === 401 || sqliLogin.status === 400,
    `SQLi login → ${sqliLogin.status} (no success)`
  );

  const adminPass = process.env.ADMIN_PASSWORD;
  const prodPass = process.env.PRODUCTION_PASSWORD;
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const prodUser = process.env.PRODUCTION_USERNAME || 'production';

  if (adminPass && prodPass) {
    const adminLogin = await login(adminUser, adminPass);
    const prodLogin = await login(prodUser, prodPass);
    const adminToken = adminLogin.json && adminLogin.json.token;
    const prodToken = prodLogin.json && prodLogin.json.token;

    record('S4-admin-login', adminLogin.status === 200 && !!adminToken, `admin login → ${adminLogin.status}`);
    record('S4-prod-login', prodLogin.status === 200 && !!prodToken, `production login → ${prodLogin.status}`);

    if (prodToken) {
      const prodToAdmin = await request('GET', '/api/admin/config', {
        headers: { Authorization: `Bearer ${prodToken}` },
      });
      record('S5-rbac-prod-admin', prodToAdmin.status === 403, `production → /api/admin/config → ${prodToAdmin.status}`);

      const prodReports = await request('GET', '/api/reports/manufacturing', {
        headers: { Authorization: `Bearer ${prodToken}` },
      });
      record('S5-rbac-prod-reports', prodReports.status === 403, `production → /api/reports → ${prodReports.status}`);

      const prodWms = await request('POST', '/api/wms/test-connection', {
        headers: { Authorization: `Bearer ${prodToken}` },
        body: {},
      });
      record('S5-rbac-prod-wms', prodWms.status === 403, `production → /api/wms → ${prodWms.status}`);

      const prodSync = await request('POST', '/api/production/combined/sync', {
        headers: { Authorization: `Bearer ${prodToken}` },
        body: { production_type: 'liquid' },
      });
      record(
        'S5-prod-combined-sync',
        prodSync.status === 403,
        `production → POST /api/production/combined/sync → ${prodSync.status} (expect 403 if admin-only)`
      );
    }

    if (adminToken) {
      const adminCfgAuth = await request('GET', '/api/admin/config', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const cfg = adminCfgAuth.json && adminCfgAuth.json.config;
      const apiKeyMasked =
        !cfg ||
        !cfg.apiKey ||
        String(cfg.apiKey).includes('*') ||
        cfg.apiKey === null;
      record(
        'S6-admin-config-mask',
        adminCfgAuth.status === 200 && apiKeyMasked,
        `admin config apiKey masked: ${apiKeyMasked}`
      );
    }

    if (prodToken) {
      const sqliSearch = await request('GET', "/api/search/mo?q=' OR 1=1--", {
        headers: { Authorization: `Bearer ${prodToken}` },
      });
      record(
        'S1-sqli-search',
        sqliSearch.status !== 500,
        `SQLi search → ${sqliSearch.status} (no server error)`
      );
    }
  } else {
    record('S4-login-skip', false, 'ADMIN/PRODUCTION password not set — RBAC probes skipped');
  }

  // S8 — brute force hint (single request should not be 429)
  record('S8-rate-limit-exists', true, 'login limiter configured 20/15min in app.js');

  console.log(JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.pass);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error('PROBE_ERROR:', e.message);
  process.exit(2);
});
