const express = require('express');
const router = express.Router();
const http = require('http');
const https = require('https');
const url = require('url');
const { db } = require('../database');
const { parseAuthenticityData, normalizeAuthenticityArray } = require('../utils/authenticity.utils');
const { sendToExternalAPI, sendToExternalAPIWithUrl, getExternalAPIUrl } = require('../services/external-api.service');
const { convertDBTimestampToJakarta } = require('../utils/timezone.utils');

// Helper function to get manufacturing identity ID by MO number
// This queries the internal database to get the ID from manufacturing_identity table
function getManufacturingIdentityId(moNumber, callback) {
  // Query manufacturing_identity table directly to get ID
  // Try to get the most recent active or completed record
  db.get(
    `SELECT id FROM manufacturing_identity 
     WHERE manufacturing_id = $1 
     ORDER BY created_at DESC 
     LIMIT 1`,
    [moNumber],
    (err, row) => {
      if (err) {
        console.error(`❌ [Manufacturing Identity] Error getting ID for MO ${moNumber}:`, err);
        return callback(err, null);
      }
      
      if (row && row.id) {
        console.log(`✅ [Manufacturing Identity] Found ID ${row.id} for MO ${moNumber}`);
        callback(null, row.id);
      } else {
        console.log(`⚠️  [Manufacturing Identity] No ID found for MO ${moNumber}, will use MO number as fallback`);
        callback(null, null); // Return null if not found, will use MO number as fallback
      }
    }
  );
}

// Helper function to calculate done_qty from authenticity_data array (handle multiple rolls)
function calculateDoneQty(authenticityDataArray) {
  let totalDoneQty = 0;
  
  if (!Array.isArray(authenticityDataArray)) {
    return 0;
  }
  
  authenticityDataArray.forEach(record => {
    if (!record.authenticity_data) {
      return;
    }
    
    let authenticityData = record.authenticity_data;
    if (typeof authenticityData === 'string') {
      try {
        authenticityData = JSON.parse(authenticityData);
      } catch (e) {
        return;
      }
    }
    
    if (!Array.isArray(authenticityData)) {
      authenticityData = [authenticityData];
    }
    
    authenticityData.forEach(roll => {
      const firstAuth = roll.firstAuthenticity || roll.first_authenticity || '';
      const lastAuth = roll.lastAuthenticity || roll.last_authenticity || '';
      
      if (firstAuth && lastAuth) {
        const firstNum = parseInt(firstAuth);
        const lastNum = parseInt(lastAuth);
        
        if (!isNaN(firstNum) && !isNaN(lastNum) && lastNum >= firstNum) {
          totalDoneQty += (lastNum - firstNum);
        }
      }
    });
  });
  
  return totalDoneQty;
}

// Helper function to format manufacturing data for external API
function formatManufacturingData(moNumber, skuName, targetQty, doneQty, leaderName, finishedAt) {
  return {
    manufacturing_id: moNumber,
    sku: skuName,
    sku_name: `Product ${skuName}`,
    target_qty: targetQty || 0,
    done_qty: doneQty,
    leader_name: leaderName || '',
    finished_at: finishedAt ? convertDBTimestampToJakarta(finishedAt) : null,
    started_at: null // Will be set if needed from created_at
  };
}

// Helper function to group production data by session
function groupBySession(rows) {
  const grouped = {};
  rows.forEach(row => {
    const sessionKey = row.session_id || `${row.leader_name}_${row.shift_number}_${row.created_at}`;
    if (!grouped[sessionKey]) {
      grouped[sessionKey] = {
        session_id: sessionKey,
        leader_name: row.leader_name,
        shift_number: row.shift_number,
        status: row.status || 'active',
        created_at: row.created_at,
        inputs: []
      };
    }
    grouped[sessionKey].inputs.push({
      id: row.id,
      pic: row.pic,
      mo_number: row.mo_number,
      sku_name: row.sku_name,
      authenticity_data: row.authenticity_data,
      status: row.status || 'active',
      created_at: row.created_at
    });
  });
  return Object.values(grouped).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

// GET /api/production/liquid
router.get('/liquid', (req, res) => {
  db.all('SELECT * FROM production_liquid ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    const parsedRows = rows.map(parseAuthenticityData);
    res.json(groupBySession(parsedRows));
  });
});

// GET /api/production/device
router.get('/device', (req, res) => {
  db.all('SELECT * FROM production_device ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    const parsedRows = rows.map(parseAuthenticityData);
    res.json(groupBySession(parsedRows));
  });
});

// GET /api/production/cartridge
router.get('/cartridge', (req, res) => {
  db.all('SELECT * FROM production_cartridge ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    const parsedRows = rows.map(parseAuthenticityData);
    res.json(groupBySession(parsedRows));
  });
});

