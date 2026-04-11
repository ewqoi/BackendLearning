const express = require('express');
const router = express.Router();
const dataStore = require('../utils/dataStore');
const ApiResponse = require('../utils/response');
const { AppError, asyncHandler } = require('../utils/error');
const { validate, commonRules } = require('../utils/validator');
const { logger } = require('../utils/logger');
const { maskEmail, maskSensitiveData } = require('../utils/crypto');

const validateUserCreate = validate([
  { field: 'name', required: true, minLength: 2, maxLength: 50, message: '姓名长度需在2-50个字符之间' },
  { field: 'email', required: true, type: 'email', message: '请输入有效的邮箱地址' },
  { field: 'age', type: 'positive', min: 1, max: 150, message: '年龄必须是1-150之间的正整数' }
]);

const validateUserUpdate = validate([
  { field: 'name', minLength: 2, maxLength: 50, message: '姓名长度需在2-50个字符之间' },
  { field: 'email', type: 'email', message: '请输入有效的邮箱地址' },
  { field: 'age', type: 'positive', min: 1, max: 150, message: '年龄必须是1-150之间的正整数' }
]);

const validateId = validate(commonRules.id());

const validatePagination = validate(commonRules.pagination());

router.get('/users', validatePagination, asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, name, email, minAge, maxAge, sortBy = 'id', sortOrder = 'asc' } = req.query;
  
  const data = await dataStore.readData();
  let filteredUsers = [...data.users];
  
  if (name) {
    filteredUsers = filteredUsers.filter(user => 
      user.name.toLowerCase().includes(name.toLowerCase())
    );
  }
  
  if (email) {
    filteredUsers = filteredUsers.filter(user => 
      user.email.toLowerCase().includes(email.toLowerCase())
    );
  }
  
  if (minAge) {
    filteredUsers = filteredUsers.filter(user => user.age >= parseInt(minAge));
  }
  
  if (maxAge) {
    filteredUsers = filteredUsers.filter(user => user.age <= parseInt(maxAge));
  }
  
  const validSortFields = ['id', 'name', 'age', 'createdAt', 'updatedAt'];
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'id';
  const order = sortOrder === 'desc' ? -1 : 1;
  
  filteredUsers.sort((a, b) => {
    if (a[sortField] < b[sortField]) return -1 * order;
    if (a[sortField] > b[sortField]) return 1 * order;
    return 0;
  });
  
  const total = filteredUsers.length;
  const startIndex = (parseInt(page) - 1) * parseInt(limit);
  const endIndex = startIndex + parseInt(limit);
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);
  
  logger.info(`获取用户列表: 共 ${total} 条记录, 第 ${page} 页`);
  
  res.json(ApiResponse.paginated(paginatedUsers, total, page, limit));
}));

router.get('/users/:id', validateId, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const user = await dataStore.getUserById(parseInt(id));
  
  if (!user) {
    throw AppError.notFound(`用户 ID ${id} 不存在`);
  }
  
  logger.info(`获取用户详情: ID ${id}`);
  
  res.json(ApiResponse.success(user));
}));

router.post('/users', validateUserCreate, asyncHandler(async (req, res) => {
  const { name, email, age } = req.body;
  
  const data = await dataStore.readData();
  
  const existingUser = data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existingUser) {
    throw AppError.conflict('该邮箱已被注册');
  }
  
  const newUser = {
    name: name.trim(),
    email: email.toLowerCase().trim(),
    age: parseInt(age),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  const createdUser = await dataStore.createUser(newUser);
  
  logger.info(`创建用户: ID ${createdUser.id}, 邮箱: ${maskEmail(email)}`);
  
  res.status(201).json(ApiResponse.created(createdUser, '用户创建成功'));
}));

router.put('/users/:id', validateId, validateUserUpdate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, email, age } = req.body;
  
  const user = await dataStore.getUserById(parseInt(id));
  if (!user) {
    throw AppError.notFound(`用户 ID ${id} 不存在`);
  }
  
  if (email && email.toLowerCase() !== user.email.toLowerCase()) {
    const data = await dataStore.readData();
    const existingUser = data.users.find(u => 
      u.email.toLowerCase() === email.toLowerCase() && u.id !== parseInt(id)
    );
    if (existingUser) {
      throw AppError.conflict('该邮箱已被其他用户使用');
    }
  }
  
  const updateData = {};
  if (name) updateData.name = name.trim();
  if (email) updateData.email = email.toLowerCase().trim();
  if (age !== undefined) updateData.age = parseInt(age);
  updateData.updatedAt = new Date().toISOString();
  
  const updatedUser = await dataStore.updateUser(parseInt(id), updateData);
  
  logger.info(`更新用户: ID ${id}`);
  
  res.json(ApiResponse.success(updatedUser, '用户更新成功'));
}));

