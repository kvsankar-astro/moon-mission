/**
 * Time/Date Utilities Module
 *
 * Provides pure functions for date formatting, time calculations,
 * and UTC date component extraction for astronomical calculations.
 *
 * Design: All functions are pure (no side effects) and work with
 * JavaScript Date objects or UTC timestamps in milliseconds.
 */

/**
 * Create a UTC timestamp from configuration date components.
 * @param {Object} config - Configuration object with date components
 * @param {string|number} config.year - Year (e.g., 2023)
 * @param {string|number} config.month - Month (1-12)
 * @param {string|number} config.day - Day of month (1-31)
 * @param {string|number} config.hour - Hour (0-23)
 * @param {string|number} config.minute - Minute (0-59)
 * @returns {number} UTC timestamp in milliseconds
 */
export function dateFromConfigComponents(config) {
    return Date.UTC(
        parseInt(config.year),
        parseInt(config.month) - 1,  // JavaScript months are 0-indexed
        parseInt(config.day),
        parseInt(config.hour),
        parseInt(config.minute),
        0,
        0
    );
}

/**
 * Create a UTC timestamp from individual date/time values.
 * @param {number} year - Year (e.g., 2023)
 * @param {number} month - Month (1-12, will be converted to 0-indexed)
 * @param {number} day - Day of month (1-31)
 * @param {number} hour - Hour (0-23)
 * @param {number} minute - Minute (0-59)
 * @returns {number} UTC timestamp in milliseconds
 */
export function createUTCTimestamp(year, month, day, hour, minute) {
    return Date.UTC(year, month - 1, day, hour, minute, 0, 0);
}

/**
 * Extract UTC date components from a Date or timestamp.
 * Used for astronomical ephemeris calculations.
 * @param {Date|number} dateOrTimestamp - Date object or UTC timestamp in ms
 * @returns {Object} Object with year, month, day, hours, minutes, seconds
 */
export function getDateComponentsUTC(dateOrTimestamp) {
    const date = typeof dateOrTimestamp === 'number'
        ? new Date(dateOrTimestamp)
        : dateOrTimestamp;

    return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,  // Convert back to 1-indexed
        day: date.getUTCDate(),
        hours: date.getUTCHours(),
        minutes: date.getUTCMinutes(),
        seconds: date.getUTCSeconds()
    };
}

/**
 * Format a date for display in IST (India Standard Time).
 * IST is UTC+5:30.
 * @param {Date|number} dateOrTimestamp - Date object or UTC timestamp in ms
 * @returns {string} Formatted date string (e.g., "Sat Jul 14 2023 14:53:00 IST")
 */
export function formatDateTimeIST(dateOrTimestamp) {
    const date = typeof dateOrTimestamp === 'number'
        ? new Date(dateOrTimestamp)
        : dateOrTimestamp;

    // Use Intl.DateTimeFormat for IST timezone
    const options = {
        timeZone: 'Asia/Kolkata',
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };

    return date.toLocaleString('en-IN', options) + ' IST';
}

/**
 * Format a date for display in UTC.
 * @param {Date|number} dateOrTimestamp - Date object or UTC timestamp in ms
 * @returns {string} Formatted date string (e.g., "Fri, 03 Apr, 2026, 21:56:00 UTC")
 */
export function formatDateTimeUTC(dateOrTimestamp) {
    const date = typeof dateOrTimestamp === 'number'
        ? new Date(dateOrTimestamp)
        : dateOrTimestamp;

    const options = {
        timeZone: 'UTC',
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };

    return date.toLocaleString('en-GB', options) + ' UTC';
}

/**
 * Format just the date portion for display in IST.
 * @param {Date|number} dateOrTimestamp - Date object or UTC timestamp in ms
 * @returns {string} Formatted date string (e.g., "14 Jul 2023")
 */