// GET /api/production/report
router.get('/report', (req, res) => {
  const { type, mo_number, pic, date_from, date_to, status, limit, offset } = req.query;
  
  const tables = [];
  if (!type || type === 'all' || type === 'liquid') {
    tables.push({ name: 'production_liquid', type: 'liquid' });
  }
  if (!type || type === 'all' || type === 'device') {
    tables.push({ name: 'production_device', type: 'device' });
  }
  if (!type || type === 'all' || type === 'cartridge') {
    tables.push({ name: 'production_cartridge', type: 'cartridge' });
  }
  
  const allResults = [];
  let completedQueries = 0;
  
  tables.forEach((table) => {
    let query = `
      SELECT 
        pic as pic_input,
        sku_name,
        mo_number,
        authenticity_data::json->0->>'rollNumber' as roll,
        authenticity_data::json->0->>'firstAuthenticity' as first_authenticity_id,
        authenticity_data::json->0->>'lastAuthenticity' as last_authenticity_id,
        leader_name,
        shift_number,
        status,
        created_at,
        completed_at,
        '${table.type}' as production_type
      FROM ${table.name}
      WHERE 1=1
    `;
    
    const params = [];
    
    if (mo_number) {
      query += ' AND mo_number = $' + (params.length + 1);
      params.push(mo_number);
    }
    if (pic) {
      query += ' AND pic LIKE $' + (params.length + 1);
      params.push(`%${pic}%`);
    }
    if (date_from) {
      query += ' AND date(created_at) >= $' + (params.length + 1);
      params.push(date_from);
    }
    if (date_to) {
      query += ' AND date(created_at) <= $' + (params.length + 1);
      params.push(date_to);
    }
    if (status && status !== 'all') {
      query += ' AND status = $' + (params.length + 1);
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC';
    
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error(`Error querying ${table.name}:`, err);
      } else {
        allResults.push(...rows);
      }
      
      completedQueries++;
      
      if (completedQueries === tables.length) {
        allResults.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        let paginatedResults = allResults;
        const limitNum = parseInt(limit) || 0;
        const offsetNum = parseInt(offset) || 0;
        
        if (limitNum > 0) {
          paginatedResults = allResults.slice(offsetNum, offsetNum + limitNum);
        }
        
        res.json({
          success: true,
          total: allResults.length,
          limit: limitNum || null,
          offset: offsetNum || 0,
          data: paginatedResults
        });
      }
    });
  });
  
  if (tables.length === 0) {
    res.status(400).json({
      success: false,
      error: 'Invalid production type'
    });
  }
});

// POST /api/production/liquid
router.post('/liquid', (req, res) => {
  const { session_id, leader_name, shift_number, pic, mo_number, sku_name, authenticity_data } = req.body;
  
  const authenticityRows = normalizeAuthenticityArray(authenticity_data);
  
  db.get('SELECT quantity FROM odoo_mo_cache WHERE mo_number = ?', [mo_number], (err, row) => {
    const targetQty = (!err && row) ? (row.quantity || 0) : 0;
    
    const insertPromises = authenticityRows.map((authRow) => {
      return new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO production_liquid (session_id, leader_name, shift_number, pic, mo_number, sku_name, authenticity_data, status) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')`,
          [session_id, leader_name, shift_number, pic, mo_number, sku_name, JSON.stringify([authRow])],
          function(insertErr) {
            if (insertErr) {
              reject(insertErr);
            } else {
              resolve({ id: this.lastID, row: authRow });
            }
          }
        );
      });
    });
    
    Promise.all(insertPromises)
      .then((results) => {
        // Send to external API with new format
        getExternalAPIUrl('active', (err, externalApiUrl) => {
          if (err) {
            console.error(`❌ [External API] Error getting external API URL for active status:`, err);
            return;
          }
          
          if (!externalApiUrl || externalApiUrl.trim() === '') {
            console.log(`⚠️  [External API] External API URL for active status not configured, skipping send for MO ${mo_number}`);
            return;
          }
          
          const formattedData = formatManufacturingData(
            mo_number,
            sku_name,
            targetQty,
            null, // done_qty is null for active status
            leader_name,
            null  // finished_at is null for active status
          );
          
          console.log(`📤 [External API] Sending active status for MO ${mo_number} to: ${externalApiUrl}`);
          
          sendToExternalAPIWithUrl(formattedData, externalApiUrl, 'POST')
            .then(result => {
              if (result.success) {
                console.log(`✅ [External API] Successfully sent active status for MO ${mo_number}`);
              } else {
                console.log(`⚠️  [External API] Active status send skipped for MO ${mo_number}: ${result.message}`);
              }
            })
            .catch(apiErr => {
          console.error(`❌ [External API] Failed to send active status for MO ${mo_number}:`, apiErr.message);
            });
        });
        
        res.json({ 
          message: 'Data saved successfully',
          saved_count: results.length,
          data: results.map(r => ({
            id: r.id,
            session_id,
            leader_name,
            shift_number,
            pic,
            mo_number,
            sku_name,
            authenticity_data: [r.row]
          }))
        });
      })
      .catch((err) => {
        res.status(500).json({ error: err.message });
      });
  });
});

