const { db } = require('../database');

// Circuit breaker state for External API
const externalApiCircuitBreaker = {
  state: 'CLOSED',
  failureCount: 0,
  lastFailureTime: null,
  successCount: 0,
  errorStats: {
    '405': 0,
    'other': 0
  }
};

const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 10,
  resetTimeout: 300000,
  halfOpenMaxAttempts: 3
};

function normalizeExternalApiBaseUrl(base) {
  if (!base || typeof base !== 'string') return '';
  return base.trim().replace(/\/+$/, '');
}

function buildManufacturingCollectionUrl(baseUrl) {
  const b = normalizeExternalApiBaseUrl(baseUrl);
  if (!b) return '';
  return `${b}/api/v1/manufacturing`;
}

function buildManufacturingItemUrl(baseUrl, externalId) {
  const b = normalizeExternalApiBaseUrl(baseUrl);
  if (!b || !externalId) return '';
  return `${b}/api/v1/manufacturing/${encodeURIComponent(String(externalId))}`;
}

/** PATCH manufacturing status sub-resource (e.g. finished trigger). */
function buildManufacturingItemStatusUrl(baseUrl, externalId) {
  const b = normalizeExternalApiBaseUrl(baseUrl);
  if (!b || !externalId) return '';
  return `${b}/api/v1/manufacturing/${encodeURIComponent(String(externalId))}/status`;
}

/** Parse resource id from POST create response (supports common shapes). */
function parseExternalManufacturingId(responseBodyString) {
  if (!responseBodyString || typeof responseBodyString !== 'string') return null;
  try {
    const json = JSON.parse(responseBodyString);
    if (json && json.id) return String(json.id);
    if (json && json.data && json.data.id) return String(json.data.id);
    if (json && json.data && typeof json.data === 'object' && json.data.manufacturing_id) {
      if (json.data.id) return String(json.data.id);
    }
    return null;
  } catch {
    return null;
  }
}

const EXTERNAL_API_RESPONSE_LOG_DEFAULT_MAX = 8192;
const EXTERNAL_API_RESPONSE_LOG_GET_MAX = 4096;

/**
 * Pretty-print JSON when possible; truncate very long bodies for logs.
 * @param {string} responseData
 * @param {number} [maxLen]
 */
function formatResponseBodyForLog(responseData, maxLen = EXTERNAL_API_RESPONSE_LOG_DEFAULT_MAX) {
  if (responseData == null || responseData === '') return '(empty)';
  const raw = typeof responseData === 'string' ? responseData : String(responseData);
  const trimmed = raw.trim();
  if (trimmed.length > maxLen) {
    return `${trimmed.slice(0, maxLen)}… [truncated, total ${trimmed.length} chars]`;
  }
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return trimmed;
  }
}

/**
 * Log successful outbound HTTP to external manufacturing API (POST/PUT/PATCH/GET).
 * @param {{ method: string, url: string, statusCode: number, body: string, parsedId?: string|null, bodyMaxLen?: number }} opts
 */
function logExternalApiHttpSuccess(opts) {
  const method = (opts.method || 'GET').toUpperCase();
  const maxLen = opts.bodyMaxLen != null ? opts.bodyMaxLen : EXTERNAL_API_RESPONSE_LOG_DEFAULT_MAX;
  console.log(`\n✅ [External API] ==========================================`);
  console.log(`✅ [External API] ${method} succeeded — HTTP ${opts.statusCode}`);
  console.log(`✅ [External API] URL: ${opts.url}`);
  if (opts.parsedId) {
    console.log(`✅ [External API] Parsed external resource id (from POST/PUT body): ${opts.parsedId}`);
  }
  console.log(`✅ [External API] Response body:\n${formatResponseBodyForLog(opts.body, maxLen)}`);
  console.log(`✅ [External API] ==========================================\n`);
}

