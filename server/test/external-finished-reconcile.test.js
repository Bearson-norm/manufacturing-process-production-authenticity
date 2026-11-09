const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { classifyMesRowAgainstLocal } = require('../utils/liquid-finished-reconcile');
const {
  extractManufacturingListPage,
  nextManufacturingListUrl
} = require('../utils/manufacturing-list-page');

const completed = { active_rows: 0, completed_rows: 2 };

describe('classifyMesRowAgainstLocal', () => {
  it('patches idle and started when the MO is fully completed locally', () => {
    assert.equal(
      classifyMesRowAgainstLocal(
        { id: 'uuid-1', manufacturing_id: 'MOPROD/MO/43440', status: 'idle', sku_name: 'COLA 30ML' },
        completed
      ).action,
      'wouldPatch'
    );
    assert.equal(
      classifyMesRowAgainstLocal(
        { id: 'uuid-1', manufacturing_id: 'MOPROD/MO/43440', status: 'started', sku_name: 'COLA 30ML' },
        completed
      ).action,
      'wouldPatch'
    );
  });

  it('does not finish an MO that still has an active local row', () => {
    assert.equal(
      classifyMesRowAgainstLocal(
        { id: 'uuid-1', manufacturing_id: 'MOPROD/MO/43440', status: 'idle', sku_name: 'COLA 30ML' },
        { active_rows: 1, completed_rows: 1 }
      ).action,
      'skippedActive'
    );
  });

  it('leaves an already finished match alone and skips excluded SKUs', () => {
    assert.equal(
      classifyMesRowAgainstLocal(
        { id: 'uuid-1', manufacturing_id: 'MOPROD/MO/1', status: 'finished', sku_name: 'COLA 30ML' },
        completed
      ).action,
      'alreadyMatched'
    );
    assert.equal(
      classifyMesRowAgainstLocal(
        { id: 'uuid-1', manufacturing_id: 'MOPROD/MO/1', status: 'idle', sku_name: 'COLA 15 ML' },
        completed
      ).action,
      'skippedExcluded'
    );
  });

  it('skips open remote rows with no local production', () => {
    assert.equal(
      classifyMesRowAgainstLocal(
        { id: 'uuid-1', manufacturing_id: 'MOPROD/MO/9', status: 'started', sku_name: 'COLA 30ML' },
        null
      ).action,
      'skippedNoLocal'
    );
  });
});

describe('manufacturing list pages', () => {
  it('treats a bare array as a single page', () => {
    const info = extractManufacturingListPage([{ id: 'a', manufacturing_id: 'MOPROD/MO/1' }]);
    assert.equal(info.rows.length, 1);
    assert.equal(nextManufacturingListUrl('https://mes.example/api/v1/manufacturing', info), null);
  });

  it('follows links.next and meta.last_page', () => {
    const base = 'https://mes.example/api/v1/manufacturing';
    const fromLink = extractManufacturingListPage({
      data: [{ id: 'a' }],
      links: { next: '/api/v1/manufacturing?page=2' },
      meta: { current_page: 1, last_page: 3 }
    });
    assert.equal(nextManufacturingListUrl(base, fromLink), 'https://mes.example/api/v1/manufacturing?page=2');

    const fromMeta = extractManufacturingListPage({
      data: [{ id: 'b' }],
      meta: { current_page: 2, last_page: 3 }
    });
    assert.equal(nextManufacturingListUrl(`${base}?page=2`, fromMeta), 'https://mes.example/api/v1/manufacturing?page=3');
  });
});