// POST /api/production/device
router.post('/device', (req, res) => {
  const { session_id, leader_name, shift_number, pic, mo_number, sku_name, authenticity_data } = req.body;
  
  const authenticityRows = normalizeAuthenticityArray(authenticity_data);
  
  const insertPromises = authenticityRows.map((row) => {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO production_device (session_id, leader_name, shift_number, pic, mo_number, sku_name, authenticity_data, status) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')`,
        [session_id, leader_name, shift_number, pic, mo_number, sku_name, JSON.stringify([row])],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, row });
          }
        }
      );
    });
  });
  
  Promise.all(insertPromises)
    .then((results) => {
      res.json({ 
        message: 'Data saved successfully',
        saved_count: results.length,
        data: results.map(r => ({
          id: r.id,
          session_id,
          leader_name,
          shift_number,
          pic,
          mo_number,
          sku_name,
          authenticity_data: [r.row]
        }))
      });
    })
    .catch((err) => {
      res.status(500).json({ error: err.message });
    });
});

// POST /api/production/cartridge
router.post('/cartridge', (req, res) => {
  const { session_id, leader_name, shift_number, pic, mo_number, sku_name, authenticity_data } = req.body;
  
  const authenticityRows = normalizeAuthenticityArray(authenticity_data);
  
  const insertPromises = authenticityRows.map((row) => {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO production_cartridge (session_id, leader_name, shift_number, pic, mo_number, sku_name, authenticity_data, status) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')`,
        [session_id, leader_name, shift_number, pic, mo_number, sku_name, JSON.stringify([row])],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, row });
          }
        }
      );
    });
  });
  
  Promise.all(insertPromises)
    .then((results) => {
      res.json({ 
        message: 'Data saved successfully',
        saved_count: results.length,
        data: results.map(r => ({
          id: r.id,
          session_id,
          leader_name,
          shift_number,
          pic,
          mo_number,
          sku_name,
          authenticity_data: [r.row]
        }))
      });
    })
    .catch((err) => {
      res.status(500).json({ error: err.message });
    });
});

// PUT /api/production/liquid/end-session
router.put('/liquid/end-session', (req, res) => {
  const { session_id } = req.body;
  
  db.run(
    `UPDATE production_liquid SET status = 'completed' WHERE session_id = $1`,
    [session_id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Session ended successfully' });
    }
  );
});

// PUT /api/production/device/end-session
router.put('/device/end-session', (req, res) => {
  const { session_id } = req.body;
  
  db.run(
    `UPDATE production_device SET status = 'completed' WHERE session_id = $1`,
    [session_id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Session ended successfully' });
    }
  );
});

// PUT /api/production/cartridge/end-session
router.put('/cartridge/end-session', (req, res) => {
  const { session_id } = req.body;
  
  db.run(
    `UPDATE production_cartridge SET status = 'completed' WHERE session_id = $1`,
    [session_id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Session ended successfully' });
    }
  );
});