function getExternalManufacturingConfig(callback) {
  db.get(
    'SELECT config_value FROM admin_config WHERE config_key = $1',
    ['external_api_base_url'],
    (err, row) => {
      const fromDb = row && row.config_value ? String(row.config_value).trim() : '';
      const baseUrl = normalizeExternalApiBaseUrl(fromDb || (process.env.EXTERNAL_API_BASE_URL || '').trim());
      db.get(
        'SELECT config_value FROM admin_config WHERE config_key = $1',
        ['external_api_bearer_token'],
        (err2, row2) => {
          const bearerToken = row2 && row2.config_value ? String(row2.config_value) : (process.env.EXTERNAL_API_BEARER_TOKEN || '');
          callback(err || err2, { baseUrl, bearerToken: bearerToken || '' });
        }
      );
    }
  );
}

/** Legacy URL resolution (pre–base-url config) when external_api_base_url is not set. */
function legacyGetExternalApiUrl(status, callback) {
  const configKey = status === 'active' ? 'external_api_url_active' : 'external_api_url_completed';
  const defaultUrl = process.env.EXTERNAL_API_URL || 'https://foom-dash.vercel.app/API';

  db.get('SELECT config_value FROM admin_config WHERE config_key = $1', [configKey], (err, row) => {
    if (err) {
      console.error(`❌ [External API] Error fetching ${configKey} config:`, err);
      return legacyGetFallbackUrl(callback, defaultUrl, status);
    }

    const apiUrl = row ? row.config_value : null;
    if (!apiUrl || String(apiUrl).trim() === '') {
      console.log(`⚠️  [External API] ${configKey} not configured, falling back to external_api_url`);
      return legacyGetFallbackUrl(callback, defaultUrl, status);
    }
    console.log(`✅ [External API] Using ${configKey}: ${apiUrl}`);
    callback(null, apiUrl);
  });
}

function legacyGetFallbackUrl(callback, defaultUrl, status) {
  db.get('SELECT config_value FROM admin_config WHERE config_key = $1', ['external_api_url'], (fallbackErr, fallbackRow) => {
    if (fallbackErr) {
      console.error('❌ [External API] Error fetching fallback external_api_url config:', fallbackErr);
      console.log(`⚠️  [External API] Using default URL for ${status} status: ${defaultUrl}`);
      return callback(null, defaultUrl);
    }
    const fallbackUrl = fallbackRow && fallbackRow.config_value ? fallbackRow.config_value : defaultUrl;

    let finalUrl = fallbackUrl;
    if (status === 'active') {
      if (!String(fallbackUrl).includes('/manufacturing')) {
        const baseUrl = String(fallbackUrl).split('?')[0];
        const cleanUrl = baseUrl.replace(/\/test.*$/, '');
        finalUrl = `${cleanUrl}/manufacturing`;
        console.log(`⚠️  [External API] Constructed active URL from fallback: ${finalUrl}`);
      }
    } else if (status === 'completed') {
      const baseUrl = String(fallbackUrl).split('?')[0];
      const cleanUrl = baseUrl.replace(/\/test.*$/, '').replace(/\/$/, '');
      finalUrl = cleanUrl;
      console.log(`⚠️  [External API] Constructed completed base URL from fallback: ${finalUrl}`);
    }

    console.log(`⚠️  [External API] Using fallback URL for ${status} status: ${finalUrl}`);
    callback(null, finalUrl);
  });
}

/**
 * Returns full URL for outbound calls.
 * Prefer v1 collection URL when external_api_base_url is set; otherwise legacy per-status URL.
 */
function getExternalAPIUrl(status, callback) {
  getExternalManufacturingConfig((err, cfg) => {
    if (err) {
      return callback(err);
    }
    if (cfg && cfg.baseUrl) {
      const collection = buildManufacturingCollectionUrl(cfg.baseUrl);
      console.log(`✅ [External API] Using v1 manufacturing collection URL: ${collection}`);
      return callback(null, collection);
    }
    legacyGetExternalApiUrl(status, callback);
  });
}

function getFallbackUrl(callback, defaultUrl, status) {
  legacyGetFallbackUrl(callback, defaultUrl, status);
}

