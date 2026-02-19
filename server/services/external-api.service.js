const { db } = require('../database');

// Circuit breaker state for External API
const externalApiCircuitBreaker = {
  state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
  failureCount: 0,
  lastFailureTime: null,
  successCount: 0,
  errorStats: {
    '405': 0,
    'other': 0
  }
};

// Circuit breaker configuration
const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 10, // Open circuit after 10 consecutive failures
  resetTimeout: 300000, // 5 minutes in milliseconds
  halfOpenMaxAttempts: 3 // Try 3 times in half-open state
};

// Helper function to get external API URL from config based on status
function getExternalAPIUrl(status, callback) {
  // Determine which config key to use based on status
  const configKey = status === 'active' ? 'external_api_url_active' : 'external_api_url_completed';
  const defaultUrl = process.env.EXTERNAL_API_URL || 'https://foom-dash.vercel.app/API';
  
  db.get('SELECT config_value FROM admin_config WHERE config_key = $1', [configKey], (err, row) => {
    if (err) {
      console.error(`❌ [External API] Error fetching ${configKey} config:`, err);
      // Fallback to general external_api_url if specific one doesn't exist
      return getFallbackUrl(callback, defaultUrl, status);
    }
    
    const apiUrl = row ? row.config_value : null;
    // If specific URL is not set or empty, fallback to general external_api_url
    if (!apiUrl || apiUrl.trim() === '') {
      console.log(`⚠️  [External API] ${configKey} not configured, falling back to external_api_url`);
      return getFallbackUrl(callback, defaultUrl, status);
    } else {
      console.log(`✅ [External API] Using ${configKey}: ${apiUrl}`);
      callback(null, apiUrl);
    }
  });
}

// Helper function to get fallback external API URL
function getFallbackUrl(callback, defaultUrl, status) {
  db.get('SELECT config_value FROM admin_config WHERE config_key = $1', ['external_api_url'], (fallbackErr, fallbackRow) => {
    if (fallbackErr) {
      console.error('❌ [External API] Error fetching fallback external_api_url config:', fallbackErr);
      console.log(`⚠️  [External API] Using default URL for ${status} status: ${defaultUrl}`);
      return callback(null, defaultUrl);
    }
    const fallbackUrl = fallbackRow && fallbackRow.config_value ? fallbackRow.config_value : defaultUrl;
    
    // If using fallback URL, try to construct proper endpoint URL
    let finalUrl = fallbackUrl;
    if (status === 'active') {
      // For active status, we need POST endpoint: /api/receiver/manufacturing
      // If fallback URL doesn't contain /manufacturing, try to add it
      if (!fallbackUrl.includes('/manufacturing')) {
        // Remove query parameters if any
        const baseUrl = fallbackUrl.split('?')[0];
        // Remove /test if present
        const cleanUrl = baseUrl.replace(/\/test.*$/, '');
        finalUrl = `${cleanUrl}/manufacturing`;
        console.log(`⚠️  [External API] Constructed active URL from fallback: ${finalUrl}`);
      }
    } else if (status === 'completed') {
      // For completed status, URL should be the base URL (can contain /manufacturing or not)
      // The mo_number will be added in production.routes.js
      // Don't remove /manufacturing here, let production.routes.js handle it
      const baseUrl = fallbackUrl.split('?')[0];
      const cleanUrl = baseUrl.replace(/\/test.*$/, '').replace(/\/$/, ''); // Remove trailing slash
      finalUrl = cleanUrl;
      console.log(`⚠️  [External API] Constructed completed base URL from fallback: ${finalUrl}`);
    }
    
    console.log(`⚠️  [External API] Using fallback URL for ${status} status: ${finalUrl}`);
    callback(null, finalUrl);
  });
}

// Helper function to check circuit breaker state
function checkCircuitBreaker() {
  const now = Date.now();
  
  // If circuit is OPEN, check if we should move to HALF_OPEN
  if (externalApiCircuitBreaker.state === 'OPEN') {
    if (externalApiCircuitBreaker.lastFailureTime && 
        (now - externalApiCircuitBreaker.lastFailureTime) >= CIRCUIT_BREAKER_CONFIG.resetTimeout) {
      externalApiCircuitBreaker.state = 'HALF_OPEN';
      externalApiCircuitBreaker.successCount = 0;
      return true; // Allow request
    }
    return false; // Block request
  }
  
  // If circuit is HALF_OPEN, allow limited requests
  if (externalApiCircuitBreaker.state === 'HALF_OPEN') {
    return externalApiCircuitBreaker.successCount < CIRCUIT_BREAKER_CONFIG.halfOpenMaxAttempts;
  }
  
  // Circuit is CLOSED, allow all requests
  return true;
}

// Helper function to record success
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

