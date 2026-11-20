/**
 * LifeLink — Simple Logger Utility
 * 
 * Provides colored, timestamped console logging.
 * Keeps things simple — no external logging libraries needed.
 */

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

/**
 * Get a formatted timestamp string.
 * @returns {string} e.g. "2024-09-09 22:30:15"
 */
const getTimestamp = () => {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
};

const logger = {
  info: (message) => {
    console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.green}INFO${colors.reset}  ${message}`);
  },

  warn: (message) => {
    console.warn(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.yellow}WARN${colors.reset}  ${message}`);
  },

  error: (message) => {
    console.error(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.red}ERROR${colors.reset} ${message}`);
  },

  debug: (message) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.cyan}DEBUG${colors.reset} ${message}`);
    }
  }
};

module.exports = logger;