function checkCircuitBreaker() {
  const now = Date.now();

  if (externalApiCircuitBreaker.state === 'OPEN') {
    if (
      externalApiCircuitBreaker.lastFailureTime &&
      now - externalApiCircuitBreaker.lastFailureTime >= CIRCUIT_BREAKER_CONFIG.resetTimeout
    ) {
      externalApiCircuitBreaker.state = 'HALF_OPEN';
      externalApiCircuitBreaker.successCount = 0;
      return true;
    }
    return false;
  }

  if (externalApiCircuitBreaker.state === 'HALF_OPEN') {
    return externalApiCircuitBreaker.successCount < CIRCUIT_BREAKER_CONFIG.halfOpenMaxAttempts;
  }

  return true;
}

function recordCircuitBreakerSuccess() {
  if (externalApiCircuitBreaker.state === 'HALF_OPEN') {
    externalApiCircuitBreaker.successCount++;
    if (externalApiCircuitBreaker.successCount >= CIRCUIT_BREAKER_CONFIG.halfOpenMaxAttempts) {
      externalApiCircuitBreaker.state = 'CLOSED';
      externalApiCircuitBreaker.failureCount = 0;
      externalApiCircuitBreaker.errorStats = { '405': 0, 'other': 0 };
    }
  } else if (externalApiCircuitBreaker.state === 'CLOSED') {
    externalApiCircuitBreaker.failureCount = 0;
  }
}

function recordCircuitBreakerFailure(statusCode) {
  externalApiCircuitBreaker.failureCount++;
  externalApiCircuitBreaker.lastFailureTime = Date.now();

  if (statusCode === 405) {
    externalApiCircuitBreaker.errorStats['405']++;
  } else {
    externalApiCircuitBreaker.errorStats['other']++;
  }

  if (externalApiCircuitBreaker.failureCount >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
    externalApiCircuitBreaker.state = 'OPEN';
  } else if (externalApiCircuitBreaker.state === 'HALF_OPEN') {
    externalApiCircuitBreaker.state = 'OPEN';
    externalApiCircuitBreaker.successCount = 0;
  }
}

/**
 * @param {object} data - JSON body
 * @param {string} apiUrl - full URL
 * @param {string} [method='POST']
 * @param {string|null} [bearerToken] - optional Bearer token
 */
