const express = require('express');
const router = express.Router();
const { db } = require('../database');
const {
  parseAuthenticityData,
  normalizeAuthenticityArray,
  validateProductionAuthRowVendorDigits,
  loadActiveVendorMapDb
} = require('../utils/authenticity.utils');
const {
  ensureLiquidExternalIdAndPatchStarted,
  finalizeLiquidManufacturingExternal
} = require('../services/liquid-external-manufacturing.service');
const {
  enqueueSyncSourceRow,
  enqueueSyncSession,
  enqueueSyncMo,
} = require('../services/production-results-sync.service');
const { calculateDoneQty, formatManufacturingData } = require('../utils/liquid-manufacturing-payload');
const {
  matchesLiquidVariant,
  parseLiquidVariant,
  isExcludedFromExternalLiquidManufacturing,
  isLiquid15MlSku,
} = require('../utils/liquid-sku.helpers');

function loadActiveVendorMap(callback) {
  loadActiveVendorMapDb(db, callback);
}

function validateRowsVendorDigits(rows, vendorMap, res) {
  for (const row of rows) {
    const msg = validateProductionAuthRowVendorDigits(row, vendorMap);
    if (msg) {
      res.status(400).json({ error: msg });
      return false;
    }
  }
  return true;
}

// Guard: drop rows identical to already-saved active/draft rows (double submit protection).
// Calls back with (err, rowsToInsert, skippedCount).
function filterDuplicateActiveRows(table, moNumber, rows, callback, statusList = ['active']) {
  const statuses = Array.isArray(statusList) && statusList.length > 0 ? statusList : ['active'];
  const placeholders = statuses.map((_, i) => `$${i + 2}`).join(', ');
  const checks = rows.map(row => new Promise((resolve, reject) => {
    db.get(
      `SELECT id FROM ${table} WHERE status IN (${placeholders}) AND mo_number = $1 AND authenticity_data = $${statuses.length + 2}`,
      [moNumber, ...statuses, JSON.stringify([row])],
      (err, existing) => {
        if (err) {
          reject(err);
        } else {
          resolve(existing ? null : row);
        }
      }
    );
  }));

  Promise.all(checks)
    .then(results => {
      const rowsToInsert = results.filter(Boolean);
      callback(null, rowsToInsert, rows.length - rowsToInsert.length);
    })
    .catch(err => callback(err));
}

/** Active MO in session (started locally) — blocks new drafts. */
function getSessionActiveMo(sessionId, callback) {
  db.get(
    `SELECT mo_number FROM production_liquid
     WHERE session_id = $1 AND status = 'active'
     ORDER BY created_at DESC
     LIMIT 1`,
    [sessionId],
    callback
  );
}

function sessionHasDraftRows(sessionId, callback) {
  db.get(
    `SELECT id FROM production_liquid
     WHERE session_id = $1 AND status = 'draft'
     LIMIT 1`,
    [sessionId],
    (err, row) => {
      if (err) return callback(err);
      callback(null, Boolean(row));
    }
  );
}

function sessionHasDraftForMo(sessionId, moNumber, callback) {
  db.get(
    `SELECT id FROM production_liquid
     WHERE session_id = $1 AND mo_number = $2 AND status = 'draft'
     LIMIT 1`,
    [sessionId, moNumber],
    (err, row) => {
      if (err) return callback(err);
      callback(null, Boolean(row));
    }
  );
}

/** Hapus draft hanya untuk MO tertentu (draft MO lain di session tetap ada). */
function deleteSessionDraftsForMo(sessionId, moNumber, callback) {
  db.run(
    `DELETE FROM production_liquid WHERE session_id = $1 AND mo_number = $2 AND status = 'draft'`,
    [sessionId, moNumber],
    function(err) {
      callback(err, this ? this.changes : 0);
    }
  );
}

function insertLiquidRows(session_id, leader_name, shift_number, pic, mo_number, sku_name, rowsToInsert, status) {
  return Promise.all(rowsToInsert.map((authRow) => {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO production_liquid (session_id, leader_name, shift_number, pic, mo_number, sku_name, authenticity_data, status) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [session_id, leader_name, shift_number, pic, mo_number, sku_name, JSON.stringify([authRow]), status],
        function(insertErr) {
          if (insertErr) {
            reject(insertErr);
          } else {
            enqueueSyncSourceRow('liquid', this.lastID);
            resolve({ id: this.lastID, row: authRow });
          }
        }
      );
    });
  }));
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

