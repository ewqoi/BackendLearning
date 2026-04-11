const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../logs');
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4
};

const LOG_COLORS = {
  DEBUG: '\x1b[36m',
  INFO: '\x1b[32m',
  WARN: '\x1b[33m',
  ERROR: '\x1b[31m',
  FATAL: '\x1b[35m',
  RESET: '\x1b[0m'
};

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

class Logger {
  constructor(options = {}) {
    this.level = options.level || (process.env.NODE_ENV === 'production' ? 'INFO' : 'DEBUG');
    this.enableFile = options.enableFile !== false;
    this.enableConsole = options.enableConsole !== false;
    this.logFile = path.join(LOG_DIR, `app-${new Date().toISOString().split('T')[0]}.log`);
    this.errorFile = path.join(LOG_DIR, `error-${new Date().toISOString().split('T')[0]}.log`);
  }

  shouldLog(level) {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] ${message}${metaStr}`;
  }

  writeToFile(filename, content) {
    if (this.enableFile) {
      fs.appendFileSync(filename, content + '\n', 'utf8');
    }
  }

  log(level, message, meta = {}) {
    if (!this.shouldLog(level)) return;

    const formatted = this.formatMessage(level, message, meta);
    const color = LOG_COLORS[level] || '';

    if (this.enableConsole) {
      console.log(`${color}${formatted}${LOG_COLORS.RESET}`);
    }

    this.writeToFile(this.logFile, formatted);

    if (level === 'ERROR' || level === 'FATAL') {
      this.writeToFile(this.errorFile, formatted);
    }
  }

  debug(message, meta = {}) {
    this.log('DEBUG', message, meta);
  }

  info(message, meta = {}) {
    this.log('INFO', message, meta);
  }

  warn(message, meta = {}) {
    this.log('WARN', message, meta);
  }

  error(message, meta = {}) {
    this.log('ERROR', message, meta);
  }

  fatal(message, meta = {}) {
    this.log('FATAL', message, meta);
  }

  request(req, res, responseTime) {
    const meta = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      responseTime: `${responseTime}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent')
    };

    if (res.statusCode >= 400) {
      this.warn(`HTTP ${req.method} ${req.originalUrl}`, meta);
    } else {
      this.info(`HTTP ${req.method} ${req.originalUrl}`, meta);
    }
  }
}

const logger = new Logger();

function requestLogger(req, res, next) {
  const startTime = Date.now();

  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    logger.request(req, res, responseTime);
  });

  next();
}

function logRequestDetails(req, res, next) {
  if (process.env.NODE_ENV === 'development') {
    logger.debug('请求详情', {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      query: req.query,
      body: req.body,
      params: req.params
    });
  }
  next();
}

module.exports = {
  Logger,
  logger,
  requestLogger,
  logRequestDetails
};
