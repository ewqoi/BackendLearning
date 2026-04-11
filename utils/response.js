class ApiResponse {
  static success(data = null, message = '操作成功', code = 200) {
    return {
      success: true,
      code,
      message,
      data,
      timestamp: new Date().toISOString()
    };
  }

  static error(message = '操作失败', code = 500, errors = null) {
    return {
      success: false,
      code,
      message,
      errors,
      timestamp: new Date().toISOString()
    };
  }

  static created(data = null, message = '创建成功') {
    return this.success(data, message, 201);
  }

  static noContent(message = '删除成功') {
    return this.success(null, message, 204);
  }

  static badRequest(message = '请求参数错误', errors = null) {
    return this.error(message, 400, errors);
  }

  static unauthorized(message = '未授权访问') {
    return this.error(message, 401);
  }

  static forbidden(message = '禁止访问') {
    return this.error(message, 403);
  }

  static notFound(message = '资源不存在') {
    return this.error(message, 404);
  }

  static conflict(message = '资源冲突') {
    return this.error(message, 409);
  }

  static tooManyRequests(message = '请求过于频繁，请稍后再试') {
    return this.error(message, 429);
  }

  static paginated(data, total, page, limit, message = '查询成功') {
    return this.success({
      list: data,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    }, message);
  }
}

module.exports = ApiResponse;