// Helper function to record failure
function recordCircuitBreakerFailure(statusCode) {
  externalApiCircuitBreaker.failureCount++;
  externalApiCircuitBreaker.lastFailureTime = Date.now();
  
  // Track error by status code
  if (statusCode === 405) {
    externalApiCircuitBreaker.errorStats['405']++;
  } else {
    externalApiCircuitBreaker.errorStats['other']++;
  }
  
  // Open circuit if threshold exceeded
  if (externalApiCircuitBreaker.failureCount >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
    externalApiCircuitBreaker.state = 'OPEN';
  } else if (externalApiCircuitBreaker.state === 'HALF_OPEN') {
    // If failure in half-open, go back to open
    externalApiCircuitBreaker.state = 'OPEN';
    externalApiCircuitBreaker.successCount = 0;
  }
}

// Helper function to send data to external API with specific URL and method
async function sendToExternalAPIWithUrl(data, apiUrl, method = 'POST') {
  return new Promise((resolve, reject) => {
    // Skip if URL is empty or not configured
    if (!apiUrl || apiUrl.trim() === '') {
      console.log(`⚠️  [External API] External API URL not configured, skipping send`);
      return resolve({ success: true, skipped: true, message: 'External API URL not configured' });
    }
    
    // Log the request details
    console.log(`\n📤 [External API] ==========================================`);
    console.log(`📤 [External API] Sending ${method} request`);
    console.log(`📤 [External API] URL: ${apiUrl}`);
    console.log(`📤 [External API] Data:`, JSON.stringify(data, null, 2));
    console.log(`📤 [External API] ==========================================\n`);
    
    // Check circuit breaker
    if (!checkCircuitBreaker()) {
      const stats = externalApiCircuitBreaker.errorStats;
      const totalErrors = stats['405'] + stats['other'];
      // Only log once per minute to reduce spam
      if (!externalApiCircuitBreaker.lastLogTime || 
          (Date.now() - externalApiCircuitBreaker.lastLogTime) > 60000) {
        console.log(`⚠️  [External API] Circuit breaker OPEN - skipping requests. ` +
                   `Recent errors: 405 (${stats['405']}), Other (${stats['other']}). ` +
                   `Will retry in ${Math.ceil((CIRCUIT_BREAKER_CONFIG.resetTimeout - (Date.now() - externalApiCircuitBreaker.lastFailureTime)) / 1000)}s`);
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
      
      // Validate method
      const httpMethod = (method && typeof method === 'string') ? method.toUpperCase() : 'POST';
      
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.path,
        method: httpMethod,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestData)
        }
      };
      
      const req = httpModule.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            recordCircuitBreakerSuccess();
            // Only log success if circuit was in half-open state (recovery)
            if (externalApiCircuitBreaker.state === 'HALF_OPEN') {
              console.log(`✅ [External API] Successfully sent data to ${apiUrl} (Circuit recovering)`);
            }
            resolve({ success: true, statusCode: res.statusCode, data: responseData });
          } else {
            recordCircuitBreakerFailure(res.statusCode);
            // Only log non-405 errors or log 405 errors less frequently
            if (res.statusCode !== 405) {
              console.error(`❌ [External API] Error response: ${res.statusCode} - ${responseData.substring(0, 100)}`);
            }
            reject(new Error(`API returned status ${res.statusCode}: ${responseData.substring(0, 100)}`));
          }
        });
      });
      
      req.on('error', (error) => {
        recordCircuitBreakerFailure(0); // 0 for network errors
        console.error(`\n❌ [External API] ==========================================`);
        console.error(`❌ [External API] Request error occurred`);
        console.error(`❌ [External API] URL: ${apiUrl}`);
        console.error(`❌ [External API] Method: ${httpMethod}`);
        console.error(`❌ [External API] Error:`, error.message);
        console.error(`❌ [External API] Error Code:`, error.code);
        console.error(`❌ [External API] Options:`, JSON.stringify(options, null, 2));
        console.error(`❌ [External API] ==========================================\n`);
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
      // Only log errors occasionally
      if (externalApiCircuitBreaker.failureCount % 10 === 0) {
        console.error(`❌ [External API] Error sending data:`, error.message);
      }
      reject(error);
    }
  });
}

// Helper function to send data to external API (determines URL based on status)
async function sendToExternalAPI(data) {
  return new Promise((resolve, reject) => {
    // Determine status from data, default to 'active' if not specified
    const status = data.status || 'active';
    
    getExternalAPIUrl(status, (err, EXTERNAL_API_URL) => {
      if (err) {
        return reject(err);
      }
      
      // Skip if URL is empty or not configured
      if (!EXTERNAL_API_URL || EXTERNAL_API_URL.trim() === '') {
        console.log(`⚠️  [External API] External API URL for status "${status}" not configured, skipping send`);
        return resolve({ success: true, skipped: true, message: `External API URL for status "${status}" not configured` });
      }
      
      // Use the helper function with specific URL
      sendToExternalAPIWithUrl(data, EXTERNAL_API_URL)
        .then(resolve)
        .catch(reject);
    });
  });
}

module.exports = {
  getExternalAPIUrl,
  getFallbackUrl,
  sendToExternalAPI,
  sendToExternalAPIWithUrl,
  checkCircuitBreaker,
  recordCircuitBreakerSuccess,
  recordCircuitBreakerFailure,
  getCircuitBreakerState: () => externalApiCircuitBreaker
};