router.patch('/users/:id', validateId, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  const allowedFields = ['name', 'email', 'age'];
  const filteredUpdates = {};
  
  for (const key of allowedFields) {
    if (updates[key] !== undefined) {
      filteredUpdates[key] = updates[key];
    }
  }
  
  if (Object.keys(filteredUpdates).length === 0) {
    throw AppError.badRequest('没有有效的更新字段');
  }
  
  const user = await dataStore.getUserById(parseInt(id));
  if (!user) {
    throw AppError.notFound(`用户 ID ${id} 不存在`);
  }
  
  if (filteredUpdates.email) {
    const data = await dataStore.readData();
    const existingUser = data.users.find(u => 
      u.email.toLowerCase() === filteredUpdates.email.toLowerCase() && u.id !== parseInt(id)
    );
    if (existingUser) {
      throw AppError.conflict('该邮箱已被其他用户使用');
    }
    filteredUpdates.email = filteredUpdates.email.toLowerCase().trim();
  }
  
  if (filteredUpdates.name) {
    filteredUpdates.name = filteredUpdates.name.trim();
  }
  
  if (filteredUpdates.age !== undefined) {
    filteredUpdates.age = parseInt(filteredUpdates.age);
  }
  
  filteredUpdates.updatedAt = new Date().toISOString();
  
  const updatedUser = await dataStore.updateUser(parseInt(id), filteredUpdates);
  
  logger.info(`部分更新用户: ID ${id}, 字段: ${Object.keys(filteredUpdates).join(', ')}`);
  
  res.json(ApiResponse.success(updatedUser, '用户更新成功'));
}));

router.delete('/users/:id', validateId, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const deletedUser = await dataStore.deleteUser(parseInt(id));
  
  if (!deletedUser) {
    throw AppError.notFound(`用户 ID ${id} 不存在`);
  }
  
  logger.info(`删除用户: ID ${id}`);
  
  res.json(ApiResponse.success({ id: deletedUser.id }, '用户删除成功'));
}));

router.get('/users/search/:keyword', asyncHandler(async (req, res) => {
  const { keyword } = req.params;
  const { page = 1, limit = 10 } = req.query;
  
  if (!keyword || keyword.trim().length < 1) {
    throw AppError.badRequest('搜索关键词不能为空');
  }
  
  const matchedUsers = await dataStore.searchUsers(keyword);
  
  const total = matchedUsers.length;
  const startIndex = (parseInt(page) - 1) * parseInt(limit);
  const paginatedUsers = matchedUsers.slice(startIndex, startIndex + parseInt(limit));
  
  logger.info(`搜索用户: 关键词 "${keyword}", 找到 ${total} 条记录`);
  
  res.json(ApiResponse.paginated(paginatedUsers, total, page, limit));
}));

router.get('/users/stats', asyncHandler(async (req, res) => {
  const data = await dataStore.readData();
  const users = data.users;
  
  const stats = {
    total: users.length,
    averageAge: users.length > 0 
      ? Math.round(users.reduce((sum, u) => sum + u.age, 0) / users.length) 
      : 0,
    ageGroups: {
      under18: users.filter(u => u.age < 18).length,
      '18to30': users.filter(u => u.age >= 18 && u.age <= 30).length,
      '31to50': users.filter(u => u.age >= 31 && u.age <= 50).length,
      over50: users.filter(u => u.age > 50).length
    },
    recentUsers: users
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map(u => ({ id: u.id, name: u.name, createdAt: u.createdAt }))
  };
  
  res.json(ApiResponse.success(stats));
}));

router.head('/users', asyncHandler(async (req, res) => {
  const data = await dataStore.readData();
  res.set('X-Total-Count', data.users.length);
  res.set('X-Resource-Type', 'users');
  res.status(200).end();
}));

router.options('/users', (req, res) => {
  res.set('Allow', 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS');
  res.json({
    success: true,
    resource: 'users',
    methods: {
      GET: '获取用户列表（支持分页、筛选、排序）',
      POST: '创建新用户',
      PUT: '完整更新用户信息',
      PATCH: '部分更新用户信息',
      DELETE: '删除用户',
      HEAD: '获取用户数量',
      OPTIONS: '获取支持的HTTP方法'
    }
  });
});

module.exports = router;
