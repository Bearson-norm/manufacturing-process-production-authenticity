const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db, pool } = require('../database');

// Helper function to get admin config
function getAdminConfig(callback) {
  db.get('SELECT config_value FROM admin_config WHERE config_key = $1', ['odoo_session_id'], (err, row) => {
    if (err) {
      return callback(err, null);
    }
    
    const sessionId = row ? row.config_value : process.env.ODOO_SESSION_ID || 'bc6b1450c0cd3b05e3ac199521e02f7b639e39ae';
    
    db.get('SELECT config_value FROM admin_config WHERE config_key = $1', ['odoo_base_url'], (err2, row2) => {
      if (err2) {
        return callback(err2, null);
      }
      
      const odooBaseUrl = row2 ? row2.config_value : process.env.ODOO_API_URL || 'https://foomx.odoo.com';
      
      callback(null, { sessionId, odooBaseUrl });
    });
  });
}

// GET /api/admin/config
router.get('/config', (req, res) => {
  try {
    if (!db) {
      return res.json({
        success: true,
        config: {
          sessionId: process.env.ODOO_SESSION_ID || 'bc6b1450c0cd3b05e3ac199521e02f7b639e39ae',
          odooBaseUrl: process.env.ODOO_API_URL || 'https://foomx.odoo.com',
          externalApiBaseUrl: process.env.EXTERNAL_API_BASE_URL || '',
          externalApiBearerToken: null,
          externalApiBearerTokenConfigured: !!process.env.EXTERNAL_API_BEARER_TOKEN
        }
      });
    }

    db.get("SELECT table_name as name FROM information_schema.tables WHERE table_schema='public' AND table_name='admin_config'", (tableErr, tableRow) => {
      if (tableErr || !tableRow) {
        return res.json({
          success: true,
          config: {
            sessionId: process.env.ODOO_SESSION_ID || 'bc6b1450c0cd3b05e3ac199521e02f7b639e39ae',
            odooBaseUrl: process.env.ODOO_API_URL || 'https://foomx.odoo.com',
            externalApiBaseUrl: process.env.EXTERNAL_API_BASE_URL || '',
            externalApiBearerToken: null,
            externalApiBearerTokenConfigured: !!process.env.EXTERNAL_API_BEARER_TOKEN
          }
        });
      }

      db.get('SELECT config_value FROM admin_config WHERE config_key = $1', ['odoo_session_id'], (err, row) => {
        const sessionId = row ? row.config_value : process.env.ODOO_SESSION_ID || 'bc6b1450c0cd3b05e3ac199521e02f7b639e39ae';
        
          db.get('SELECT config_value FROM admin_config WHERE config_key = $1', ['odoo_base_url'], (err2, row2) => {
          const odooBaseUrl = row2 ? row2.config_value : process.env.ODOO_API_URL || 'https://foomx.odoo.com';

          db.get('SELECT config_value FROM admin_config WHERE config_key = $1', ['external_api_base_url'], (ebErr, ebRow) => {
            const externalApiBaseUrl =
              ebRow && ebRow.config_value ? String(ebRow.config_value).trim() : (process.env.EXTERNAL_API_BASE_URL || '').trim();

            db.get('SELECT config_value FROM admin_config WHERE config_key = $1', ['external_api_bearer_token'], (btErr, btRow) => {
              const bearerRaw =
                btRow && btRow.config_value ? String(btRow.config_value) : process.env.EXTERNAL_API_BEARER_TOKEN || '';
              let maskedBearer = null;
              if (bearerRaw && bearerRaw.length > 8) {
                maskedBearer = bearerRaw.substring(0, bearerRaw.length - 8) + '********';
              } else if (bearerRaw) {
                maskedBearer = '********';
              }

              db.get('SELECT config_value FROM admin_config WHERE config_key = $1', ['external_api_url_active'], (err3, row3) => {
                const externalApiUrlActive = row3
                  ? row3.config_value
                  : process.env.EXTERNAL_API_URL_ACTIVE || process.env.EXTERNAL_API_URL || 'https://foom-dash.vercel.app/API';

                db.get('SELECT config_value FROM admin_config WHERE config_key = $1', ['external_api_url_completed'], (err4, row4) => {
                  const externalApiUrlCompleted = row4
                    ? row4.config_value
                    : process.env.EXTERNAL_API_URL_COMPLETED || process.env.EXTERNAL_API_URL || 'https://foom-dash.vercel.app/API';

                  db.get('SELECT config_value FROM admin_config WHERE config_key = $1', ['external_api_url'], (err5, row5) => {
                    const externalApiUrl = row5
                      ? row5.config_value
                      : process.env.EXTERNAL_API_URL || 'https://foom-dash.vercel.app/API';

                    db.get('SELECT config_value FROM admin_config WHERE config_key = $1', ['api_key'], (err6, row6) => {
                      const apiKey = row6 ? row6.config_value : null;
                      let maskedApiKey = null;
                      if (apiKey && typeof apiKey === 'string' && apiKey.length > 8) {
                        maskedApiKey = apiKey.substring(0, apiKey.length - 8) + '********';
                      } else if (apiKey && typeof apiKey === 'string') {
                        maskedApiKey = '********';
                      }

                      res.json({
                        success: true,
                        config: {
                          sessionId: sessionId,
                          odooBaseUrl: odooBaseUrl,
                          externalApiBaseUrl: externalApiBaseUrl,
                          externalApiBearerToken: maskedBearer,
                          externalApiBearerTokenConfigured: !!bearerRaw,
                          externalApiUrl: externalApiUrl,
                          externalApiUrlActive: externalApiUrlActive,
                          externalApiUrlCompleted: externalApiUrlCompleted,
                          apiKey: maskedApiKey,
                          apiKeyConfigured: !!apiKey
                        }
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  } catch (error) {
    console.error('Unexpected error in GET /api/admin/config:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// PUT /api/admin/config
router.put('/config', (req, res) => {
  const {
    sessionId,
    odooBaseUrl,
    externalApiBaseUrl,
    externalApiBearerToken,
    externalApiUrl,
    externalApiUrlActive,
    externalApiUrlCompleted,
    apiKey
  } = req.body;
  
  if (sessionId && sessionId.length < 20) {
    return res.status(400).json({ success: false, error: 'Session ID must be at least 20 characters' });
  }

  db.get("SELECT table_name as name FROM information_schema.tables WHERE table_schema='public' AND table_name='admin_config'", (tableErr, tableRow) => {
    if (tableErr || !tableRow) {
      db.run(`CREATE TABLE IF NOT EXISTS admin_config (
        id SERIAL PRIMARY KEY,
        config_key TEXT UNIQUE NOT NULL,
        config_value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`, (createErr) => {
        if (createErr) {
          return res.status(500).json({ success: false, error: createErr.message });
        }
        insertConfig();
      });
    } else {
      insertConfig();
    }
  });

  function insertConfig() {
    if (sessionId) {
      db.run(
        `INSERT INTO admin_config (config_key, config_value, updated_at) 
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (config_key) DO UPDATE SET config_value = $2, updated_at = CURRENT_TIMESTAMP`,
        ['odoo_session_id', sessionId],
        function(err) {
          if (err) {
            return res.status(500).json({ success: false, error: err.message });
          }
          saveOdooBaseUrl();
        }
      );
    } else {
      saveOdooBaseUrl();
    }
    
    function saveOdooBaseUrl() {
      if (odooBaseUrl !== undefined) {
        db.run(
          `INSERT INTO admin_config (config_key, config_value, updated_at) 
           VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (config_key) DO UPDATE SET config_value = $2, updated_at = CURRENT_TIMESTAMP`,
          ['odoo_base_url', odooBaseUrl],
          function(err2) {
            if (err2) {
              return res.status(500).json({ success: false, error: err2.message });
            }
            saveExternalManufacturingV1();
          }
        );
      } else {
        saveExternalManufacturingV1();
      }
    }

    function saveExternalManufacturingV1() {
      if (externalApiBaseUrl !== undefined) {
        db.run(
          `INSERT INTO admin_config (config_key, config_value, updated_at) 
           VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (config_key) DO UPDATE SET config_value = $2, updated_at = CURRENT_TIMESTAMP`,
          ['external_api_base_url', String(externalApiBaseUrl || '').trim()],
          function(errB) {
            if (errB) {
              return res.status(500).json({ success: false, error: errB.message });
            }
            saveExternalBearerToken();
          }
        );
      } else {
        saveExternalBearerToken();
      }
    }

    function saveExternalBearerToken() {
      if (externalApiBearerToken !== undefined) {
        const tokenVal = externalApiBearerToken == null ? '' : String(externalApiBearerToken);
        db.run(
          `INSERT INTO admin_config (config_key, config_value, updated_at) 
           VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (config_key) DO UPDATE SET config_value = $2, updated_at = CURRENT_TIMESTAMP`,
          ['external_api_bearer_token', tokenVal],
          function(errT) {
            if (errT) {
              return res.status(500).json({ success: false, error: errT.message });
            }
            saveLegacyExternalApiUrls();
          }
        );
      } else {
        saveLegacyExternalApiUrls();
      }
    }

    function saveLegacyExternalApiUrls() {
      if (externalApiUrl !== undefined) {
        db.run(
          `INSERT INTO admin_config (config_key, config_value, updated_at) 
           VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (config_key) DO UPDATE SET config_value = $2, updated_at = CURRENT_TIMESTAMP`,
          ['external_api_url', externalApiUrl || 'https://foom-dash.vercel.app/API'],
          function(err3) {
            if (err3) {
              return res.status(500).json({ success: false, error: err3.message });
            }
            saveExternalApiUrlActive();
          }
        );
      } else {
        saveExternalApiUrlActive();
      }
    }
    
    function saveExternalApiUrlActive() {
      if (externalApiUrlActive !== undefined) {
        db.run(
          `INSERT INTO admin_config (config_key, config_value, updated_at) 
           VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (config_key) DO UPDATE SET config_value = $2, updated_at = CURRENT_TIMESTAMP`,
          ['external_api_url_active', externalApiUrlActive || 'https://foom-dash.vercel.app/API'],
          function(err4) {
            if (err4) {
              return res.status(500).json({ success: false, error: err4.message });
            }
            saveExternalApiUrlCompleted();
          }
        );
      } else {
        saveExternalApiUrlCompleted();
      }
    }
    
    function saveExternalApiUrlCompleted() {
      if (externalApiUrlCompleted !== undefined) {
        db.run(
          `INSERT INTO admin_config (config_key, config_value, updated_at) 
           VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (config_key) DO UPDATE SET config_value = $2, updated_at = CURRENT_TIMESTAMP`,
          ['external_api_url_completed', externalApiUrlCompleted || 'https://foom-dash.vercel.app/API'],
          function(err5) {
            if (err5) {
              return res.status(500).json({ success: false, error: err5.message });
            }
            saveApiKey();
          }
        );
      } else {
        saveApiKey();
      }
    }
    
    function saveApiKey() {
      if (apiKey !== undefined && apiKey !== null && apiKey !== '') {
        db.run(
          `INSERT INTO admin_config (config_key, config_value, updated_at) 
           VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (config_key) DO UPDATE SET config_value = $2, updated_at = CURRENT_TIMESTAMP`,
          ['api_key', apiKey],
          function(err6) {
            if (err6) {
              return res.status(500).json({ success: false, error: err6.message });
            }
            res.json({ success: true, message: 'Configuration saved successfully' });
          }
        );
      } else {
        res.json({ success: true, message: 'Configuration saved successfully' });
      }
    }
  }
});

// POST /api/admin/generate-api-key
router.post('/generate-api-key', (req, res) => {
  try {
    const apiKey = crypto.randomBytes(32).toString('hex');
    
    db.get("SELECT table_name as name FROM information_schema.tables WHERE table_schema='public' AND table_name='admin_config'", (tableErr, tableRow) => {
      if (tableErr || !tableRow) {
        db.run(`CREATE TABLE IF NOT EXISTS admin_config (
          id SERIAL PRIMARY KEY,
          config_key TEXT UNIQUE NOT NULL,
          config_value TEXT,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`, (createErr) => {
          if (createErr) {
            return res.status(500).json({ success: false, error: createErr.message });
          }
          saveApiKey();
        });
      } else {
        saveApiKey();
      }
    });
    
    function saveApiKey() {
      db.run(
        `INSERT INTO admin_config (config_key, config_value, updated_at) 
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (config_key) DO UPDATE SET config_value = $2, updated_at = CURRENT_TIMESTAMP`,
        ['api_key', apiKey],
        function(err) {
          if (err) {
            console.error('Error saving API key:', err);
            return res.status(500).json({ success: false, error: err.message });
          }
          
          res.json({ 
            success: true, 
            message: 'API key generated successfully',
            apiKey: apiKey,
            warning: 'Please save this API key securely. It will not be shown again.'
          });
        }
      );
    }
  } catch (error) {
    console.error('Error generating API key:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/mo-stats
router.get('/mo-stats', (req, res) => {
  db.all('SELECT COUNT(*) as total FROM odoo_mo_cache', [], (err, totalRow) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    
    db.all('SELECT COUNT(*) as recent FROM odoo_mo_cache WHERE fetched_at > NOW() - INTERVAL \'24 hours\'', [], (err2, recentRow) => {
      if (err2) {
        return res.status(500).json({ success: false, error: err2.message });
      }
      
      db.all('SELECT COUNT(*) as old FROM odoo_mo_cache WHERE create_date::TIMESTAMP < NOW() - INTERVAL \'7 days\'', [], (err3, oldRow) => {
        if (err3) {
          return res.status(500).json({ success: false, error: err3.message });
        }
        
        res.json({
          success: true,
          stats: {
            total: parseInt(totalRow[0].total) || 0,
            recent_24h: parseInt(recentRow[0].recent) || 0,
            older_than_7_days: parseInt(oldRow[0].old) || 0
          }
        });
      });
    });
  });
});

// GET /api/admin/test-connection
router.get('/test-connection', async (req, res) => {
  try {
    getAdminConfig(async (err, config) => {
      if (err) {
        return res.status(500).json({ success: false, error: 'Failed to get admin config' });
      }

      if (!config.sessionId || !config.odooBaseUrl) {
        return res.status(400).json({ success: false, error: 'Odoo configuration is missing' });
      }

      // Test Odoo connection by making a simple API call
      const https = require('https');
      const url = require('url');
      const parsedUrl = url.parse(config.odooBaseUrl);
      const COOKIE_HEADER = `session_id=${config.sessionId}; session_id=${config.sessionId}`;

      const requestData = {
        "jsonrpc": "2.0",
        "method": "call",
        "params": {
          "model": "mrp.production",
          "method": "search_read",
          "args": [],
          "kwargs": {
            "domain": [["id", ">", 0]],
            "fields": ["id", "name"],
            "limit": 1
          }
        },
        "id": Math.floor(Math.random() * 1000000)
      };

      // Build the correct path
      const basePath = parsedUrl.pathname || '/';
      const apiPath = basePath.endsWith('/') 
        ? `${basePath}web/dataset/call_kw/mrp.production/search_read`
        : `${basePath}/web/dataset/call_kw/mrp.production/search_read`;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: apiPath,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': COOKIE_HEADER
        },
        timeout: 10000
      };

      const postData = JSON.stringify(requestData);

      try {
        const response = await new Promise((resolve, reject) => {
          const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => {
              responseData += chunk;
            });
            res.on('end', () => {
              try {
                const jsonResponse = JSON.parse(responseData);
                if (jsonResponse.error) {
                  reject(new Error(jsonResponse.error.message || 'Odoo API error'));
                } else {
                  resolve(jsonResponse);
                }
              } catch (e) {
                reject(new Error('Failed to parse Odoo response'));
              }
            });
          });

          req.on('error', (error) => {
            reject(error);
          });

          req.on('timeout', () => {
            req.destroy();
            reject(new Error('Connection timeout'));
          });

          req.write(postData);
          req.end();
        });

        res.json({
          success: true,
          message: 'Connection test successful',
          odooBaseUrl: config.odooBaseUrl,
          sessionIdConfigured: !!config.sessionId
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: `Connection test failed: ${error.message}`
        });
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/cleanup-mo
router.post('/cleanup-mo', async (req, res) => {
  try {
    // Get MO numbers from the last 7 days
    db.all(
      `SELECT DISTINCT mo_number FROM odoo_mo_cache 
       WHERE create_date::TIMESTAMP >= NOW() - INTERVAL '7 days'`,
      [],
      (err, recentMoRows) => {
        if (err) {
          return res.status(500).json({ success: false, error: err.message });
        }

        const recentMoNumbers = recentMoRows.map(row => row.mo_number);

        if (recentMoNumbers.length === 0) {
          // If no recent MOs, delete all MOs older than 7 days
          db.run(
            `DELETE FROM odoo_mo_cache 
             WHERE create_date::TIMESTAMP < NOW() - INTERVAL '7 days'`,
            [],
            function(deleteErr) {
              if (deleteErr) {
                return res.status(500).json({ success: false, error: deleteErr.message });
              }
              res.json({
                success: true,
                deletedCount: this.changes || 0,
                message: `Deleted ${this.changes || 0} MO records older than 7 days`
              });
            }
          );
        } else {
          // Delete MOs that are not in the recent list and older than 7 days
          const placeholders = recentMoNumbers.map((_, i) => `$${i + 1}`).join(', ');
          const query = `
            DELETE FROM odoo_mo_cache 
            WHERE create_date::TIMESTAMP < NOW() - INTERVAL '7 days'
            AND mo_number NOT IN (${placeholders})
          `;

          db.run(query, recentMoNumbers, function(deleteErr) {
            if (deleteErr) {
              return res.status(500).json({ success: false, error: deleteErr.message });
            }
            res.json({
              success: true,
              deletedCount: this.changes || 0,
              message: `Deleted ${this.changes || 0} MO records older than 7 days`
            });
          });
        }
      }
    );
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/sync-production-data
// Incremental sync: only inserts new rows + updates changed rows
router.post('/sync-production-data', async (req, res) => {
  const client = await pool.connect();
  try {
    console.log('📥 [Sync Endpoint] Received sync request from admin panel');

    const sourceTables = [
      { name: 'production_liquid', type: 'liquid' },
      { name: 'production_device', type: 'device' },
      { name: 'production_cartridge', type: 'cartridge' }
    ];

    let totalNew = 0;
    let syncedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    // Helper: parse authenticity_data for JSONB
    function parseAuthData(authenticityData) {
      let authData = authenticityData;
      if (typeof authData === 'string') {
        try { authData = JSON.parse(authData); } catch (e) { authData = []; }
      }
      if (!authData || typeof authData !== 'object') authData = [];
      return authData;
    }

    // Helper: calculate quantity from authenticity_data
    function calcQuantity(authenticityData) {
      try {
        let quantity = 0;
        let authData = authenticityData;
        if (typeof authData === 'string') {
          try { authData = JSON.parse(authData); } catch (e) { return 0; }
        }
        if (Array.isArray(authData)) {
          authData.forEach(auth => {
            if (auth && auth.firstAuthenticity && auth.lastAuthenticity) {
              const firstMatch = String(auth.firstAuthenticity).trim().match(/\d+/);
              const lastMatch = String(auth.lastAuthenticity).trim().match(/\d+/);
              if (firstMatch && lastMatch) {
                const first = parseInt(firstMatch[0], 10) || 0;
                const last = parseInt(lastMatch[0], 10) || 0;
                if (last >= first) quantity += (last - first + 1);
              }
            }
          });
        } else if (authData && authData.firstAuthenticity && authData.lastAuthenticity) {
          const firstMatch = String(authData.firstAuthenticity).trim().match(/\d+/);
          const lastMatch = String(authData.lastAuthenticity).trim().match(/\d+/);
          if (firstMatch && lastMatch) {
            const first = parseInt(firstMatch[0], 10) || 0;
            const last = parseInt(lastMatch[0], 10) || 0;
            if (last >= first) quantity = (last - first + 1);
          }
        }
        return quantity;
      } catch (e) { return 0; }
    }

    // ── STEP 1: Insert new rows ──
    for (const table of sourceTables) {
      const newRowsResult = await client.query(
        `SELECT s.*
         FROM ${table.name} s
         LEFT JOIN production_results pr
           ON pr.production_type = $1
           AND pr.session_id = s.session_id
           AND pr.mo_number = s.mo_number
           AND pr.created_at = s.created_at
         WHERE pr.id IS NULL
           AND s.session_id IS NOT NULL
           AND s.mo_number IS NOT NULL
           AND s.pic IS NOT NULL
           AND s.created_at IS NOT NULL`,
        [table.type]
      );

      const newRows = newRowsResult.rows || [];
      totalNew += newRows.length;

      if (newRows.length > 0) {
        console.log(`📊 [Sync] Found ${newRows.length} new records from ${table.name}`);
      }

      for (const row of newRows) {
        try {
          const authData = parseAuthData(row.authenticity_data);
          const quantity = calcQuantity(row.authenticity_data);
          const completedAt = (row.status === 'completed' && row.completed_at)
            ? row.completed_at
            : (row.status === 'completed' ? new Date().toISOString() : null);

          await client.query(
            `INSERT INTO production_results
             (production_type, session_id, leader_name, shift_number, pic, mo_number, sku_name,
              authenticity_data, status, quantity, completed_at, created_at, synced_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, CURRENT_TIMESTAMP)
             ON CONFLICT (production_type, session_id, mo_number, created_at) DO NOTHING`,
            [
              table.type,
              row.session_id || '',
              row.leader_name || '',
              row.shift_number || '',
              row.pic || '',
              row.mo_number || '',
              row.sku_name || '',
              JSON.stringify(authData),
              row.status || 'active',
              quantity,
              completedAt,
              row.created_at
            ]
          );
          syncedCount++;
        } catch (rowErr) {
          errorCount++;
          console.error(`❌ [Sync] Insert error from ${table.name} (MO: ${row.mo_number}):`, rowErr.message);
        }
      }
    }

    // ── STEP 2: Update existing rows where source data has changed OR status is 'active' ──
    // Active rows are always refreshed so ongoing production data stays current
    for (const table of sourceTables) {
      try {
        const deltaResult = await client.query(
          `SELECT s.session_id, s.mo_number, s.created_at,
                  s.authenticity_data AS source_auth, s.status AS source_status,
                  s.completed_at AS source_completed_at,
                  s.leader_name AS source_leader, s.shift_number AS source_shift,
                  s.pic AS source_pic, s.sku_name AS source_sku,
                  pr.id AS pr_id, pr.status AS pr_status
           FROM ${table.name} s
           INNER JOIN production_results pr
             ON pr.production_type = $1
             AND pr.session_id = s.session_id
             AND pr.mo_number = s.mo_number
             AND pr.created_at = s.created_at
           WHERE pr.status = 'active'
              OR pr.status IS DISTINCT FROM s.status
              OR pr.quantity IS NULL
              OR (pr.completed_at IS NULL AND s.status = 'completed')`,
          [table.type]
        );

        if (deltaResult.rows.length > 0) {
          console.log(`📊 [Sync] Found ${deltaResult.rows.length} records to update from ${table.name} (including active)`);
        }

        for (const row of deltaResult.rows) {
          try {
            const authData = parseAuthData(row.source_auth);
            const quantity = calcQuantity(row.source_auth);
            const completedAt = row.source_completed_at ||
              (row.source_status === 'completed' ? new Date().toISOString() : null);

            await client.query(
              `UPDATE production_results
               SET status = $1, quantity = $2, completed_at = $3,
                   authenticity_data = $4::jsonb,
                   leader_name = $5, shift_number = $6, pic = $7, sku_name = $8,
                   updated_at = CURRENT_TIMESTAMP, synced_at = CURRENT_TIMESTAMP
               WHERE id = $9`,
              [
                row.source_status || 'active',
                quantity,
                completedAt,
                JSON.stringify(authData),
                row.source_leader || '',
                row.source_shift || '',
                row.source_pic || '',
                row.source_sku || '',
                row.pr_id
              ]
            );
            updatedCount++;
          } catch (updErr) {
            errorCount++;
            console.error(`❌ [Sync] Update error PR id ${row.pr_id}:`, updErr.message);
          }
        }
      } catch (deltaErr) {
        console.error(`❌ [Sync] Delta query error for ${table.name}:`, deltaErr.message);
      }
    }

    const message = totalNew === 0 && updatedCount === 0
      ? 'Production results already up to date'
      : `Synced ${syncedCount} new + ${updatedCount} updated records`;
    console.log(`✅ [Sync] ${message}`);

    res.json({
      success: true,
      syncedCount,
      updatedCount,
      totalNew,
      errorCount,
      message
    });
  } catch (error) {
    console.error('❌ [Sync Endpoint] Fatal error:', error.message, error.stack);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// POST /api/admin/sync-mo - Manually trigger MO sync from Odoo
router.post('/sync-mo', async (req, res) => {
  try {
    console.log('🔄 [Manual Sync] Starting MO data update from Odoo...');
    
    getAdminConfig(async (err, config) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to get admin config: ' + err.message 
        });
      }

      if (!config.sessionId || !config.odooBaseUrl) {
        return res.status(400).json({ 
          success: false, 
          error: 'Odoo configuration is missing. Please configure Odoo Session ID and Base URL in Admin settings.' 
        });
      }

      const productionTypes = ['liquid', 'device', 'cartridge'];
      let totalUpdated = 0;
      const results = [];

      for (const productionType of productionTypes) {
        try {
          const https = require('https');
          const url = require('url');
          const noteFilter = productionType.toLowerCase();
          let domainFilter;
          
          if (noteFilter === 'cartridge') {
            domainFilter = ['|', '|', '|',
              ['note', 'ilike', 'cartridge'],
              ['note', 'ilike', 'cartirdge'],
              ['note', 'ilike', 'cartrige'],
              ['note', 'ilike', 'cartrdige']
            ];
          } else if (noteFilter === 'liquid') {
            domainFilter = ['note', 'ilike', 'liquid'];
          } else if (noteFilter === 'device') {
            domainFilter = ['note', 'ilike', 'device'];
          } else {
            continue;
          }

          const daysBack = 30;
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - daysBack);
          const startDateStr = startDate.toISOString().split('T')[0] + ' 00:00:00';

          let combinedDomain;
          if (noteFilter === 'cartridge') {
            combinedDomain = [
              '&',
              '|', '|', '|',
              ['note', 'ilike', 'cartridge'],
              ['note', 'ilike', 'cartirdge'],
              ['note', 'ilike', 'cartrige'],
              ['note', 'ilike', 'cartrdige'],
              ["create_date", ">=", startDateStr]
            ];
          } else {
            combinedDomain = [
              domainFilter,
              ["create_date", ">=", startDateStr]
            ];
          }

          const ODOO_URL = `${config.odooBaseUrl}/web/dataset/call_kw/mrp.production/search_read`;
          const COOKIE_HEADER = `session_id=${config.sessionId}; session_id=${config.sessionId}`;

          const requestData = {
            "jsonrpc": "2.0",
            "method": "call",
            "params": {
              "model": "mrp.production",
              "method": "search_read",
              "args": [combinedDomain],
              "kwargs": {
                "fields": ["id", "name", "product_id", "product_qty", "product_uom_id", "note", "create_date"],
                "limit": 1000,
                "order": "create_date desc"
              }
            }
          };

          const parsedUrl = url.parse(ODOO_URL);
          const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.path,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cookie': COOKIE_HEADER
            }
          };

          const postData = JSON.stringify(requestData);

          const response = await new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
              let responseData = '';
              res.on('data', (chunk) => {
                responseData += chunk;
              });
              res.on('end', () => {
                try {
                  const jsonResponse = JSON.parse(responseData);
                  if (jsonResponse.error) {
                    reject(new Error(jsonResponse.error.message || 'Odoo API error'));
                  } else {
                    resolve(jsonResponse);
                  }
                } catch (e) {
                  reject(new Error('Failed to parse Odoo response'));
                }
              });
            });

            req.on('error', (error) => {
              reject(error);
            });

            req.setTimeout(30000, () => {
              req.destroy();
              reject(new Error('Request timeout'));
            });

            req.write(postData);
            req.end();
          });

          if (response.result && Array.isArray(response.result)) {
            const insertPromises = response.result.map((mo) => {
              return new Promise((resolve, reject) => {
                const moCreateDate = mo.create_date || new Date().toISOString();
                const productName = mo.product_id ? mo.product_id[1] : 'N/A';
                const productQty = mo.product_qty || 0;
                const productUom = mo.product_uom_id ? mo.product_uom_id[1] : '';
                const moNote = mo.note || '';
                
                db.run(
                  `INSERT INTO odoo_mo_cache 
                   (mo_number, sku_name, quantity, uom, note, create_date, fetched_at, last_updated) 
                   VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                   ON CONFLICT (mo_number) DO UPDATE SET 
                     sku_name = $2, quantity = $3, uom = $4, note = $5, 
                     create_date = $6, last_updated = CURRENT_TIMESTAMP`,
                  [
                    mo.name,
                    productName,
                    productQty,
                    productUom,
                    moNote,
                    moCreateDate
                  ],
                  function(insertErr) {
                    if (insertErr) {
                      reject(insertErr);
                    } else {
                      resolve();
                    }
                  }
                );
              });
            });

            await Promise.all(insertPromises);
            const updated = response.result.length;
            totalUpdated += updated;
            results.push({
              production_type: productionType,
              updated: updated,
              status: 'success'
            });
            console.log(`✅ [Manual Sync] Updated ${updated} MO records for ${productionType}`);
          }
        } catch (error) {
          console.error(`❌ [Manual Sync] Error updating MO data for ${productionType}:`, error.message);
          results.push({
            production_type: productionType,
            updated: 0,
            status: 'error',
            error: error.message
          });
        }
      }

      console.log(`✅ [Manual Sync] MO data update completed. Total updated: ${totalUpdated}`);
      
      res.json({
        success: true,
        message: `MO sync completed successfully`,
        totalUpdated: totalUpdated,
        results: results,
        timestamp: new Date().toISOString()
      });
    });
  } catch (error) {
    console.error('❌ [Manual Sync] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to sync MO data from Odoo'
    });
  }
});

// Export helper function for use in other routes
module.exports = { router, getAdminConfig };