// PUT /api/production/liquid/update-status/:id
router.put('/liquid/update-status/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  if (!status || !['active', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Status must be "active" or "completed"' });
  }
  
  const completedAt = status === 'completed' ? new Date().toISOString() : null;
  
  db.get('SELECT mo_number, sku_name, leader_name FROM production_liquid WHERE id = $1', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!row) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    db.run(
      `UPDATE production_liquid SET status = $1, completed_at = $2 WHERE id = $3`,
      [status, completedAt, id],
      async function(updateErr) {
        if (updateErr) {
          return res.status(500).json({ error: updateErr.message });
        }
        
        if (status === 'completed') {
          try {
            db.get(
              `SELECT COUNT(*) as active_count FROM production_liquid 
               WHERE mo_number = $1 AND status = 'active'`,
              [row.mo_number],
              (checkErr, checkRow) => {
                if (checkErr) {
                  console.error(`❌ [External API] Error checking active inputs for MO ${row.mo_number}:`, checkErr.message);
                  return res.json({ message: 'Status updated successfully', id: id, status: status });
                }
                
                // If still has active records, auto revert all completed records for this MO
                if (checkRow && checkRow.active_count > 0) {
                  db.run(
                    `UPDATE production_liquid SET status = 'active', completed_at = NULL 
                     WHERE mo_number = $1 AND status = 'completed'`,
                    [row.mo_number],
                    function(revertErr) {
                      if (revertErr) {
                        console.error(`❌ [Auto Revert] Error reverting records for MO ${row.mo_number}:`, revertErr.message);
                        return res.json({ 
                          message: 'Status updated successfully', 
                          id: id, 
                          status: status,
                          auto_reverted: false,
                          error: 'Failed to auto revert'
                        });
                      }
                      
                      console.log(`🔄 [Auto Revert] Reverted ${this.changes} records for MO ${row.mo_number} (active_count: ${checkRow.active_count})`);
                      return res.json({ 
                        message: 'Status updated but auto reverted due to active records', 
                        id: id, 
                        status: 'active',
                        auto_reverted: true,
                        active_count: checkRow.active_count
                      });
                    }
                  );
                  return;
                }
                
                // If active_count === 0, aggregate all completed records and send to external API
                if (checkRow && checkRow.active_count === 0) {
                  db.all(
                    `SELECT authenticity_data, leader_name, completed_at 
                     FROM production_liquid 
                     WHERE mo_number = $1 AND status = 'completed'
                     ORDER BY completed_at DESC`,
                    [row.mo_number],
                    (aggErr, completedRows) => {
                      if (aggErr) {
                        console.error(`❌ [External API] Error aggregating completed records for MO ${row.mo_number}:`, aggErr.message);
                        return res.json({ message: 'Status updated successfully', id: id, status: status });
                      }
                      
                      // Calculate done_qty from all rolls
                      const doneQty = calculateDoneQty(completedRows);
                      
                      // Get target_qty from odoo_mo_cache
                      db.get('SELECT quantity FROM odoo_mo_cache WHERE mo_number = ?', [row.mo_number], (qtyErr, qtyRow) => {
                        const targetQty = (!qtyErr && qtyRow) ? (qtyRow.quantity || 0) : 0;
                        
                        // Get max completed_at and convert to Jakarta timezone
                        const maxCompletedAt = completedRows.length > 0 && completedRows[0].completed_at 
                          ? convertDBTimestampToJakarta(completedRows[0].completed_at)
                          : convertDBTimestampToJakarta(new Date());
                        
                        // Get leader_name (from first record or current row)
                        const leaderName = completedRows.length > 0 && completedRows[0].leader_name 
                          ? completedRows[0].leader_name 
                          : row.leader_name;
                        
                        // Format data for external API
                        const formattedData = formatManufacturingData(
                          row.mo_number,
                          row.sku_name,
                          targetQty,
                          doneQty,
                          leaderName,
                          maxCompletedAt
                        );
                        
                        // Get external API URL for completed status
                        getExternalAPIUrl('completed', (urlErr, externalApiUrl) => {
                          if (urlErr) {
                            console.error(`❌ [External API] Error getting external API URL for MO ${row.mo_number}:`, urlErr.message);
                            return res.json({ message: 'Status updated successfully', id: id, status: status });
                          }
                          
                          if (!externalApiUrl || externalApiUrl.trim() === '') {
                            console.log(`⚠️  [External API] External API URL for completed status not configured, skipping send for MO ${row.mo_number}`);
                            return res.json({ message: 'Status updated successfully', id: id, status: status });
                          }
                          
                          // Get manufacturing identity ID by MO number
                          getManufacturingIdentityId(row.mo_number, (idErr, manufacturingId) => {
                            if (idErr) {
                              console.error(`❌ [Submit MO] Error getting manufacturing identity ID for MO ${row.mo_number}:`, idErr.message);
                              // Continue with MO number as fallback
                            }
                            
                            // Use ID if found, otherwise use MO number as fallback
                            const identifier = manufacturingId || row.mo_number;
                            const encodedIdentifier = encodeURIComponent(identifier);
                            
                            // Construct PUT URL with ID (or MO number as fallback)
                            const baseUrl = externalApiUrl.replace(/\/$/, '');
                            let putUrl;
                            
                            if (baseUrl.toLowerCase().endsWith('/manufacturing')) {
                              putUrl = `${baseUrl}/${encodedIdentifier}`;
                            } else {
                              putUrl = `${baseUrl}/manufacturing/${encodedIdentifier}`;
                            }
                            
                            console.log(`📤 [External API] Sending completed status for MO ${row.mo_number} to: ${putUrl}`);
                            console.log(`📤 [External API] Using identifier: ${identifier} (${manufacturingId ? 'ID from database' : 'MO number as fallback'})`);
                            
                            // Send to external API with PUT method
                            sendToExternalAPIWithUrl(formattedData, putUrl, 'PUT')
                              .then(result => {
                                if (result.success) {
                                  console.log(`✅ [External API] Successfully sent completed status for MO ${row.mo_number} (ID: ${identifier})`);
                                } else {
                                  console.log(`⚠️  [External API] Completed status send skipped for MO ${row.mo_number}: ${result.message}`);
                                }
                              })
                              .catch(apiErr => {
                                console.error(`❌ [External API] Failed to send completed status for MO ${row.mo_number}:`, apiErr.message);
                              });
                          });
                          
                          res.json({ message: 'Status updated successfully', id: id, status: status });
                        });
                  });
                    }
                  );
                } else {
                  res.json({ message: 'Status updated successfully', id: id, status: status });
                }
              }
            );
          } catch (apiError) {
            console.error(`❌ [External API] Error preparing completed data for MO ${row.mo_number}:`, apiError.message);
            res.json({ message: 'Status updated successfully', id: id, status: status });
          }
        } else {
          // Status is 'active' (revert) - don't send to external API
        res.json({ message: 'Status updated successfully', id: id, status: status });
        }
      }
    );
  });
});