// GET /api/production/liquid?variant=15ml|30ml
router.get('/liquid', (req, res) => {
  const variant = parseLiquidVariant(req.query.variant);
  if (req.query.variant != null && req.query.variant !== '' && variant == null) {
    return res.status(400).json({ error: 'Invalid variant. Use 15ml or 30ml.' });
  }

  db.all('SELECT * FROM production_liquid ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    let parsedRows = rows.map(parseAuthenticityData);
    if (variant) {
      parsedRows = parsedRows.filter((row) => matchesLiquidVariant(row.sku_name, variant));
    }
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

// GET /api/production/active-mo-status
// Latest active MO per production type by created_at (input time), not update time
router.get('/active-mo-status', (req, res) => {
  const types = [
    { key: 'device', table: 'production_device' },
    { key: 'cartridge', table: 'production_cartridge' }
  ];

  const fetchLatestActive = (table) => new Promise((resolve, reject) => {
    db.get(
      `SELECT mo_number, sku_name, session_id, leader_name, shift_number, pic, created_at
       FROM ${table}
       WHERE status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
      (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      }
    );
  });

  const fetchLatestLiquidActive = (variant) => new Promise((resolve, reject) => {
    db.all(
      `SELECT mo_number, sku_name, session_id, leader_name, shift_number, pic, created_at
       FROM production_liquid
       WHERE status = 'active'
       ORDER BY created_at DESC`,
      (err, rows) => {
        if (err) reject(err);
        else {
          const match = (rows || []).find((r) => matchesLiquidVariant(r.sku_name, variant));
          resolve(match || null);
        }
      }
    );
  });

  Promise.all([
    fetchLatestLiquidActive('15ml'),
    fetchLatestLiquidActive('30ml'),
    ...types.map((t) => fetchLatestActive(t.table)),
  ])
    .then(([liquid15, liquid30, device, cartridge]) => {
      res.json({
        liquid_15: liquid15,
        liquid_30: liquid30,
        // legacy key: prefer 30ml then 15ml for older clients
        liquid: liquid30 || liquid15,
        device,
        cartridge,
      });
    })
    .catch((err) => {
      res.status(500).json({ error: err.message });
    });
});

// GET /api/production/report
router.get('/report', (req, res) => {
  const { type, mo_number, pic, date_from, date_to, status, limit, offset } = req.query;
  const MAX_LIMIT = 500;
  const DEFAULT_LIMIT = 100;
  let limitNum = parseInt(limit, 10);
  if (Number.isNaN(limitNum) || limitNum <= 0) limitNum = DEFAULT_LIMIT;
  if (limitNum > MAX_LIMIT) limitNum = MAX_LIMIT;
  let offsetNum = parseInt(offset, 10);
  if (Number.isNaN(offsetNum) || offsetNum < 0) offsetNum = 0;

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

    // Cap per-table fetch so multi-type reports stay bounded, then merge+slice
    const perTableLimit = Math.min(MAX_LIMIT, offsetNum + limitNum);
    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
    params.push(perTableLimit);

    db.all(query, params, (err, rows) => {
      if (err) {
        console.error(`Error querying ${table.name}:`, err);
      } else {
        allResults.push(...rows);
      }

      completedQueries++;

      if (completedQueries === tables.length) {
        allResults.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const paginatedResults = allResults.slice(offsetNum, offsetNum + limitNum);

        res.json({
          success: true,
          total: allResults.length,
          limit: limitNum,
          offset: offsetNum,
          max_limit: MAX_LIMIT,
          data: paginatedResults,
        });
      }
    });
  });

  if (tables.length === 0) {
    res.status(400).json({
      success: false,
      error: 'Invalid production type',
    });
  }
});

// POST /api/production/liquid
// save_mode: draft | confirm | confirm_draft (default: confirm for backward compatibility)
router.post('/liquid', (req, res) => {
  const {
    session_id,
    leader_name,
    shift_number,
    pic,
    mo_number,
    sku_name,
    authenticity_data,
    save_mode: rawSaveMode,
    variant: rawVariant,
  } = req.body;

  const saveMode = String(rawSaveMode || 'confirm').toLowerCase().trim();
  if (!['draft', 'confirm', 'confirm_draft'].includes(saveMode)) {
    return res.status(400).json({ error: 'save_mode must be draft, confirm, or confirm_draft' });
  }

  const variant = parseLiquidVariant(rawVariant);
  if (rawVariant != null && rawVariant !== '' && variant == null) {
    return res.status(400).json({ error: 'Invalid variant. Use 15ml or 30ml.' });
  }
  const effectiveVariant = variant || (isLiquid15MlSku(sku_name) ? '15ml' : '30ml');

  if (!session_id || !mo_number) {
    return res.status(400).json({ error: 'session_id and mo_number are required' });
  }

  if (!matchesLiquidVariant(sku_name, effectiveVariant)) {
    return res.status(400).json({
      error: `SKU tidak sesuai halaman liquid ${effectiveVariant}`,
    });
  }

  const authenticityRows = normalizeAuthenticityArray(authenticity_data);

  loadActiveVendorMap((mapErr, vendorMap) => {
    if (mapErr) {
      return res.status(500).json({ error: mapErr.message });
    }
    if (!validateRowsVendorDigits(authenticityRows, vendorMap, res)) {
      return;
    }

    getSessionActiveMo(session_id, (activeErr, activeRow) => {
      if (activeErr) {
        return res.status(500).json({ error: activeErr.message });
      }

      const activeMo = activeRow ? activeRow.mo_number : null;

      sessionHasDraftRows(session_id, (draftErr, hasDraft) => {
        if (draftErr) {
          return res.status(500).json({ error: draftErr.message });
        }

        // While MO is active/started: Save Draft OK (MO lain), Confirm / Confirm Draft ditolak
        if (activeMo && saveMode !== 'draft') {
          return res.status(409).json({
            error: `Session masih punya MO ${activeMo} berstatus active/started. Confirm Draft / Confirm Input tidak bisa sampai MO itu di-submit atau session diakhiri. Anda masih bisa Save Draft untuk MO lain.`,
          });
        }

        if (activeMo && saveMode === 'draft' && mo_number === activeMo) {
          return res.status(409).json({
            error: `MO ${activeMo} sudah active. Gunakan Edit untuk mengubah data MO ini, atau pilih MO lain untuk Save Draft.`,
          });
        }

        if (saveMode === 'confirm' && hasDraft) {
          return res.status(400).json({
            error: 'Masih ada draft di session ini. Gunakan Confirm Draft pada kartu draft di daftar, atau Save Draft untuk menambah draft MO lain.',
          });
        }

        if (saveMode === 'confirm_draft') {
          return sessionHasDraftForMo(session_id, mo_number, (moDraftErr, hasMoDraft) => {
            if (moDraftErr) {
              return res.status(500).json({ error: moDraftErr.message });
            }
            if (!hasMoDraft) {
              return res.status(400).json({
                error: `Belum ada draft untuk MO ${mo_number}. Save Draft dulu untuk MO ini, atau Confirm Input jika belum pernah draft.`,
              });
            }
            proceedInsert();
          });
        }

        proceedInsert();

        function proceedInsert() {
        const dupStatuses = ['active'];

        filterDuplicateActiveRows(
          'production_liquid',
          mo_number,
          authenticityRows,
          (dupErr, rowsToInsert, skippedCount) => {
            if (dupErr) {
              return res.status(500).json({ error: dupErr.message });
            }
            if (rowsToInsert.length === 0) {
              return res.status(409).json({
                error: 'Data authenticity yang sama sudah tersimpan (kemungkinan double submit).',
              });
            }

            const finishInsert = (status, triggerStarted) => {
              db.get('SELECT quantity FROM odoo_mo_cache WHERE mo_number = ?', [mo_number], (err, row) => {
                const targetQty = (!err && row) ? (row.quantity || 0) : 0;

                insertLiquidRows(
                  session_id,
                  leader_name,
                  shift_number,
                  pic,
                  mo_number,
                  sku_name,
                  rowsToInsert,
                  status
                )
                  .then((results) => {
                    if (triggerStarted && !isExcludedFromExternalLiquidManufacturing(sku_name)) {
                      ensureLiquidExternalIdAndPatchStarted(mo_number, sku_name, targetQty, leader_name, () => {});
                    }

                    res.json({
                      message: status === 'draft' ? 'Draft saved successfully' : 'Data saved successfully',
                      save_mode: saveMode,
                      status,
                      saved_count: results.length,
                      skipped_duplicates: skippedCount,
                      data: results.map(r => ({
                        id: r.id,
                        session_id,
                        leader_name,
                        shift_number,
                        pic,
                        mo_number,
                        sku_name,
                        authenticity_data: [r.row],
                        status,
                      })),
                    });
                  })
                  .catch((insertErr) => {
                    res.status(500).json({ error: insertErr.message });
                  });
              });
            };

            if (saveMode === 'draft') {
              // Hanya replace draft untuk MO ini — draft MO lain tetap ada
              deleteSessionDraftsForMo(session_id, mo_number, (delErr) => {
                if (delErr) {
                  return res.status(500).json({ error: delErr.message });
                }
                finishInsert('draft', false);
              });
              return;
            }

            if (saveMode === 'confirm_draft') {
              // Promote draft MO ini saja; draft MO lain tidak dihapus
              deleteSessionDraftsForMo(session_id, mo_number, (delErr) => {
                if (delErr) {
                  return res.status(500).json({ error: delErr.message });
                }
                const triggerStarted = !isExcludedFromExternalLiquidManufacturing(sku_name);
                finishInsert('active', triggerStarted);
              });
              return;
            }

            // confirm (tanpa draft) → active + started
            const triggerStarted = !isExcludedFromExternalLiquidManufacturing(sku_name);
            finishInsert('active', triggerStarted);
          },
          dupStatuses
        );
        }
      });
    });
  });
});

// POST /api/production/device
router.post('/device', (req, res) => {
  const { session_id, leader_name, shift_number, pic, mo_number, sku_name, authenticity_data } = req.body;

  const authenticityRows = normalizeAuthenticityArray(authenticity_data);

  loadActiveVendorMap((mapErr, vendorMap) => {
    if (mapErr) {
      return res.status(500).json({ error: mapErr.message });
    }
    if (!validateRowsVendorDigits(authenticityRows, vendorMap, res)) {
      return;
    }

    filterDuplicateActiveRows('production_device', mo_number, authenticityRows, (dupErr, rowsToInsert, skippedCount) => {
      if (dupErr) {
        return res.status(500).json({ error: dupErr.message });
      }
      if (rowsToInsert.length === 0) {
        return res.status(409).json({
          error: 'Data authenticity yang sama sudah tersimpan (kemungkinan double submit).'
        });
      }

      const insertPromises = rowsToInsert.map((row) => {
        return new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO production_device (session_id, leader_name, shift_number, pic, mo_number, sku_name, authenticity_data, status) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'active') RETURNING id`,
            [session_id, leader_name, shift_number, pic, mo_number, sku_name, JSON.stringify([row])],
            function(err) {
              if (err) {
                reject(err);
              } else {
                enqueueSyncSourceRow('device', this.lastID);
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
            skipped_duplicates: skippedCount,
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
});

// POST /api/production/cartridge
router.post('/cartridge', (req, res) => {
  const { session_id, leader_name, shift_number, pic, mo_number, sku_name, authenticity_data } = req.body;

  const authenticityRows = normalizeAuthenticityArray(authenticity_data);

  loadActiveVendorMap((mapErr, vendorMap) => {
    if (mapErr) {
      return res.status(500).json({ error: mapErr.message });
    }
    if (!validateRowsVendorDigits(authenticityRows, vendorMap, res)) {
      return;
    }

    filterDuplicateActiveRows('production_cartridge', mo_number, authenticityRows, (dupErr, rowsToInsert, skippedCount) => {
      if (dupErr) {
        return res.status(500).json({ error: dupErr.message });
      }
      if (rowsToInsert.length === 0) {
        return res.status(409).json({
          error: 'Data authenticity yang sama sudah tersimpan (kemungkinan double submit).'
        });
      }

      const insertPromises = rowsToInsert.map((row) => {
        return new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO production_cartridge (session_id, leader_name, shift_number, pic, mo_number, sku_name, authenticity_data, status) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'active') RETURNING id`,
            [session_id, leader_name, shift_number, pic, mo_number, sku_name, JSON.stringify([row])],
            function(err) {
              if (err) {
                reject(err);
              } else {
                enqueueSyncSourceRow('cartridge', this.lastID);
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
            skipped_duplicates: skippedCount,
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
});

// PUT /api/production/liquid/end-session
router.put('/liquid/end-session', (req, res) => {
  const { session_id } = req.body;
  
  db.run(
    `UPDATE production_liquid SET status = 'completed', completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP)
     WHERE session_id = $1 AND status IN ('active', 'draft')`,
    [session_id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      enqueueSyncSession('liquid', session_id);
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
      enqueueSyncSession('device', session_id);
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
      enqueueSyncSession('cartridge', session_id);
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

        enqueueSyncSourceRow('liquid', id);
        
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
                      enqueueSyncMo('liquid', row.mo_number);
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
                    `SELECT authenticity_data, leader_name, completed_at, sku_name
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
                        
                        const finishedSource =
                          completedRows.length > 0 && completedRows[0].completed_at
                            ? completedRows[0].completed_at
                            : new Date();

                        const leaderName = completedRows.length > 0 && completedRows[0].leader_name
                          ? completedRows[0].leader_name
                          : row.leader_name;

                        const skuForExternal =
                          completedRows.length > 0 && completedRows[0].sku_name
                            ? completedRows[0].sku_name
                            : row.sku_name;
                        const formattedData = formatManufacturingData(
                          row.mo_number,
                          skuForExternal,
                          targetQty,
                          doneQty,
                          leaderName,
                          finishedSource
                        );

                        finalizeLiquidManufacturingExternal(row.mo_number, formattedData, (_finErr, finResult) => {
                          res.json({
                            message: 'Status updated successfully',
                            id: id,
                            status: status,
                            external_api_verified: !!(finResult && finResult.verified)
                          });
                        });
                      });
                    });
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
          enqueueSyncMo('liquid', mo_number);
          
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
                    enqueueSyncMo('liquid', mo_number);
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
                    
                    const finishedSource =
                      completedRows.length > 0 && completedRows[0].completed_at
                        ? completedRows[0].completed_at
                        : new Date();

                    const leaderName = completedRows.length > 0 && completedRows[0].leader_name
                      ? completedRows[0].leader_name
                      : 'Unknown';
                    const skuName = completedRows.length > 0 && completedRows[0].sku_name
                      ? completedRows[0].sku_name
                      : 'Unknown';

                    const formattedData = formatManufacturingData(
                      mo_number,
                      skuName,
                      targetQty,
                      doneQty,
                      leaderName,
                      finishedSource
                    );

                    finalizeLiquidManufacturingExternal(mo_number, formattedData, (_finErr, finResult) => {
                      res.json({
                        message: 'MO submitted successfully',
                        mo_number: mo_number,
                        updated_count: updatedCount,
                        external_api_sent: true,
                        external_api_verified: !!(finResult && finResult.verified)
                      });
                    });
                  });
                });
            });
        }
      );
    }
  );
});

