import React from 'react';
import { calculateSingleAuthenticityRow } from '../utils/productionCalculations';

function AuthenticityRowActionCell({
  row,
  isRowEmpty,
  isValidated,
  isInvalid,
  invalidMessage,
  onValidate
}) {
  const hasFirst = row?.firstAuthenticity?.trim();
  const hasLast = row?.lastAuthenticity?.trim();
  const showHasil = Boolean(hasFirst && hasLast);
  const rowHasil = showHasil ? calculateSingleAuthenticityRow(row) : 0;
  const formula = showHasil
    ? `(${row.lastAuthenticity} - ${row.firstAuthenticity} + 1) = ${rowHasil}`
    : '';

  return (
    <div className="authenticity-row-action">
      {showHasil && !isValidated && (
        <span className="authenticity-row-input-hasil" title={formula}>
          Hasil: {rowHasil}
        </span>
      )}
      {isValidated ? (
        <div className="validation-status-indicator validated" title={formula || 'Validated'}>
          ✓ Valid{showHasil ? ` · ${rowHasil}` : ''}
        </div>
      ) : isInvalid ? (
        <div
          className="validation-status-indicator invalid"
          title={invalidMessage || formula || 'Invalid'}
        >
          ✗ Invalid{showHasil ? ` · ${rowHasil}` : ''}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => !isRowEmpty && onValidate()}
          className={`validate-button ${isRowEmpty ? 'hidden' : ''}`}
          title={showHasil ? `${formula} — klik Validate` : 'Validate row'}
          disabled={isRowEmpty}
        >
          Validate
        </button>
      )}
    </div>
  );
}

export default AuthenticityRowActionCell;
