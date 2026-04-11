const cors = require('cors');
const { logger } = require('../utils/logger');

const defaultOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Request-ID',
    'X-Idempotency-Key',
    'X-Request-Signature',
    'X-Request-Timestamp'
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-Request-ID'
  ],
  credentials: true,
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

function corsMiddleware(options = {}) {
  const finalOptions = {
    ...defaultOptions,
    ...options
  };

  if (Array.isArray(finalOptions.origin)) {
    finalOptions.origin = (origin, callback) => {
      if (!origin || finalOptions.origin.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`CORS 拒绝来源: ${origin}`);
        callback(new Error('不允许的来源'));
      }
    };
  }

  return cors(finalOptions);
}

function strictCors(options = {}) {
  const allowedOrigins = options.origins || [process.env.ALLOWED_ORIGIN || 'http://localhost:3000'];
  
  return cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`严格 CORS 拒绝来源: ${origin}`);
        callback(new Error('不允许的来源'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  });
}

function apiCors(options = {}) {
  return cors({
    origin: options.origin || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 3600
  });
}

function securityHeaders(req, res, next) {
  res.removeHeader('X-Powered-By');
  
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
  });
  
  next();
}

function requestId(req, res, next) {
  const requestId = req.get('X-Request-ID') || 
    Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  
  req.requestId = requestId;
  res.set('X-Request-ID', requestId);
  
  next();
}

module.exports = {
  corsMiddleware,
  strictCors,
  apiCors,
  securityHeaders,
  requestId
};