// PUT /api/production/liquid/revert-mo-group/:mo_number
// Revert all inputs with the same MO number from 'completed' to 'active' (Admin only)
router.put('/liquid/revert-mo-group/:mo_number', (req, res) => {
  const { mo_number } = req.params;
  // Role must come from JWT (requireAuth + requireRole), never from request body
  if (!req.user || req.user.role !== 'admin') {
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
      enqueueSyncMo('liquid', mo_number);
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
      enqueueSyncSourceRow('device', id);
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
      enqueueSyncSourceRow('cartridge', id);
      res.json({ message: 'Status updated successfully', id: id, status: status });
    }
  );
});

// PUT /api/production/liquid/:id
router.put('/liquid/:id', (req, res) => {
  const { id } = req.params;
  const { pic, mo_number, sku_name, authenticity_data } = req.body;

  const normalizedAuth =
    authenticity_data !== undefined ? normalizeAuthenticityArray(authenticity_data) : null;

  const runUpdate = () => {
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
    if (normalizedAuth !== null) {
      updates.push(`authenticity_data = $${values.length + 1}`);
      values.push(JSON.stringify(normalizedAuth));
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
        enqueueSyncSourceRow('liquid', id);
        res.json({ message: 'Data updated successfully', id: id });
      }
    );
  };

  if (normalizedAuth !== null) {
    loadActiveVendorMap((mapErr, vendorMap) => {
      if (mapErr) {
        return res.status(500).json({ error: mapErr.message });
      }
      if (!validateRowsVendorDigits(normalizedAuth, vendorMap, res)) {
        return;
      }
      runUpdate();
    });
  } else {
    runUpdate();
  }
});

