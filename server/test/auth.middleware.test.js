const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('auth.middleware', () => {
  it('safeEqualStrings is timing-safe and rejects mismatches', () => {
    const { safeEqualStrings } = require('../middleware/auth.middleware');
    assert.equal(safeEqualStrings('abc', 'abc'), true);
    assert.equal(safeEqualStrings('abc', 'abd'), false);
    assert.equal(safeEqualStrings('abc', 'abcd'), false);
    assert.equal(safeEqualStrings(null, 'abc'), false);
  });

  it('assertAuthConfigOrThrow fails closed without JWT in staging', () => {
    const prev = { ...process.env };
    process.env.NODE_ENV = 'staging';
    delete process.env.JWT_SECRET;
    process.env.ADMIN_PASSWORD = 'x';
    process.env.PRODUCTION_PASSWORD = 'y';
    delete require.cache[require.resolve('../middleware/auth.middleware')];
    const { assertAuthConfigOrThrow } = require('../middleware/auth.middleware');
    assert.throws(() => assertAuthConfigOrThrow(), /JWT_SECRET/);
    process.env = prev;
    delete require.cache[require.resolve('../middleware/auth.middleware')];
  });

  it('requireRole denies production role for admin routes', () => {
    const { requireRole } = require('../middleware/auth.middleware');
    const mw = requireRole('admin');
    let statusCode = null;
    let body = null;
    const req = { user: { role: 'production', username: 'production' } };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        body = payload;
        return this;
      },
    };
    let nextCalled = false;
    mw(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(statusCode, 403);
    assert.equal(body.success, false);
  });
});
