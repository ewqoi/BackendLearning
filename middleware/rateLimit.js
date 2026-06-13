const { AppError } = require('../utils/error');
const ApiResponse = require('../utils/response');
const { logger } = require('../utils/logger');

const rateLimitStore = new Map();

function cleanupExpiredRecords() {
  const now = Date.now();
  for (const [key, record] of rateLimitStore) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

setInterval(cleanupExpiredRecords, 60000);

function rateLimit(options = {}) {
  const {
    windowMs = 60 * 1000,
    max = 100,
    message = '请求过于频繁，请稍后再试',
    keyGenerator = (req) => req.ip || req.connection.remoteAddress,
    skip = () => false,
    handler = null
  } = options;

  return (req, res, next) => {
    if (skip(req)) {
      return next();
    }

    const key = keyGenerator(req);
    const now = Date.now();
    const resetTime = now + windowMs;

    let record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime,
        firstRequest: now
      };
      rateLimitStore.set(key, record);
    } else {
      record.count++;
    }

    const remaining = Math.max(0, max - record.count);
    const resetTimeSeconds = Math.ceil((record.resetTime - now) / 1000);

    res.set({
      'X-RateLimit-Limit': max,
      'X-RateLimit-Remaining': remaining,
      'X-RateLimit-Reset': resetTimeSeconds
    });

    if (record.count > max) {
      logger.warn(`限流触发: ${key}`, {
        path: req.path,
        count: record.count,
        limit: max
      });

      if (handler) {
        return handler(req, res, next);
      }

      return next(AppError.tooManyRequests(message));
    }

    next();
  };
}

function strictRateLimit(options = {}) {
  return rateLimit({
    windowMs: 0.01 * 1000,
    max: 20,
    message: '操作过于频繁，请 1 分钟后再试',
    ...options
  });
}

function apiRateLimit(options = {}) {
  return rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: 'API 请求过于频繁，请稍后再试',
    ...options
  });
}

function authRateLimit(options = {}) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: '登录尝试次数过多，请 15 分钟后再试',
    keyGenerator: (req) => `auth_${req.ip}_${req.body?.email || ''}`,
    ...options
  });
}

function uploadRateLimit(options = {}) {
  return rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: '上传请求过于频繁，请稍后再试',
    ...options
  });
}

function createRateLimitMiddleware(type = 'api') {
  const limiters = {
    api: apiRateLimit,
    strict: strictRateLimit,
    auth: authRateLimit,
    upload: uploadRateLimit
  };

  return limiters[type] ? limiters[type]() : apiRateLimit();
}

module.exports = {
  rateLimit,
  strictRateLimit,
  apiRateLimit,
  authRateLimit,
  uploadRateLimit,
  createRateLimitMiddleware
};