// PUT /api/production/device/:id
router.put('/device/:id', (req, res) => {
  const { id } = req.params;
  const { pic, mo_number, sku_name, authenticity_data } = req.body;

  const normalizedAuth =
    authenticity_data !== undefined ? normalizeAuthenticityArray(authenticity_data) : null;

  const runUpdate = () => {
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
    if (normalizedAuth !== null) {
      updates.push(`authenticity_data = $${values.length + 1}`);
      values.push(JSON.stringify(normalizedAuth));
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
        enqueueSyncSourceRow('device', id);
        res.json({ message: 'Data updated successfully', id: id });
      }
    );
  };

  if (normalizedAuth !== null) {
    loadActiveVendorMap((mapErr, vendorMap) => {
      if (mapErr) {
        return res.status(500).json({ error: mapErr.message });
      }
      if (!validateRowsVendorDigits(normalizedAuth, vendorMap, res)) {
        return;
      }
      runUpdate();
    });
  } else {
    runUpdate();
  }
});

// PUT /api/production/cartridge/:id
router.put('/cartridge/:id', (req, res) => {
  const { id } = req.params;
  const { pic, mo_number, sku_name, authenticity_data } = req.body;

  const normalizedAuth =
    authenticity_data !== undefined ? normalizeAuthenticityArray(authenticity_data) : null;

  const runUpdate = () => {
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
    if (normalizedAuth !== null) {
      updates.push(`authenticity_data = $${values.length + 1}`);
      values.push(JSON.stringify(normalizedAuth));
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
        enqueueSyncSourceRow('cartridge', id);
        res.json({ message: 'Data updated successfully', id: id });
      }
    );
  };

  if (normalizedAuth !== null) {
    loadActiveVendorMap((mapErr, vendorMap) => {
      if (mapErr) {
        return res.status(500).json({ error: mapErr.message });
      }
      if (!validateRowsVendorDigits(normalizedAuth, vendorMap, res)) {
        return;
      }
      runUpdate();
    });
  } else {
    runUpdate();
  }
});

