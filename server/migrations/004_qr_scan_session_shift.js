/**
 * Add shift_number to QR scan sessions.
 */
module.exports = {
  async up(client) {
    await client.query(`
      ALTER TABLE qr_scan_session
      ADD COLUMN IF NOT EXISTS shift_number TEXT
    `);

    await client.query(`
      UPDATE qr_scan_session
      SET shift_number = '0'
      WHERE shift_number IS NULL
    `);

    await client.query(`
      ALTER TABLE qr_scan_session
      ALTER COLUMN shift_number SET NOT NULL
    `);
  },
};