async function sendToExternalAPIWithUrl(data, apiUrl, method = 'POST', bearerToken = null) {
  return new Promise((resolve, reject) => {
    if (!apiUrl || String(apiUrl).trim() === '') {
      console.log(`⚠️  [External API] External API URL not configured, skipping send`);
      return resolve({ success: true, skipped: true, message: 'External API URL not configured' });
    }

    console.log(`\n📤 [External API] ==========================================`);
    console.log(`📤 [External API] Sending ${method} request`);
    console.log(`📤 [External API] URL: ${apiUrl}`);
    console.log(`📤 [External API] Data:`, JSON.stringify(data, null, 2));
    console.log(`📤 [External API] ==========================================\n`);

    if (!checkCircuitBreaker()) {
      const stats = externalApiCircuitBreaker.errorStats;
      if (
        !externalApiCircuitBreaker.lastLogTime ||
        Date.now() - externalApiCircuitBreaker.lastLogTime > 60000
      ) {
        console.log(
          `⚠️  [External API] Circuit breaker OPEN - skipping requests. ` +
            `Recent errors: 405 (${stats['405']}), Other (${stats['other']}). ` +
            `Will retry in ${Math.ceil(
              (CIRCUIT_BREAKER_CONFIG.resetTimeout - (Date.now() - externalApiCircuitBreaker.lastFailureTime)) / 1000
            )}s`
        );
        externalApiCircuitBreaker.lastLogTime = Date.now();
      }
      return resolve({
        success: false,
        skipped: true,
        message: 'Circuit breaker is OPEN - too many failures',
        circuitBreakerState: externalApiCircuitBreaker.state
      });
    }

    try {
      const https = require('https');
      const http = require('http');
      const url = require('url');

      const parsedUrl = url.parse(apiUrl);
      const requestData = JSON.stringify(data);
      const isHttps = parsedUrl.protocol === 'https:';
      const httpModule = isHttps ? https : http;
      const httpMethod = method && typeof method === 'string' ? method.toUpperCase() : 'POST';

      const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      };
      if (bearerToken && String(bearerToken).length > 0) {
        headers.Authorization = `Bearer ${bearerToken}`;
      }
      headers['Content-Length'] = Buffer.byteLength(requestData);

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.path,
        method: httpMethod,
        headers
      };

      const req = httpModule.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            recordCircuitBreakerSuccess();
            if (externalApiCircuitBreaker.state === 'HALF_OPEN') {
              console.log(`✅ [External API] Successfully sent data to ${apiUrl} (Circuit recovering)`);
            }
            const parsedId = parseExternalManufacturingId(responseData);
            logExternalApiHttpSuccess({
              method: httpMethod,
              url: apiUrl,
              statusCode: res.statusCode,
              body: responseData,
              parsedId:
                httpMethod === 'POST' || httpMethod === 'PUT' || httpMethod === 'PATCH' ? parsedId : null
            });
            resolve({ success: true, statusCode: res.statusCode, data: responseData, parsedId });
          } else {
            recordCircuitBreakerFailure(res.statusCode);
            if (res.statusCode !== 405) {
              console.error(`❌ [External API] Error response: ${res.statusCode} - ${responseData.substring(0, 100)}`);
            }
            reject(new Error(`API returned status ${res.statusCode}: ${responseData.substring(0, 100)}`));
          }
        });
      });

      req.on('error', (error) => {
        recordCircuitBreakerFailure(0);
        console.error(`❌ [External API] Request error:`, error.message);
        reject(error);
      });

      req.setTimeout(30000, () => {
        req.destroy();
        recordCircuitBreakerFailure(0);
        reject(new Error('Request timeout'));
      });

      req.write(requestData);
      req.end();
    } catch (error) {
      recordCircuitBreakerFailure(0);
      if (externalApiCircuitBreaker.failureCount % 10 === 0) {
        console.error(`❌ [External API] Error sending data:`, error.message);
      }
      reject(error);
    }
  });
}

async function sendToExternalAPI(data) {
  return new Promise((resolve, reject) => {
    const keys = Object.keys(data || {});
    const onlyStatus = keys.length === 1 && keys[0] === 'status';

    getExternalManufacturingConfig((err, cfg) => {
      if (err) {
        return reject(err);
      }
      if (cfg && cfg.baseUrl) {
        if (onlyStatus) {
          console.log(
            `[External API] Skipping legacy sendToExternalAPI (payload is only { status }) — use production liquid routes for v1 API`
          );
          return resolve({ success: true, skipped: true, message: 'Skipped legacy status-only payload' });
        }
        const url = buildManufacturingCollectionUrl(cfg.baseUrl);
        return sendToExternalAPIWithUrl(data, url, 'POST', cfg.bearerToken).then(resolve).catch(reject);
      }

      const status = data.status || 'active';
      getExternalAPIUrl(status, (e2, EXTERNAL_API_URL) => {
        if (e2) {
          return reject(e2);
        }
        if (!EXTERNAL_API_URL || String(EXTERNAL_API_URL).trim() === '') {
          console.log(`⚠️  [External API] URL not configured, skipping send`);
          return resolve({ success: true, skipped: true, message: 'External API URL not configured' });
        }
        sendToExternalAPIWithUrl(data, EXTERNAL_API_URL).then(resolve).catch(reject);
      });
    });
  });
}

/**
 * Find manufacturing row id by MO (manufacturing_id) — GET /api/v1/manufacturing list, or legacy URLs.
 * @param {string} moNumber
 * @param {string} baseUrl - admin base URL (no path) or legacy base including /manufacturing
 * @param {string} [bearerToken]
 */
