const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { convertDBTimestampToJakarta } = require('../utils/timezone.utils');

// Initialize receiver_logs table if not exists
function initializeReceiverLogsTable() {
  db.run(`
    CREATE TABLE IF NOT EXISTS receiver_logs (
      id SERIAL PRIMARY KEY,
      source TEXT NOT NULL,
      payload TEXT NOT NULL,
      received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      response_status INTEGER,
      response_message TEXT,
      ip_address TEXT,
      user_agent TEXT
    )
  `, (err) => {
    if (err && !err.message.includes('already exists')) {
      console.error('Error creating receiver_logs table:', err);
    }
  });
}

// Initialize table on module load
initializeReceiverLogsTable();

// POST /api/receiver/test - Receive data from External API URLs
router.post('/test', (req, res) => {
  try {
    const { source, data, timestamp } = req.body;
    const querySource = req.query.source; // Allow source from query parameter too
    
    // Determine source: from body, query param, or default to 'fallback'
    const finalSource = source || querySource || 'fallback';
    
    // Validate source
    const validSources = ['fallback', 'active', 'completed'];
    if (!validSources.includes(finalSource)) {
      return res.status(400).json({
        success: false,
        error: `Invalid source. Must be one of: ${validSources.join(', ')}`
      });
    }
    
    // Get payload (use data from body or entire body if no data field)
    const payload = data || req.body;
    const payloadString = JSON.stringify(payload);
    const dataSize = Buffer.byteLength(payloadString, 'utf8');
    
    // Get client info
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    // Save to database for audit trail
    db.run(
      `INSERT INTO receiver_logs (source, payload, received_at, ip_address, user_agent) 
       VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4)`,
      [finalSource, payloadString, ipAddress, userAgent],
      function(err) {
        if (err) {
          console.error('Error saving receiver log:', err);
          // Continue even if log save fails
        }
        
        // Update response status
        if (!err) {
          db.run(
            `UPDATE receiver_logs SET response_status = $1, response_message = $2 WHERE id = $3`,
            [200, 'Data received successfully', this.lastID],
            () => {}
          );
        }
      }
    );
    
    // Log to console
    console.log(`📥 [Receiver] Received data from ${finalSource} source`);
    console.log(`   IP: ${ipAddress}, Size: ${dataSize} bytes`);
    if (payload.mo_number) {
      console.log(`   MO Number: ${payload.mo_number}`);
    }
    if (payload.status) {
      console.log(`   Status: ${payload.status}`);
    }
    
    // Return success response
    res.json({
      success: true,
      received_at: new Date().toISOString(),
      source: finalSource,
      data_size: dataSize,
      message: 'Data received successfully',
      mo_number: payload.mo_number || null,
      status: payload.status || null
    });
  } catch (error) {
    console.error('Error in receiver endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// GET /api/receiver/test/logs - View logs of received data
router.get('/test/logs', (req, res) => {
  try {
    const { source, limit = 50, offset = 0 } = req.query;
    const limitNum = parseInt(limit) || 50;
    const offsetNum = parseInt(offset) || 0;
    
    let query = 'SELECT * FROM receiver_logs';
    const params = [];
    
    // Add source filter if provided
    if (source) {
      query += ' WHERE source = $1';
      params.push(source);
    }
    
    query += ' ORDER BY received_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limitNum, offsetNum);
    
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error('Error fetching receiver logs:', err);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch logs'
        });
      }
      
      // Parse payload JSON strings
      const logs = rows.map(row => ({
        ...row,
        payload: JSON.parse(row.payload || '{}')
      }));
      
      // Get total count
      let countQuery = 'SELECT COUNT(*) as total FROM receiver_logs';
      const countParams = [];
      if (source) {
        countQuery += ' WHERE source = $1';
        countParams.push(source);
      }
      
      db.get(countQuery, countParams, (countErr, countRow) => {
        if (countErr) {
          console.error('Error counting receiver logs:', countErr);
        }
        
        res.json({
          success: true,
          total: countRow ? parseInt(countRow.total) : logs.length,
          limit: limitNum,
          offset: offsetNum,
          data: logs
        });
      });
    });
  } catch (error) {
    console.error('Error in receiver logs endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// GET /api/receiver/test/stats - Get statistics about received data
router.get('/test/stats', (req, res) => {
  try {
    db.all(
      `SELECT 
        source,
        COUNT(*) as count,
        MIN(received_at) as first_received,
        MAX(received_at) as last_received
       FROM receiver_logs
       GROUP BY source
       ORDER BY source`,
      [],
      (err, rows) => {
        if (err) {
          console.error('Error fetching receiver stats:', err);
          return res.status(500).json({
            success: false,
            error: 'Failed to fetch stats'
          });
        }
        
        res.json({
          success: true,
          stats: rows
        });
      }
    );
  } catch (error) {
    console.error('Error in receiver stats endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// POST /api/receiver/manufacturing - Receive active status from External API
router.post('/manufacturing', (req, res) => {
  try {
    const { manufacturing_id, sku, sku_name, target_qty, done_qty, leader_name, finished_at } = req.body;
    
    console.log(`\n📥 [Receiver] ==========================================`);
    console.log(`📥 [Receiver] POST /manufacturing`);
    console.log(`📥 [Receiver] Request Body:`, JSON.stringify(req.body, null, 2));
    console.log(`📥 [Receiver] ==========================================\n`);
    
    // Validate required fields
    if (!manufacturing_id || !sku || !sku_name || target_qty === undefined || !leader_name) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: manufacturing_id, sku, sku_name, target_qty, leader_name'
      });
    }
    
    // Get client info for logging
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    // Check if record with same manufacturing_id and status 'active' exists
    db.get(
      `SELECT id FROM manufacturing_identity 
       WHERE manufacturing_id = $1 AND status = 'active'`,
      [manufacturing_id],
      (checkErr, existingRow) => {
        if (checkErr) {
          console.error('❌ [Receiver] Error checking existing record:', checkErr);
          return res.status(500).json({
            success: false,
            error: 'Failed to check existing record: ' + checkErr.message
          });
        }
        
        if (existingRow) {
          // Update existing record
          db.run(
            `UPDATE manufacturing_identity SET
             sku = $1,
             sku_name = $2,
             target_qty = $3,
             done_qty = $4,
             leader_name = $5,
             finished_at = $6,
             updated_at = CURRENT_TIMESTAMP
             WHERE id = $7`,
            [
              sku,
              sku_name,
              target_qty || 0,
              done_qty,
              leader_name,
              finished_at || null,
              existingRow.id
            ],
            function(updateErr) {
              if (updateErr) {
                console.error('❌ [Receiver] Error updating manufacturing identity (active):', updateErr);
                return res.status(500).json({
                  success: false,
                  error: 'Failed to update manufacturing identity: ' + updateErr.message
                });
              }
              
              handleSuccessResponse('active', manufacturing_id, sku_name, target_qty, leader_name, ipAddress, userAgent, req.body, res);
            }
          );
        } else {
          // Insert new record
          db.run(
            `INSERT INTO manufacturing_identity 
             (manufacturing_id, sku, sku_name, target_qty, done_qty, leader_name, finished_at, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [
              manufacturing_id,
              sku,
              sku_name,
              target_qty || 0,
              done_qty,
              leader_name,
              finished_at || null
            ],
            function(insertErr) {
              if (insertErr) {
                console.error('❌ [Receiver] Error saving manufacturing identity (active):', insertErr);
                return res.status(500).json({
                  success: false,
                  error: 'Failed to save manufacturing identity: ' + insertErr.message
                });
              }
              
              handleSuccessResponse('active', manufacturing_id, sku_name, target_qty, leader_name, ipAddress, userAgent, req.body, res);
            }
          );
        }
      }
    );
  } catch (error) {
    console.error('❌ [Receiver] Error in POST /manufacturing:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// Helper function to handle success response and logging
function handleSuccessResponse(status, manufacturing_id, sku_name, target_qty, leader_name, ipAddress, userAgent, body, res, done_qty = null, finished_at = null) {
  // Log to receiver_logs
  const payload = JSON.stringify(body);
  db.run(
    `INSERT INTO receiver_logs (source, payload, received_at, ip_address, user_agent, response_status, response_message)
     VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6)`,
    [status, payload, ipAddress, userAgent, 200, 'Manufacturing identity saved successfully'],
    () => {}
  );
  
  console.log(`✅ [Receiver] Received ${status} manufacturing identity: ${manufacturing_id}`);
  console.log(`   SKU: ${sku_name}, Target Qty: ${target_qty}, Leader: ${leader_name}`);
  if (done_qty !== null) {
    console.log(`   Done Qty: ${done_qty}`);
  }
  if (finished_at) {
    console.log(`   Finished At: ${finished_at}`);
  }
  
  res.json({
    success: true,
    message: 'Manufacturing identity received and saved successfully',
    manufacturing_id: manufacturing_id,
    status: status,
    received_at: new Date().toISOString()
  });
}

// PUT /api/receiver/manufacturing/:manufacturing_id - Receive completed status from External API
// Note: manufacturing_id may contain special characters like '/', so it should be URL encoded
// IMPORTANT: URL parameter may be ID, but manufacturing_id for database should come from request body
router.put('/manufacturing/:manufacturing_id(*)', (req, res) => {
  try {
    // Use wildcard route to capture everything after /manufacturing/
    // This handles MO numbers with '/' like PROD/MO/30739 or IDs like 14
    const urlParam = req.params[0] || req.params.manufacturing_id;
    const { manufacturing_id, sku, sku_name, target_qty, done_qty, leader_name, finished_at } = req.body;
    
    // Decode the URL parameter if it was encoded
    const decodedUrlParam = decodeURIComponent(urlParam);
    
    console.log(`\n📥 [Receiver] ==========================================`);
    console.log(`📥 [Receiver] PUT /manufacturing/:manufacturing_id`);
    console.log(`📥 [Receiver] URL Parameter: ${decodedUrlParam}`);
    console.log(`📥 [Receiver] Request Body:`, JSON.stringify(req.body, null, 2));
    console.log(`📥 [Receiver] ==========================================\n`);
    
    // Use manufacturing_id from request body if available, otherwise use URL parameter
    // This ensures we use MO number (from body) not ID (from URL) for database
    const moNumberForDb = manufacturing_id || decodedUrlParam;
    
    // Validate required fields
    if (!moNumberForDb) {
      return res.status(400).json({
        success: false,
        error: 'manufacturing_id is required (in URL parameter or request body)'
      });
    }
    
    if (!sku || !sku_name || target_qty === undefined || !leader_name) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: sku, sku_name, target_qty, leader_name'
      });
    }
    
    // Get client info for logging
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    console.log(`📝 [Receiver] Using manufacturing_id for database: ${moNumberForDb} (from ${manufacturing_id ? 'body' : 'URL parameter'})`);
    
    // Check if record with same manufacturing_id and status 'completed' exists
    // Also check if there's an 'active' record that should be updated
    db.get(
      `SELECT id, status FROM manufacturing_identity 
       WHERE manufacturing_id = $1 AND status IN ('completed', 'active')
       ORDER BY CASE WHEN status = 'completed' THEN 1 ELSE 2 END, created_at DESC
       LIMIT 1`,
      [moNumberForDb],
      (checkErr, existingRow) => {
        if (checkErr) {
          console.error('❌ [Receiver] Error checking existing record:', checkErr);
          return res.status(500).json({
            success: false,
            error: 'Failed to check existing record: ' + checkErr.message
          });
        }
        
        console.log(`🔍 [Receiver] Checking existing record for ${moNumberForDb}:`, existingRow ? `Found (id: ${existingRow.id}, status: ${existingRow.status})` : 'Not found');
        
        if (existingRow) {
          // Update existing record (whether it's 'active' or 'completed')
          // If it's 'active', we'll update it to 'completed'
          // If it's 'completed', we'll just update the data
          db.run(
            `UPDATE manufacturing_identity SET
             sku = $1,
             sku_name = $2,
             target_qty = $3,
             done_qty = $4,
             leader_name = $5,
             finished_at = $6,
             status = 'completed',
             updated_at = CURRENT_TIMESTAMP
             WHERE id = $7`,
            [
              sku,
              sku_name,
              target_qty || 0,
              done_qty,
              leader_name,
              finished_at || null,
              existingRow.id
            ],
            function(updateErr) {
              if (updateErr) {
                console.error('❌ [Receiver] Error updating manufacturing identity (completed):', updateErr);
                return res.status(500).json({
                  success: false,
                  error: 'Failed to update manufacturing identity: ' + updateErr.message
                });
              }
              
              console.log(`✅ [Receiver] Updated existing record (id: ${existingRow.id}, was: ${existingRow.status}, now: completed)`);
              handleSuccessResponse('completed', moNumberForDb, sku_name, target_qty, leader_name, ipAddress, userAgent, { ...req.body, manufacturing_id: moNumberForDb }, res, done_qty, finished_at);
            }
          );
        } else {
          // Insert new record (no existing record found)
          console.log(`📝 [Receiver] No existing record found, inserting new record for ${moNumberForDb}`);
          db.run(
            `INSERT INTO manufacturing_identity 
             (manufacturing_id, sku, sku_name, target_qty, done_qty, leader_name, finished_at, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [
              moNumberForDb,
              sku,
              sku_name,
              target_qty || 0,
              done_qty,
              leader_name,
              finished_at || null
            ],
            function(insertErr) {
              if (insertErr) {
                console.error('❌ [Receiver] Error saving manufacturing identity (completed):', insertErr);
                return res.status(500).json({
                  success: false,
                  error: 'Failed to save manufacturing identity: ' + insertErr.message
                });
              }
              
              console.log(`✅ [Receiver] Inserted new record (id: ${this.lastID})`);
              handleSuccessResponse('completed', moNumberForDb, sku_name, target_qty, leader_name, ipAddress, userAgent, { ...req.body, manufacturing_id: moNumberForDb }, res, done_qty, finished_at);
            }
          );
        }
      }
    );
  } catch (error) {
    console.error('❌ [Receiver] Error in PUT /manufacturing/:manufacturing_id:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// GET /api/receiver/manufacturing - Get all manufacturing identities
router.get('/manufacturing', (req, res) => {
  try {
    const { status, manufacturing_id, limit = 100, offset = 0 } = req.query;
    const limitNum = parseInt(limit) || 100;
    const offsetNum = parseInt(offset) || 0;
    
    let query = 'SELECT * FROM manufacturing_identity WHERE 1=1';
    const params = [];
    
    if (status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(status);
    }
    
    if (manufacturing_id) {
      query += ` AND manufacturing_id = $${params.length + 1}`;
      params.push(manufacturing_id);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limitNum, offsetNum);
    
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error('Error fetching manufacturing identities:', err);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch manufacturing identities'
        });
      }
      
      // Get total count
      let countQuery = 'SELECT COUNT(*) as total FROM manufacturing_identity WHERE 1=1';
      const countParams = [];
      
      if (status) {
        countQuery += ` AND status = $${countParams.length + 1}`;
        countParams.push(status);
      }
      
      if (manufacturing_id) {
        countQuery += ` AND manufacturing_id = $${countParams.length + 1}`;
        countParams.push(manufacturing_id);
      }
      
      db.get(countQuery, countParams, (countErr, countRow) => {
        if (countErr) {
          console.error('Error counting manufacturing identities:', countErr);
        }
        
        // Convert timestamps to Jakarta timezone
        const formattedRows = rows.map(row => ({
          ...row,
          created_at: convertDBTimestampToJakarta(row.created_at),
          updated_at: convertDBTimestampToJakarta(row.updated_at),
          finished_at: row.finished_at ? convertDBTimestampToJakarta(row.finished_at) : null,
          started_at: convertDBTimestampToJakarta(row.created_at) // Alias for created_at
        }));
        
        res.json({
          success: true,
          total: countRow ? parseInt(countRow.total) : rows.length,
          limit: limitNum,
          offset: offsetNum,
          data: formattedRows
        });
      });
    });
  } catch (error) {
    console.error('Error in GET /manufacturing:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// GET /api/receiver/manufacturing/:manufacturing_id - Get specific manufacturing identity
router.get('/manufacturing/:manufacturing_id', (req, res) => {
  try {
    const { manufacturing_id } = req.params;
    const { status } = req.query;
    
    let query = 'SELECT * FROM manufacturing_identity WHERE manufacturing_id = $1';
    const params = [manufacturing_id];
    
    if (status) {
      query += ' AND status = $2';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC';
    
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error('Error fetching manufacturing identity:', err);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch manufacturing identity'
        });
      }
      
      // Convert timestamps to Jakarta timezone
      const formattedRows = rows.map(row => ({
        ...row,
        created_at: convertDBTimestampToJakarta(row.created_at),
        updated_at: convertDBTimestampToJakarta(row.updated_at),
        finished_at: row.finished_at ? convertDBTimestampToJakarta(row.finished_at) : null,
        started_at: convertDBTimestampToJakarta(row.created_at) // Alias for created_at
      }));
      
      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Manufacturing identity not found'
        });
      }
      
      res.json({
        success: true,
        count: formattedRows.length,
        data: formattedRows
      });
    });
  } catch (error) {
    console.error('Error in GET /manufacturing/:manufacturing_id:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

module.exports = router;