export function formatDateOnly(dateOrTimestamp) {
    const date = typeof dateOrTimestamp === 'number'
        ? new Date(dateOrTimestamp)
        : dateOrTimestamp;

    const options = {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'short',
        day: '2-digit'
    };

    return date.toLocaleDateString('en-IN', options);
}

/**
 * Format just the time portion for display in IST.
 * @param {Date|number} dateOrTimestamp - Date object or UTC timestamp in ms
 * @returns {string} Formatted time string (e.g., "14:53:00")
 */
export function formatTimeOnly(dateOrTimestamp) {
    const date = typeof dateOrTimestamp === 'number'
        ? new Date(dateOrTimestamp)
        : dateOrTimestamp;

    const options = {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };

    return date.toLocaleTimeString('en-IN', options);
}

/**
 * Format a duration in milliseconds as human-readable string.
 * @param {number} durationMs - Duration in milliseconds
 * @param {Object} [options] - Formatting options
 * @param {boolean} [options.includeSeconds=true] - Include seconds in output
 * @param {boolean} [options.compact=false] - Use compact format (1d 2h 3m vs "1 day, 2 hours, 3 minutes")
 * @returns {string} Formatted duration string
 */
export function formatDuration(durationMs, options = {}) {
    const { includeSeconds = true, compact = false } = options;

    const absMs = Math.abs(durationMs);
    const sign = durationMs < 0 ? '-' : '';

    const days = Math.floor(absMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor((absMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((absMs % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((absMs % (60 * 1000)) / 1000);

    const parts = [];

    if (compact) {
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (includeSeconds && seconds > 0) parts.push(`${seconds}s`);
        return sign + (parts.length > 0 ? parts.join(' ') : '0s');
    } else {
        if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
        if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
        if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
        if (includeSeconds && seconds > 0) parts.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);
        return sign + (parts.length > 0 ? parts.join(', ') : '0 seconds');
    }
}

/**
 * Get hours and minutes from a Date or timestamp.
 * @param {Date|number} dateOrTimestamp - Date object or UTC timestamp in ms
 * @param {boolean} [utc=true] - Whether to use UTC (true) or local time (false)
 * @returns {Object} Object with hours and minutes
 */
export function getHoursMinutes(dateOrTimestamp, utc = true) {
    const date = typeof dateOrTimestamp === 'number'
        ? new Date(dateOrTimestamp)
        : dateOrTimestamp;

    if (utc) {
        return {
            hours: date.getUTCHours(),
            minutes: date.getUTCMinutes()
        };
    } else {
        return {
            hours: date.getHours(),
            minutes: date.getMinutes()
        };
    }
}

/**
 * Pad a number with leading zeros.
 * @param {number} num - Number to pad
 * @param {number} [length=2] - Desired string length
 * @returns {string} Zero-padded string
 */
export function padZero(num, length = 2) {
    return String(num).padStart(length, '0');
}

/**
 * Format time as HH:MM:SS.
 * @param {number} hours - Hours (0-23)
 * @param {number} minutes - Minutes (0-59)
 * @param {number} [seconds=0] - Seconds (0-59)
 * @returns {string} Formatted time string (e.g., "14:53:00")
 */
export function formatHMS(hours, minutes, seconds = 0) {
    return `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}`;
}

/**
 * Calculate elapsed time between two timestamps.
 * @param {number} startMs - Start timestamp in milliseconds
 * @param {number} endMs - End timestamp in milliseconds
 * @returns {Object} Object with days, hours, minutes, seconds, totalMs
 */
export function calculateElapsedTime(startMs, endMs) {
    const totalMs = endMs - startMs;
    const absMs = Math.abs(totalMs);

    return {
        days: Math.floor(absMs / (24 * 60 * 60 * 1000)),
        hours: Math.floor((absMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000)),
        minutes: Math.floor((absMs % (60 * 60 * 1000)) / (60 * 1000)),
        seconds: Math.floor((absMs % (60 * 1000)) / 1000),
        totalMs: totalMs
    };
}
