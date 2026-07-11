import axios from 'axios';

const MO_BATCH_CHUNK_SIZE = 500;

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Fetch buffer + reject maps for many MO numbers (chunked to avoid 400/timeouts).
 * @param {'liquid'|'device'|'cartridge'} productionType
 * @param {string[]} moNumbers
 */
export async function fetchBufferRejectBatchMaps(productionType, moNumbers) {
  const unique = [...new Set(
    (moNumbers || []).map((m) => String(m || '').trim()).filter(Boolean)
  )];

  if (unique.length === 0) {
    return { bufferMap: {}, rejectMap: {} };
  }

  const bufferMap = {};
  const rejectMap = {};
  const chunks = chunkArray(unique, MO_BATCH_CHUNK_SIZE);

  for (const chunk of chunks) {
    const [bufferRes, rejectRes] = await Promise.all([
      axios.post(`/api/buffer/${productionType}/batch`, { moNumbers: chunk }).catch((err) => {
        const msg = err.response?.data?.error || err.message;
        console.error(`Error fetching buffer batch (${productionType}):`, msg);
        return { data: {} };
      }),
      axios.post(`/api/reject/${productionType}/batch`, { moNumbers: chunk }).catch((err) => {
        const msg = err.response?.data?.error || err.message;
        console.error(`Error fetching reject batch (${productionType}):`, msg);
        return { data: {} };
      })
    ]);

    Object.entries(bufferRes.data || {}).forEach(([mo, rows]) => {
      if (Array.isArray(rows) && rows.length > 0) {
        bufferMap[mo] = rows;
      }
    });

    Object.entries(rejectRes.data || {}).forEach(([mo, rows]) => {
      if (Array.isArray(rows) && rows.length > 0) {
        rejectMap[mo] = rows;
      }
    });
  }

  return { bufferMap, rejectMap };
}