async function getManufacturingIdentityByMoNumber(moNumber, baseUrl, bearerToken = '') {
  return new Promise((resolve, reject) => {
    if (!baseUrl || String(baseUrl).trim() === '') {
      return reject(new Error('External API base URL not provided'));
    }
    if (!moNumber || String(moNumber).trim() === '') {
      return reject(new Error('MO number not provided'));
    }

    const normalizedRoot = normalizeExternalApiBaseUrl(baseUrl);
    const listUrl = buildManufacturingCollectionUrl(normalizedRoot);

    if (listUrl) {
      return fetchManufacturingListAndFind(moNumber, listUrl, bearerToken)
        .then((found) => {
          if (found && found.id) {
            return resolve({ success: true, id: found.id, data: found });
          }
          console.log(`⚠️  [External API] Not found in v1 list for MO ${moNumber}, trying legacy lookup`);
          return legacyGetManufacturingIdentityByMoNumber(moNumber, baseUrl, bearerToken).then(resolve).catch(reject);
        })
        .catch((e) => {
          console.log(`⚠️  [External API] v1 list GET failed (${e.message}), trying legacy lookup`);
          legacyGetManufacturingIdentityByMoNumber(moNumber, baseUrl, bearerToken).then(resolve).catch(reject);
        });
    }

    legacyGetManufacturingIdentityByMoNumber(moNumber, baseUrl, bearerToken).then(resolve).catch(reject);
  });
}

function fetchManufacturingListAndFind(moNumber, fullListUrl, bearerToken) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const http = require('http');
    const url = require('url');
    const parsedUrl = url.parse(fullListUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const headers = { Accept: 'application/json' };
    if (bearerToken && String(bearerToken).length > 0) {
      headers.Authorization = `Bearer ${bearerToken}`;
    }

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.path,
      method: 'GET',
      headers
    };

    const req = httpModule.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`List GET ${res.statusCode}`));
        }
        logExternalApiHttpSuccess({
          method: 'GET',
          url: fullListUrl,
          statusCode: res.statusCode,
          body: responseData,
          bodyMaxLen: EXTERNAL_API_RESPONSE_LOG_GET_MAX
        });
        try {
          const response = JSON.parse(responseData);
          let rows = [];
          if (Array.isArray(response)) rows = response;
          else if (response.data && Array.isArray(response.data)) rows = response.data;
          const hit = rows.find(
            (item) =>
              item &&
              (item.manufacturing_id === moNumber || String(item.manufacturing_id) === String(moNumber))
          );
          if (hit && hit.id) {
            console.log(`✅ [External API] Found id from v1 list for MO ${moNumber}: ${hit.id}`);
            resolve({ ...hit, id: String(hit.id) });
          } else {
            resolve(null);
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

function legacyGetManufacturingIdentityByMoNumber(moNumber, baseUrl, bearerToken) {
  return new Promise((resolve, reject) => {
    try {
      const https = require('https');
      const http = require('http');
      const url = require('url');

      const trimmedUrl = String(baseUrl).trim().replace(/\/$/, '');
      const encodedMoNumber = encodeURIComponent(moNumber);
      let getUrl;
      if (trimmedUrl.toLowerCase().endsWith('/manufacturing')) {
        getUrl = `${trimmedUrl}?manufacturing_id=${encodedMoNumber}`;
      } else {
        getUrl = `${trimmedUrl}/manufacturing?manufacturing_id=${encodedMoNumber}`;
      }

      const parsedUrl = url.parse(getUrl);
      const isHttps = parsedUrl.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      const headers = { Accept: 'application/json' };
      if (bearerToken && String(bearerToken).length > 0) {
        headers.Authorization = `Bearer ${bearerToken}`;
      }

      console.log(`📥 [External API] Legacy GET: ${getUrl}`);

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.path,
        method: 'GET',
        headers
      };

      const req = httpModule.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            logExternalApiHttpSuccess({
              method: 'GET',
              url: getUrl,
              statusCode: res.statusCode,
              body: responseData,
              bodyMaxLen: EXTERNAL_API_RESPONSE_LOG_GET_MAX
            });
            try {
              const response = JSON.parse(responseData);
              let manufacturingIdentity = null;
              if (Array.isArray(response)) {
                manufacturingIdentity = response.find(
                  (item) =>
                    item.manufacturing_id === moNumber || (item.id && item.manufacturing_id === moNumber)
                );
              } else if (response.data && Array.isArray(response.data)) {
                manufacturingIdentity = response.data.find(
                  (item) =>
                    item.manufacturing_id === moNumber || (item.id && item.manufacturing_id === moNumber)
                );
              } else if (response.manufacturing_id === moNumber || response.id) {
                manufacturingIdentity = response;
              }
              if (manufacturingIdentity && manufacturingIdentity.id) {
                return resolve({ success: true, id: manufacturingIdentity.id, data: manufacturingIdentity });
              }
              tryGetById(moNumber, trimmedUrl, bearerToken, resolve);
            } catch (parseErr) {
              tryGetById(moNumber, trimmedUrl, bearerToken, resolve);
            }
          } else {
            tryGetById(moNumber, trimmedUrl, bearerToken, resolve);
          }
        });
      });

      req.on('error', () => tryGetById(moNumber, trimmedUrl, bearerToken, resolve));
      req.setTimeout(10000, () => {
        req.destroy();
        tryGetById(moNumber, trimmedUrl, bearerToken, resolve);
      });
      req.end();
    } catch (error) {
      reject(error);
    }
  });
}

