// utils/logger.js
// Structured color-coded logger with file output and Express request middleware
const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  try {
    fs.mkdirSync(logsDir, { recursive: true });
  } catch (e) {
    // ignore
  }
}

const logFilePath = path.join(logsDir, 'server.log');

// ANSI Color Codes
const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
};

function formatTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const padMs = (n) => String(n).padStart(3, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${padMs(d.getMilliseconds())}`;
}

function writeToFile(level, message, meta) {
  try {
    const timestamp = formatTimestamp();
    const metaStr = meta ? (typeof meta === 'object' ? ` ${JSON.stringify(meta)}` : ` ${meta}`) : '';
    const line = `[${timestamp}] [${level}] ${message}${metaStr}\n`;
    fs.appendFileSync(logFilePath, line, 'utf8');
  } catch (err) {
    // ignore file write errors
  }
}

const logger = {
  info(msg, meta) {
    const ts = formatTimestamp();
    const metaStr = meta ? ` ${colors.dim}${JSON.stringify(meta)}${colors.reset}` : '';
    console.log(`${colors.dim}[${ts}]${colors.reset} ${colors.green}[INFO]${colors.reset} ${msg}${metaStr}`);
    writeToFile('INFO', msg, meta);
  },

  warn(msg, meta) {
    const ts = formatTimestamp();
    const metaStr = meta ? ` ${colors.dim}${JSON.stringify(meta)}${colors.reset}` : '';
    console.warn(`${colors.dim}[${ts}]${colors.reset} ${colors.yellow}[WARN]${colors.reset} ${msg}${metaStr}`);
    writeToFile('WARN', msg, meta);
  },

  error(msg, err) {
    const ts = formatTimestamp();
    const errDetails = err ? (err.stack || err.message || JSON.stringify(err)) : '';
    console.error(`${colors.dim}[${ts}]${colors.reset} ${colors.red}[ERROR]${colors.reset} ${msg} ${colors.red}${errDetails}${colors.reset}`);
    writeToFile('ERROR', `${msg} ${errDetails}`);
  },

  debug(msg, meta) {
    const ts = formatTimestamp();
    const metaStr = meta ? ` ${colors.dim}${JSON.stringify(meta)}${colors.reset}` : '';
    console.log(`${colors.dim}[${ts}]${colors.reset} ${colors.cyan}[DEBUG]${colors.reset} ${msg}${metaStr}`);
    writeToFile('DEBUG', msg, meta);
  },

  // Express Request Logger Middleware
  requestLogger(req, res, next) {
    const start = Date.now();
    const { method, originalUrl, ip } = req;

    // Log incoming request
    const ts = formatTimestamp();
    const sanitizedBody = req.body && Object.keys(req.body).length > 0 ? { ...req.body } : null;
    if (sanitizedBody && sanitizedBody.password) delete sanitizedBody.password;

    console.log(
      `${colors.dim}[${ts}]${colors.reset} ${colors.magenta}[HTTP IN]${colors.reset} ${colors.bright}${method}${colors.reset} ${originalUrl}` +
      (sanitizedBody ? ` ${colors.dim}${JSON.stringify(sanitizedBody)}${colors.reset}` : '')
    );
    writeToFile('HTTP IN', `${method} ${originalUrl}`, sanitizedBody);

    // Hook into response finish to log response status & duration
    res.on('finish', () => {
      const duration = Date.now() - start;
      const status = res.statusCode;
      const statusColor =
        status >= 500 ? colors.red :
        status >= 400 ? colors.yellow :
        status >= 300 ? colors.cyan : colors.green;

      console.log(
        `${colors.dim}[${formatTimestamp()}]${colors.reset} ${colors.blue}[HTTP OUT]${colors.reset} ${method} ${originalUrl} ` +
        `${statusColor}${status}${colors.reset} (${duration}ms)`
      );
      writeToFile('HTTP OUT', `${method} ${originalUrl} ${status} (${duration}ms)`);
    });

    next();
  },
};

module.exports = logger;
