const { AppError } = require('./error');

const validators = {
  isEmail: (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  },

  isPhone: (value) => {
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(value);
  },

  isUrl: (value) => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },

  isNumber: (value) => {
    return !isNaN(parseFloat(value)) && isFinite(value);
  },

  isInteger: (value) => {
    return Number.isInteger(Number(value));
  },

  isPositiveNumber: (value) => {
    return validators.isNumber(value) && Number(value) > 0;
  },

  isNonNegativeNumber: (value) => {
    return validators.isNumber(value) && Number(value) >= 0;
  },

  minLength: (value, min) => {
    return String(value).length >= min;
  },

  maxLength: (value, max) => {
    return String(value).length <= max;
  },

  inRange: (value, min, max) => {
    const num = Number(value);
    return num >= min && num <= max;
  },

  isOneOf: (value, options) => {
    return options.includes(value);
  },

  isDate: (value) => {
    return !isNaN(Date.parse(value));
  },

  isJSON: (value) => {
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  },

  matches: (value, pattern) => {
    return pattern.test(value);
  }
};

function validate(rules) {
  return (req, res, next) => {
    const errors = [];
    const sources = {
      body: req.body,
      query: req.query,
      params: req.params
    };

    for (const rule of rules) {
      const source = sources[rule.source || 'body'];
      const value = source[rule.field];
      const fieldValue = value !== undefined ? value : rule.default;

      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push({
          field: rule.field,
          message: rule.message || `${rule.field} 为必填项`
        });
        continue;
      }

      if (value === undefined || value === null || value === '') {
        if (rule.default !== undefined) {
          source[rule.field] = rule.default;
        }
        continue;
      }

      if (rule.type === 'email' && !validators.isEmail(value)) {
        errors.push({
          field: rule.field,
          message: rule.message || `${rule.field} 邮箱格式不正确`
        });
        continue;
      }

      if (rule.type === 'phone' && !validators.isPhone(value)) {
        errors.push({
          field: rule.field,
          message: rule.message || `${rule.field} 手机号格式不正确`
        });
        continue;
      }

      if (rule.type === 'number') {
        if (!validators.isNumber(value)) {
          errors.push({
            field: rule.field,
            message: rule.message || `${rule.field} 必须是数字`
          });
          continue;
        }
        const num = Number(value);
        if (rule.min !== undefined && num < rule.min) {
          errors.push({
            field: rule.field,
            message: rule.message || `${rule.field} 不能小于 ${rule.min}`
          });
        }
        if (rule.max !== undefined && num > rule.max) {
          errors.push({
            field: rule.field,
            message: rule.message || `${rule.field} 不能大于 ${rule.max}`
          });
        }
      }

      if (rule.type === 'integer' && !validators.isInteger(value)) {
        errors.push({
          field: rule.field,
          message: rule.message || `${rule.field} 必须是整数`
        });
        continue;
      }

      if (rule.type === 'positive' && !validators.isPositiveNumber(value)) {
        errors.push({
          field: rule.field,
          message: rule.message || `${rule.field} 必须是正数`
        });
        continue;
      }

      if (rule.minLength && !validators.minLength(value, rule.minLength)) {
        errors.push({
          field: rule.field,
          message: rule.message || `${rule.field} 长度不能少于 ${rule.minLength} 个字符`
        });
      }

      if (rule.maxLength && !validators.maxLength(value, rule.maxLength)) {
        errors.push({
          field: rule.field,
          message: rule.message || `${rule.field} 长度不能超过 ${rule.maxLength} 个字符`
        });
      }

      if (rule.enum && !validators.isOneOf(value, rule.enum)) {
        errors.push({
          field: rule.field,
          message: rule.message || `${rule.field} 必须是 ${rule.enum.join(', ')} 之一`
        });
      }

      if (rule.pattern && !validators.matches(value, rule.pattern)) {
        errors.push({
          field: rule.field,
          message: rule.message || `${rule.field} 格式不正确`
        });
      }

      if (rule.custom) {
        const customResult = rule.custom(value, source);
        if (customResult !== true) {
          errors.push({
            field: rule.field,
            message: customResult || `${rule.field} 验证失败`
          });
        }
      }

      if (rule.transform && errors.length === 0) {
        source[rule.field] = rule.transform(value);
      }
    }

    if (errors.length > 0) {
      return next(AppError.badRequest('参数验证失败', errors));
    }

    next();
  };
}

const commonRules = {
  pagination: () => [
    { field: 'page', source: 'query', type: 'positive', default: 1 },
    { field: 'limit', source: 'query', type: 'positive', default: 10, max: 100 }
  ],

  id: (field = 'id') => [
    { field, source: 'params', required: true, type: 'positive', message: 'ID 必须是正整数' }
  ],

  email: (field = 'email', required = true) => ({
    field,
    required,
    type: 'email'
  }),

  phone: (field = 'phone', required = true) => ({
    field,
    required,
    type: 'phone'
  }),

  string: (field, options = {}) => ({
    field,
    required: options.required !== false,
    minLength: options.minLength,
    maxLength: options.maxLength || 255,
    ...options
  }),

  number: (field, options = {}) => ({
    field,
    required: options.required !== false,
    type: 'number',
    min: options.min,
    max: options.max,
    ...options
  })
};

module.exports = {
  validate,
  validators,
  commonRules
};