// GET /api/production/check-mo-used
router.get('/check-mo-used', (req, res) => {
  const { moNumber, productionType } = req.query;
  const { resolveProductionTable } = require('../middleware/auth.middleware');
  
  if (!moNumber) {
    return res.status(400).json({ error: 'moNumber parameter is required' });
  }
  
  const resolved = resolveProductionTable(productionType, 'liquid');
  if (!resolved) {
    return res.status(400).json({
      error: 'Invalid productionType. Allowed: liquid, device, cartridge',
    });
  }
  const { table } = resolved;
  
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
  const {
    moNumber, mo_number, created_at, production_type,
    startDate, endDate, start_date, end_date, limit, offset,
  } = req.query;

  const finalMoNumber = moNumber || mo_number;
  const finalStartDate = startDate || start_date;
  const finalEndDate = endDate || end_date;
  const MAX_LIMIT = 500;
  const DEFAULT_LIMIT = 100;
  let limitNum = parseInt(limit, 10);
  if (Number.isNaN(limitNum) || limitNum <= 0) limitNum = DEFAULT_LIMIT;
  if (limitNum > MAX_LIMIT) limitNum = MAX_LIMIT;
  let offsetNum = parseInt(offset, 10);
  if (Number.isNaN(offsetNum) || offsetNum < 0) offsetNum = 0;

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

  query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
  params.push(limitNum, offsetNum);

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error querying production_combined:', err);
      res.status(500).json({ success: false, error: 'Database error' });
      return;
    }

    const parsedRows = rows.map((row) => {
      try {
        return {
          ...row,
          authenticity_data:
            typeof row.authenticity_data === 'string'
              ? JSON.parse(row.authenticity_data)
              : row.authenticity_data,
        };
      } catch (e) {
        return { ...row, authenticity_data: [] };
      }
    });

    res.json({
      success: true,
      count: parsedRows.length,
      limit: limitNum,
      offset: offsetNum,
      max_limit: MAX_LIMIT,
      data: parsedRows,
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

  const authenticityRows = normalizeAuthenticityArray(authenticity_data);

  loadActiveVendorMap((mapErr, vendorMap) => {
    if (mapErr) {
      return res.status(500).json({ error: mapErr.message });
    }
    if (!validateRowsVendorDigits(authenticityRows, vendorMap, res)) {
      return;
    }

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