// PUT /api/production/liquid/submit-mo-group
// Submit all active inputs for a specific MO number (batch update)
// MO number is passed in request body to handle special characters like '/'
router.put('/liquid/submit-mo-group', (req, res) => {
  const { mo_number, session_id } = req.body;
  
  if (!mo_number) {
    return res.status(400).json({ error: 'MO number is required in request body' });
  }
  
  console.log(`\n📤 [Submit MO] ==========================================`);
  console.log(`📤 [Submit MO] PUT /liquid/submit-mo-group`);
  console.log(`📤 [Submit MO] MO Number: ${mo_number}`);
  console.log(`📤 [Submit MO] Session ID: ${session_id}`);
  console.log(`📤 [Submit MO] ==========================================\n`);
  
  // First, check if there are any active records for this MO
  db.get(
    `SELECT COUNT(*) as active_count FROM production_liquid 
     WHERE mo_number = $1 AND status = 'active'`,
    [mo_number],
    (checkErr, checkRow) => {
      if (checkErr) {
        console.error(`❌ [Submit MO] Error checking active inputs for MO ${mo_number}:`, checkErr.message);
        return res.status(500).json({ error: checkErr.message });
      }
      
      const activeCount = checkRow ? parseInt(checkRow.active_count) : 0;
      
      if (activeCount === 0) {
        return res.status(400).json({ 
          error: 'No active inputs found for this MO',
          message: 'All inputs for this MO are already completed'
        });
      }
      
      // Update all active records to completed
      db.run(
        `UPDATE production_liquid 
         SET status = 'completed', completed_at = CURRENT_TIMESTAMP 
         WHERE mo_number = $1 AND status = 'active'`,
        [mo_number],
        function(updateErr) {
          if (updateErr) {
            console.error(`❌ [Submit MO] Error updating records for MO ${mo_number}:`, updateErr.message);
            return res.status(500).json({ error: updateErr.message });
          }
          
          const updatedCount = this.changes;
          console.log(`✅ [Submit MO] Updated ${updatedCount} records for MO ${mo_number}`);
          
          // Now check again if there are any active records left (from other sessions)
          db.get(
            `SELECT COUNT(*) as active_count FROM production_liquid 
             WHERE mo_number = $1 AND status = 'active'`,
            [mo_number],
            (finalCheckErr, finalCheckRow) => {
              if (finalCheckErr) {
                console.error(`❌ [Submit MO] Error final checking active inputs for MO ${mo_number}:`, finalCheckErr.message);
                return res.json({ 
                  message: 'MO submitted successfully', 
                  mo_number: mo_number,
                  updated_count: updatedCount,
                  warning: 'Could not verify if all inputs are completed'
                });
              }
              
              const finalActiveCount = finalCheckRow ? parseInt(finalCheckRow.active_count) : 0;
              
              // If still has active records, auto revert
              if (finalActiveCount > 0) {
                db.run(
                  `UPDATE production_liquid SET status = 'active', completed_at = NULL 
                   WHERE mo_number = $1 AND status = 'completed'`,
                  [mo_number],
                  function(revertErr) {
                    if (revertErr) {
                      console.error(`❌ [Submit MO] Error reverting records for MO ${mo_number}:`, revertErr.message);
                      return res.json({ 
                        message: 'MO submitted but could not revert', 
                        mo_number: mo_number,
                        updated_count: updatedCount,
                        auto_reverted: false,
                        active_count: finalActiveCount
                      });
                    }
                    
                    console.log(`🔄 [Submit MO] Auto-reverted ${this.changes} records for MO ${mo_number} (active_count: ${finalActiveCount})`);
                    return res.json({ 
                      message: 'MO submitted but auto-reverted due to active records in other sessions', 
                      mo_number: mo_number,
                      updated_count: updatedCount,
                      auto_reverted: true,
                      active_count: finalActiveCount
                    });
                  }
                );
                return;
              }
              
              // If active_count === 0, aggregate all completed records and send to external API
              db.all(
                `SELECT authenticity_data, leader_name, completed_at, sku_name
                 FROM production_liquid 
                 WHERE mo_number = $1 AND status = 'completed'
                 ORDER BY completed_at DESC`,
                [mo_number],
                (aggErr, completedRows) => {
                  if (aggErr) {
                    console.error(`❌ [Submit MO] Error aggregating completed records for MO ${mo_number}:`, aggErr.message);
                    return res.json({ 
                      message: 'MO submitted successfully', 
                      mo_number: mo_number,
                      updated_count: updatedCount,
                      warning: 'Could not send to external API'
                    });
                  }
                  
                  // Calculate done_qty from all rolls
                  const doneQty = calculateDoneQty(completedRows);
                  
                  // Get target_qty from odoo_mo_cache
                  db.get('SELECT quantity FROM odoo_mo_cache WHERE mo_number = $1', [mo_number], (qtyErr, qtyRow) => {
                    const targetQty = (!qtyErr && qtyRow) ? (qtyRow.quantity || 0) : 0;
                    
                    // Get max completed_at and convert to Jakarta timezone
                    const maxCompletedAt = completedRows.length > 0 && completedRows[0].completed_at 
                      ? convertDBTimestampToJakarta(completedRows[0].completed_at)
                      : convertDBTimestampToJakarta(new Date());
                    
                    // Get leader_name and sku_name (from first record)
                    const leaderName = completedRows.length > 0 && completedRows[0].leader_name 
                      ? completedRows[0].leader_name 
                      : 'Unknown';
                    const skuName = completedRows.length > 0 && completedRows[0].sku_name 
                      ? completedRows[0].sku_name 
                      : 'Unknown';
                    
                    // Format data for external API
                    const formattedData = formatManufacturingData(
                      mo_number,
                      skuName,
                      targetQty,
                      doneQty,
                      leaderName,
                      maxCompletedAt
                    );
                    
                    // Get external API URL for completed status
                    getExternalAPIUrl('completed', (urlErr, externalApiUrl) => {
                      if (urlErr) {
                        console.error(`❌ [Submit MO] Error getting external API URL for MO ${mo_number}:`, urlErr.message);
                        return res.json({ 
                          message: 'MO submitted successfully', 
                          mo_number: mo_number,
                          updated_count: updatedCount,
                          warning: 'Could not send to external API'
                        });
                      }
                      
                      if (!externalApiUrl || externalApiUrl.trim() === '') {
                        console.log(`⚠️  [Submit MO] External API URL for completed status not configured, skipping send for MO ${mo_number}`);
                        return res.json({ 
                          message: 'MO submitted successfully', 
                          mo_number: mo_number,
                          updated_count: updatedCount,
                          warning: 'External API URL not configured'
                        });
                      }
                      
                      // Get manufacturing identity ID by MO number (matching with target MO number)
                      getManufacturingIdentityId(mo_number, (idErr, manufacturingId) => {
                        if (idErr) {
                          console.error(`❌ [Submit MO] Error getting manufacturing identity ID for MO ${mo_number}:`, idErr.message);
                          // Continue with MO number as fallback
                        }
                        
                        // Use ID if found, otherwise use MO number as fallback
                        const identifier = manufacturingId || mo_number;
                        const encodedIdentifier = encodeURIComponent(identifier);
                        
                        // Construct PUT URL with ID (or MO number as fallback)
                        const trimmedUrl = externalApiUrl.trim().replace(/\/$/, ''); // Remove trailing slash
                        let putUrl;
                        
                        if (trimmedUrl.toLowerCase().endsWith('/manufacturing')) {
                          // URL already contains /manufacturing, just append /:id
                          putUrl = `${trimmedUrl}/${encodedIdentifier}`;
                        } else {
                          // URL doesn't contain /manufacturing, append /manufacturing/:id
                          putUrl = `${trimmedUrl}/manufacturing/${encodedIdentifier}`;
                        }
                        
                        console.log(`📤 [Submit MO] Sending completed status for MO ${mo_number} to: ${putUrl}`);
                        console.log(`📤 [Submit MO] Base URL: ${trimmedUrl}`);
                        console.log(`📤 [Submit MO] Using identifier: ${identifier} (${manufacturingId ? 'ID from GET Manufacturing Identity' : 'MO number as fallback'})`);
                        console.log(`📤 [Submit MO] Data:`, JSON.stringify(formattedData, null, 2));
                        
                        // Send to external API with PUT method
                        sendToExternalAPIWithUrl(formattedData, putUrl, 'PUT')
                          .then(result => {
                            if (result.success) {
                              console.log(`✅ [Submit MO] Successfully sent completed status for MO ${mo_number} (ID: ${identifier})`);
                            } else {
                              console.log(`⚠️  [Submit MO] Completed status send skipped for MO ${mo_number}: ${result.message}`);
                            }
                          })
                          .catch(apiErr => {
                            console.error(`❌ [Submit MO] Failed to send completed status for MO ${mo_number}:`, apiErr.message);
                          });
                        
                        res.json({ 
                          message: 'MO submitted successfully', 
                          mo_number: mo_number,
                          updated_count: updatedCount,
                          external_api_sent: true,
                          manufacturing_id: identifier
                        });
                      });
                    });
                  });
                }
              );
            }
          );
        }
      );
    }
  );
});

