const ApiResponse = require('./response');

class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = '请求参数错误', errors = null) {
    return new AppError(message, 400, 'BAD_REQUEST', errors);
  }

  static unauthorized(message = '未授权访问') {
    return new AppError(message, 401, 'UNAUTHORIZED');
  }

  static forbidden(message = '禁止访问') {
    return new AppError(message, 403, 'FORBIDDEN');
  }

  static notFound(message = '资源不存在') {
    return new AppError(message, 404, 'NOT_FOUND');
  }

  static conflict(message = '资源冲突') {
    return new AppError(message, 409, 'CONFLICT');
  }

  static tooManyRequests(message = '请求过于频繁') {
    return new AppError(message, 429, 'TOO_MANY_REQUESTS');
  }

  static internal(message = '服务器内部错误') {
    return new AppError(message, 500, 'INTERNAL_ERROR');
  }
}

function errorHandler(err, req, res, next) {
  err.statusCode = err.statusCode || 500;
  err.code = err.code || 'INTERNAL_ERROR';

  if (process.env.NODE_ENV === 'development') {
    console.error('错误详情:', {
      message: err.message,
      code: err.code,
      stack: err.stack,
      path: req.path,
      method: req.method,
      body: req.body,
      query: req.query,
      params: req.params
    });
  } else {
    console.error(`[${new Date().toISOString()}] ${err.code}: ${err.message}`);
  }

  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message
    }));
    return res.status(400).json(ApiResponse.badRequest('数据验证失败', errors));
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json(ApiResponse.unauthorized('无效的令牌'));
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json(ApiResponse.unauthorized('令牌已过期'));
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json(ApiResponse.badRequest('文件大小超出限制'));
  }

  if (err.code === 'ENOENT') {
    return res.status(404).json(ApiResponse.notFound('文件不存在'));
  }

  if (err.code === 'ECONNREFUSED') {
    return res.status(503).json(ApiResponse.error('服务暂时不可用', 503));
  }

  if (err.isOperational) {
    return res.status(err.statusCode).json(ApiResponse.error(err.message, err.statusCode, err.errors));
  }

  res.status(500).json(ApiResponse.error(
    process.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message,
    500
  ));
}

function notFoundHandler(req, res, next) {
  const err = AppError.notFound(`路由 ${req.method} ${req.path} 不存在`);
  next(err);
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  AppError,
  errorHandler,
  notFoundHandler,
  asyncHandler
};
