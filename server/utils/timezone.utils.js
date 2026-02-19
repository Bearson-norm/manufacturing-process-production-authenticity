/**
 * Timezone utility functions
 * Converts timestamps to Jakarta timezone (Asia/Jakarta, UTC+7)
 */

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
  
  // Use Intl.DateTimeFormat to get Jakarta time
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(date);
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  const hour = parts.find(p => p.type === 'hour').value;
  const minute = parts.find(p => p.type === 'minute').value;
  const second = parts.find(p => p.type === 'second').value;
  
  // Get milliseconds
  const ms = date.getMilliseconds().toString().padStart(3, '0');
  
  return `${year}-${month}-${day}T${hour}:${minute}:${second}.${ms}+07:00`;
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
  
  // Create a date object in Jakarta timezone
  // Use toLocaleString to get Jakarta time, then parse it
  const jakartaString = date.toLocaleString('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  // Parse the Jakarta time string
  // Format: "MM/DD/YYYY, HH:mm:ss"
  const [datePart, timePart] = jakartaString.split(', ');
  const [month, day, year] = datePart.split('/');
  const [hour, minute, second] = timePart.split(':');
  
  // Get milliseconds from original date
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  
  // Return in ISO format with Jakarta timezone offset
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}.${ms}+07:00`;
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
  convertDBTimestampToJakarta,
  getCurrentJakartaTime
};