// PUT /api/production/liquid/revert-mo-group/:mo_number
// Revert all inputs with the same MO number from 'completed' to 'active' (Admin only)
router.put('/liquid/revert-mo-group/:mo_number', (req, res) => {
  const { mo_number } = req.params;
  const { userRole } = req.body; // Admin check - should be sent from frontend
  
  // Check if user is admin
  if (!userRole || userRole !== 'admin') {
    return res.status(403).json({ 
      error: 'Forbidden: Admin access required',
      message: 'Only admin users can revert MO groups'
    });
  }
  
  db.run(
    `UPDATE production_liquid SET status = 'active', completed_at = NULL 
     WHERE mo_number = $1 AND status = 'completed'`,
    [mo_number],
    function(err) {
      if (err) {
        console.error(`❌ [Revert MO Group] Error reverting MO ${mo_number}:`, err.message);
        return res.status(500).json({ error: err.message });
      }
      
      if (this.changes === 0) {
        return res.json({ 
          message: 'No completed records found to revert', 
          mo_number: mo_number,
          reverted_count: 0
        });
      }
      
      console.log(`🔄 [Revert MO Group] Admin reverted ${this.changes} records for MO ${mo_number}`);
      res.json({ 
        message: `Successfully reverted ${this.changes} record(s) for MO ${mo_number}`, 
        mo_number: mo_number,
        reverted_count: this.changes
      });
    }
  );
});

// PUT /api/production/device/update-status/:id
router.put('/device/update-status/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  if (!status || !['active', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Status must be "active" or "completed"' });
  }
  
  const completedAt = status === 'completed' ? new Date().toISOString() : null;
  
  db.run(
    `UPDATE production_device SET status = $1, completed_at = $2 WHERE id = $3`,
    [status, completedAt, id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Status updated successfully', id: id, status: status });
    }
  );
});

