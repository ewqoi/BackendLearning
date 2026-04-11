const crypto = require('crypto');
const { AppError } = require('../utils/error');
const ApiResponse = require('../utils/response');
const { logger } = require('../utils/logger');

const requestCache = new Map();

function generateRequestKey(req) {
  const body = JSON.stringify(req.body || {});
  const query = JSON.stringify(req.query || {});
  const params = JSON.stringify(req.params || {});
  const userId = req.user?.id || req.ip || 'anonymous';
  
  const content = `${req.method}:${req.originalUrl}:${body}:${query}:${params}:${userId}`;
  return crypto.createHash('md5').update(content).digest('hex');
}

function cleanupExpiredCache() {
  const now = Date.now();
  for (const [key, record] of requestCache) {
    if (now > record.expireTime) {
      requestCache.delete(key);
    }
  }
}

setInterval(cleanupExpiredCache, 30000);

function preventDuplicateSubmit(options = {}) {
  const {
    windowMs = 3000,
    message = '请勿重复提交',
    errorCode = 429
  } = options;

  return (req, res, next) => {
    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      return next();
    }

    const key = generateRequestKey(req);
    const now = Date.now();

    const cached = requestCache.get(key);

    if (cached && now < cached.expireTime) {
      logger.warn(`重复提交拦截: ${req.method} ${req.originalUrl}`, {
        ip: req.ip,
        body: req.body
      });

      return next(AppError.tooManyRequests(message));
    }

    requestCache.set(key, {
      expireTime: now + windowMs,
      timestamp: now
    });

    next();
  };
}

function idempotencyKey(options = {}) {
  const {
    headerName = 'X-Idempotency-Key',
    windowMs = 24 * 60 * 60 * 1000,
    message = '重复的幂等性请求'
  } = options;

  const responseCache = new Map();

  return async (req, res, next) => {
    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      return next();
    }

    const idempotencyKey = req.get(headerName);

    if (!idempotencyKey) {
      return next();
    }

    const cached = responseCache.get(idempotencyKey);

    if (cached) {
      logger.info(`幂等性请求命中: ${idempotencyKey}`);
      return res.status(cached.status).json(cached.response);
    }

    const originalJson = res.json.bind(res);
    const originalStatus = res.status.bind(res);

    res.json = (body) => {
      if (idempotencyKey && res.statusCode < 400) {
        responseCache.set(idempotencyKey, {
          status: res.statusCode,
          response: body,
          expireTime: Date.now() + windowMs
        });
      }
      return originalJson(body);
    };

    next();
  };
}

function requestSignature(options = {}) {
  const {
    headerName = 'X-Request-Signature',
    timestampHeader = 'X-Request-Timestamp',
    secret = process.env.REQUEST_SECRET || 'default-secret-key',
    maxAge = 5 * 60 * 1000,
    skipMethods = ['GET', 'HEAD', 'OPTIONS']
  } = options;

  return (req, res, next) => {
    if (skipMethods.includes(req.method)) {
      return next();
    }

    const signature = req.get(headerName);
    const timestamp = req.get(timestampHeader);

    if (!signature || !timestamp) {
      return next();
    }

    const requestTime = parseInt(timestamp);
    if (isNaN(requestTime) || Date.now() - requestTime > maxAge) {
      return next(AppError.badRequest('请求已过期'));
    }

    const body = JSON.stringify(req.body || {});
    const data = `${req.method}${req.originalUrl}${timestamp}${body}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');

    if (signature !== expectedSignature) {
      logger.warn(`请求签名验证失败: ${req.method} ${req.originalUrl}`, {
        ip: req.ip,
        providedSignature: signature,
        expectedSignature
      });
      return next(AppError.unauthorized('请求签名无效'));
    }

    next();
  };
}

module.exports = {
  preventDuplicateSubmit,
  idempotencyKey,
  requestSignature
};
