import React from 'react';
import { getMoDisplayTag, getMoDisplayTagLabel } from '../utils/moListHelpers';

function MoInfoDisplay({ mo, formatDateIndonesia, productionType = 'liquid' }) {
  if (!mo) {
    return null;
  }

  const displayTag = getMoDisplayTag(mo, productionType);
  const tagLabel = getMoDisplayTagLabel(productionType);

  return (
    <div className="mo-info-display">
      <p><strong>SKU Name:</strong> {mo.sku_name}</p>
      {displayTag ? (
        <p><strong>{tagLabel}:</strong> {displayTag}</p>
      ) : null}
      <p><strong>Quantity:</strong> {mo.quantity} {mo.uom}</p>
      <p><strong>Created:</strong> {formatDateIndonesia(mo.create_date)}</p>
    </div>
  );
}

export default MoInfoDisplay;