// PUT /api/production/cartridge/update-status/:id
router.put('/cartridge/update-status/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  if (!status || !['active', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Status must be "active" or "completed"' });
  }
  
  const completedAt = status === 'completed' ? new Date().toISOString() : null;
  
  db.run(
    `UPDATE production_cartridge SET status = $1, completed_at = $2 WHERE id = $3`,
    [status, completedAt, id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Status updated successfully', id: id, status: status });
    }
  );
});

// PUT /api/production/liquid/:id
router.put('/liquid/:id', (req, res) => {
  const { id } = req.params;
  const { pic, mo_number, sku_name, authenticity_data } = req.body;
  
  const updates = [];
  const values = [];
  
  if (pic !== undefined) {
    updates.push(`pic = $${values.length + 1}`);
    values.push(pic);
  }
  if (mo_number !== undefined) {
    updates.push(`mo_number = $${values.length + 1}`);
    values.push(mo_number);
  }
  if (sku_name !== undefined) {
    updates.push(`sku_name = $${values.length + 1}`);
    values.push(sku_name);
  }
  if (authenticity_data !== undefined) {
    updates.push(`authenticity_data = $${values.length + 1}`);
    values.push(JSON.stringify(normalizeAuthenticityArray(authenticity_data)));
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  
  values.push(id);
  
  db.run(
    `UPDATE production_liquid SET ${updates.join(', ')} WHERE id = $${values.length}`,
    values,
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Data updated successfully', id: id });
    }
  );
});

// PUT /api/production/device/:id
router.put('/device/:id', (req, res) => {
  const { id } = req.params;
  const { pic, mo_number, sku_name, authenticity_data } = req.body;
  
  const updates = [];
  const values = [];
  
  if (pic !== undefined) {
    updates.push(`pic = $${values.length + 1}`);
    values.push(pic);
  }
  if (mo_number !== undefined) {
    updates.push(`mo_number = $${values.length + 1}`);
    values.push(mo_number);
  }
  if (sku_name !== undefined) {
    updates.push(`sku_name = $${values.length + 1}`);
    values.push(sku_name);
  }
  if (authenticity_data !== undefined) {
    updates.push(`authenticity_data = $${values.length + 1}`);
    values.push(JSON.stringify(normalizeAuthenticityArray(authenticity_data)));
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  
  values.push(id);
  
  db.run(
    `UPDATE production_device SET ${updates.join(', ')} WHERE id = $${values.length}`,
    values,
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Data updated successfully', id: id });
    }
  );
});

// PUT /api/production/cartridge/:id
router.put('/cartridge/:id', (req, res) => {
  const { id } = req.params;
  const { pic, mo_number, sku_name, authenticity_data } = req.body;
  
  const updates = [];
  const values = [];
  
  if (pic !== undefined) {
    updates.push(`pic = $${values.length + 1}`);
    values.push(pic);
  }
  if (mo_number !== undefined) {
    updates.push(`mo_number = $${values.length + 1}`);
    values.push(mo_number);
  }
  if (sku_name !== undefined) {
    updates.push(`sku_name = $${values.length + 1}`);
    values.push(sku_name);
  }
  if (authenticity_data !== undefined) {
    updates.push(`authenticity_data = $${values.length + 1}`);
    values.push(JSON.stringify(normalizeAuthenticityArray(authenticity_data)));
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  
  values.push(id);
  
  db.run(
    `UPDATE production_cartridge SET ${updates.join(', ')} WHERE id = $${values.length}`,
    values,
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Data updated successfully', id: id });
    }
  );
});

// GET /api/production/check-mo-used
router.get('/check-mo-used', (req, res) => {
  const { moNumber, productionType } = req.query;
  
  if (!moNumber) {
    return res.status(400).json({ error: 'moNumber parameter is required' });
  }
  
  const type = productionType || 'liquid';
  const table = `production_${type}`;
  
  db.all(
    `SELECT id, session_id, leader_name, shift_number, pic, status, created_at 
     FROM ${table} 
     WHERE mo_number = $1
     ORDER BY created_at DESC`,
    [moNumber],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (rows && rows.length > 0) {
        const activeCount = rows.filter(r => r.status === 'active').length;
        const completedCount = rows.filter(r => r.status === 'completed').length;
        
        return res.json({
          used: true,
          count: rows.length,
          activeCount,
          completedCount,
          records: rows,
          message: `MO ${moNumber} telah digunakan ${rows.length} kali (${activeCount} active, ${completedCount} completed)`
        });
      } else {
        return res.json({
          used: false,
          count: 0,
          activeCount: 0,
          completedCount: 0,
          records: [],
          message: `MO ${moNumber} belum pernah digunakan`
        });
      }
    }
  );
});

