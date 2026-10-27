/**
 * QR scan sessions (Input QR Code Cartridge) — parallel sessions, one barcode per unit.
 */
module.exports = {
  async up(client) {
    await client.query(`
      CREATE SEQUENCE IF NOT EXISTS qr_scan_session_number_seq
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS qr_scan_session (
        id SERIAL PRIMARY KEY,
        session_number INTEGER NOT NULL DEFAULT nextval('qr_scan_session_number_seq') UNIQUE,
        pic TEXT NOT NULL,
        production_type TEXT NOT NULL DEFAULT 'cartridge',
        status TEXT NOT NULL DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'finished')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        finished_at TIMESTAMPTZ
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS qr_scan_item (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES qr_scan_session(id) ON DELETE RESTRICT,
        production_type TEXT NOT NULL DEFAULT 'cartridge',
        barcode TEXT NOT NULL,
        scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        client_scan_id TEXT,
        CONSTRAINT qr_scan_item_session_barcode_key UNIQUE (session_id, barcode),
        CONSTRAINT qr_scan_item_production_type_barcode_key UNIQUE (production_type, barcode),
        CONSTRAINT qr_scan_item_session_client_scan_key UNIQUE (session_id, client_scan_id)
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS qr_scan_session_status_created_idx
        ON qr_scan_session (status, created_at DESC)
    `);
  },
};