function tryGetById(moNumber, baseUrl, bearerToken, resolve) {
  try {
    const https = require('https');
    const http = require('http');
    const url = require('url');

    const encodedMoNumber = encodeURIComponent(moNumber);
    let getUrl;
    if (baseUrl.toLowerCase().endsWith('/manufacturing')) {
      getUrl = `${baseUrl}/${encodedMoNumber}`;
    } else {
      getUrl = `${baseUrl}/manufacturing/${encodedMoNumber}`;
    }

    const parsedUrl = url.parse(getUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const headers = { Accept: 'application/json' };
    if (bearerToken && String(bearerToken).length > 0) {
      headers.Authorization = `Bearer ${bearerToken}`;
    }

    console.log(`📥 [External API] Trying alternative GET: ${getUrl}`);

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.path,
      method: 'GET',
      headers
    };

    const req = httpModule.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          logExternalApiHttpSuccess({
            method: 'GET',
            url: getUrl,
            statusCode: res.statusCode,
            body: responseData,
            bodyMaxLen: EXTERNAL_API_RESPONSE_LOG_GET_MAX
          });
          try {
            const response = JSON.parse(responseData);
            let manufacturingIdentity = null;
            if (response.manufacturing_id === moNumber || response.id) {
              manufacturingIdentity = response;
            } else if (response.data && (response.data.manufacturing_id === moNumber || response.data.id)) {
              manufacturingIdentity = response.data;
            }
            if (manufacturingIdentity && manufacturingIdentity.id) {
              return resolve({ success: true, id: manufacturingIdentity.id, data: manufacturingIdentity });
            }
          } catch {
            /* fall through */
          }
        }
        resolve({ success: false, id: null, message: 'Manufacturing Identity not found' });
      });
    });

    req.on('error', () => resolve({ success: false, id: null, message: 'Manufacturing Identity not found' }));
    req.setTimeout(10000, () => {
      req.destroy();
      resolve({ success: false, id: null, message: 'Request timeout' });
    });
    req.end();
  } catch {
    resolve({ success: false, id: null, message: 'Manufacturing Identity not found' });
  }
}

module.exports = {
  normalizeExternalApiBaseUrl,
  buildManufacturingCollectionUrl,
  buildManufacturingItemUrl,
  buildManufacturingItemStatusUrl,
  parseExternalManufacturingId,
  getExternalManufacturingConfig,
  getExternalAPIUrl,
  getFallbackUrl,
  sendToExternalAPI,
  sendToExternalAPIWithUrl,
  getManufacturingIdentityByMoNumber,
  checkCircuitBreaker,
  recordCircuitBreakerSuccess,
  recordCircuitBreakerFailure,
  getCircuitBreakerState: () => externalApiCircuitBreaker
};