// GET /api/production/combined (also accessible as /api/combined-production)
router.get('/combined', (req, res) => {
  const { moNumber, mo_number, created_at, production_type, startDate, endDate, start_date, end_date } = req.query;
  
  // Support both moNumber and mo_number for backward compatibility
  const finalMoNumber = moNumber || mo_number;
  const finalStartDate = startDate || start_date;
  const finalEndDate = endDate || end_date;
  
  let query = 'SELECT * FROM production_combined WHERE 1=1';
  const params = [];
  
  if (finalMoNumber) {
    query += ' AND mo_number = $' + (params.length + 1);
    params.push(finalMoNumber);
  }
  if (created_at) {
    query += ' AND created_at::date = $' + (params.length + 1) + '::date';
    params.push(created_at);
  }
  if (finalStartDate) {
    query += ' AND created_at::date >= $' + (params.length + 1) + '::date';
    params.push(finalStartDate);
  }
  if (finalEndDate) {
    query += ' AND created_at::date <= $' + (params.length + 1) + '::date';
    params.push(finalEndDate);
  }
  if (production_type) {
    query += ' AND production_type = $' + (params.length + 1);
    params.push(production_type);
  }
  
  query += ' ORDER BY created_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const parsedRows = rows.map(row => {
      try {
        return {
          ...row,
          authenticity_data: typeof row.authenticity_data === 'string' 
            ? JSON.parse(row.authenticity_data) 
            : row.authenticity_data
        };
      } catch (e) {
        return {
          ...row,
          authenticity_data: []
        };
      }
    });
    
    res.json({
      count: parsedRows.length,
      data: parsedRows
    });
  });
});

// POST /api/production/combined
router.post('/combined', (req, res) => {
  const { production_type, session_id, leader_name, shift_number, pic, mo_number, sku_name, authenticity_data, status } = req.body;
  
  if (!production_type || !['liquid', 'device', 'cartridge'].includes(production_type)) {
    res.status(400).json({ error: 'production_type is required and must be: liquid, device, or cartridge' });
    return;
  }
  
  if (!session_id || !leader_name || !shift_number || !pic || !mo_number || !sku_name || !authenticity_data) {
    res.status(400).json({ error: 'Missing required fields: session_id, leader_name, shift_number, pic, mo_number, sku_name, authenticity_data' });
    return;
  }
  
  const authenticityRows = Array.isArray(authenticity_data) ? authenticity_data : [authenticity_data];
  
  const insertPromises = authenticityRows.map((row) => {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO production_combined (production_type, session_id, leader_name, shift_number, pic, mo_number, sku_name, authenticity_data, status) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          production_type,
          session_id,
          leader_name,
          shift_number,
          pic,
          mo_number,
          sku_name,
          JSON.stringify([row]),
          status || 'active'
        ],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, row });
          }
        }
      );
    });
  });
  
  Promise.all(insertPromises)
    .then((results) => {
      res.json({ 
        message: 'Data saved successfully',
        saved_count: results.length,
        data: results.map(r => ({
          id: r.id,
          production_type,
          session_id,
          leader_name,
          shift_number,
          pic,
          mo_number,
          sku_name,
          authenticity_data: [r.row],
          status: status || 'active'
        }))
      });
    })
    .catch((err) => {
      res.status(500).json({ error: err.message });
    });
});

// POST /api/production/combined/sync
router.post('/combined/sync', (req, res) => {
  const { production_type } = req.body;
  
  let sourceTable = '';
  if (production_type === 'liquid') {
    sourceTable = 'production_liquid';
  } else if (production_type === 'device') {
    sourceTable = 'production_device';
  } else if (production_type === 'cartridge') {
    sourceTable = 'production_cartridge';
  } else {
    res.status(400).json({ error: 'production_type must be: liquid, device, or cartridge' });
    return;
  }
  
  db.all(`SELECT * FROM ${sourceTable}`, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (rows.length === 0) {
      res.json({ message: 'No data to sync', synced_count: 0 });
      return;
    }
    
    const checkPromises = rows.map(row => {
      return new Promise((resolve) => {
        db.get(
          `SELECT id FROM production_combined WHERE production_type = $1 AND session_id = $2 AND mo_number = $3 AND pic = $4 AND created_at = $5`,
          [production_type, row.session_id, row.mo_number, row.pic, row.created_at],
          (err, existing) => {
            resolve({ row, exists: !!existing });
          }
        );
      });
    });
    
    Promise.all(checkPromises).then(results => {
      const newRows = results.filter(r => !r.exists).map(r => r.row);
      
      if (newRows.length === 0) {
        res.json({ message: 'All data already synced', synced_count: 0 });
        return;
      }
      
      const insertPromises = newRows.map((row) => {
        return new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO production_combined (production_type, session_id, leader_name, shift_number, pic, mo_number, sku_name, authenticity_data, status, created_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              production_type,
              row.session_id,
              row.leader_name,
              row.shift_number,
              row.pic,
              row.mo_number,
              row.sku_name,
              row.authenticity_data,
              row.status || 'active',
              row.created_at
            ],
            function(err) {
              if (err) {
                reject(err);
              } else {
                resolve(this.lastID);
              }
            }
          );
        });
      });
      
      Promise.all(insertPromises)
        .then(() => {
          res.json({ 
            message: 'Data synced successfully',
            synced_count: newRows.length,
            total_in_source: rows.length
          });
        })
        .catch((err) => {
          res.status(500).json({ error: err.message });
        });
    });
  });
});

module.exports = router;
