/**
 * Timezone utility functions
 * Converts timestamps to Jakarta timezone (Asia/Jakarta, UTC+7)
 */

/**
 * YYYY-MM-DDTHH:mm:ss.sss+07:00 in Asia/Jakarta.
 * hourCycle h23 avoids invalid "hour 24" (RFC3339 / Go reject T24:...).
 * @param {Date} date
 * @returns {string|null}
 */
function formatDateAsJakartaRFC3339(date) {
  if (!date || isNaN(date.getTime())) return null;

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23'
  });

  const parts = formatter.formatToParts(date);
  const y = parts.find((p) => p.type === 'year').value;
  const mo = parts.find((p) => p.type === 'month').value;
  const d = parts.find((p) => p.type === 'day').value;
  const h = parts.find((p) => p.type === 'hour').value;
  const mi = parts.find((p) => p.type === 'minute').value;
  const s = parts.find((p) => p.type === 'second').value;

  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${y}-${mo}-${d}T${h.padStart(2, '0')}:${mi.padStart(2, '0')}:${s.padStart(2, '0')}.${ms}+07:00`;
}

/**
 * Convert a timestamp to Jakarta timezone ISO string
 * @param {Date|string} timestamp - The timestamp to convert
 * @returns {string} ISO string in Jakarta timezone
 */
function toJakartaISO(timestamp) {
  if (!timestamp) return null;
  
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  
  if (isNaN(date.getTime())) {
    return null;
  }
  
  // Convert to Jakarta timezone (UTC+7)
  const jakartaDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  
  // Calculate offset in milliseconds (Jakarta is UTC+7)
  const offset = (jakartaDate.getTime() - utcDate.getTime()) + (7 * 60 * 60 * 1000);
  
  // Create new date with Jakarta timezone
  const jakartaTime = new Date(date.getTime() + offset);
  
  // Format as ISO string but replace Z with +07:00
  const isoString = jakartaTime.toISOString();
  return isoString.replace('Z', '+07:00');
}

/**
 * Format timestamp to Jakarta timezone string (YYYY-MM-DDTHH:mm:ss+07:00)
 * @param {Date|string} timestamp - The timestamp to format
 * @returns {string} Formatted string in Jakarta timezone
 */
function formatJakartaTime(timestamp) {
  if (!timestamp) return null;

  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

  if (isNaN(date.getTime())) {
    return null;
  }

  return formatDateAsJakartaRFC3339(date);
}

/**
 * Convert database timestamp to Jakarta timezone
 * PostgreSQL returns timestamps in UTC, this converts them to Jakarta time
 * @param {Date|string} dbTimestamp - Timestamp from database
 * @returns {string} ISO string in Jakarta timezone
 */
function convertDBTimestampToJakarta(dbTimestamp) {
  if (!dbTimestamp) return null;

  const date = dbTimestamp instanceof Date ? dbTimestamp : new Date(dbTimestamp);

  if (isNaN(date.getTime())) {
    return null;
  }

  return formatDateAsJakartaRFC3339(date);
}

/**
 * Get current time in Jakarta timezone
 * @returns {string} Current time in Jakarta timezone ISO format
 */
function getCurrentJakartaTime() {
  return formatJakartaTime(new Date());
}

module.exports = {
  toJakartaISO,
  formatJakartaTime,
  formatDateAsJakartaRFC3339,
  convertDBTimestampToJakarta,
  getCurrentJakartaTime
};
