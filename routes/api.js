const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
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
  
  // Build where conditions
  const where = {};
  
  if (name) {
    where.name = { contains: name, mode: 'insensitive' };
  }
  
  if (email) {
    where.email = { contains: email, mode: 'insensitive' };
  }
  
  if (minAge || maxAge) {
    where.age = {};
    if (minAge) where.age.gte = parseInt(minAge);
    if (maxAge) where.age.lte = parseInt(maxAge);
  }
  
  // Build order by
  const validSortFields = ['id', 'name', 'age', 'createdAt', 'updatedAt'];
  const orderByField = validSortFields.includes(sortBy) ? sortBy : 'id';
  const orderBy = { [orderByField]: sortOrder === 'desc' ? 'desc' : 'asc' };
  
  // Get total count
  const total = await prisma.user.count({ where });
  
  // Get paginated users
  const users = await prisma.user.findMany({
    where,
    orderBy,
    skip: (parseInt(page) - 1) * parseInt(limit),
    take: parseInt(limit),
  });
  
  logger.info(`获取用户列表: 共 ${total} 条记录, 第 ${page} 页`);
  
  res.json(ApiResponse.paginated(users, total, page, limit));
}));

router.get('/users/:id', validateId, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const user = await prisma.user.findUnique({
    where: { id: parseInt(id) },
  });
  
  if (!user) {
    throw AppError.notFound(`用户 ID ${id} 不存在`);
  }
  
  logger.info(`获取用户详情: ID ${id}`);
  
  res.json(ApiResponse.success(user));
}));

router.post('/users', validateUserCreate, asyncHandler(async (req, res) => {
  const { name, email, age } = req.body;
  
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });
  
  if (existingUser) {
    throw AppError.conflict('该邮箱已被注册');
  }
  
  // Create new user
  const newUser = await prisma.user.create({
    data: {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      age: age ? parseInt(age) : null,
    },
  });
  
  logger.info(`创建用户: ID ${newUser.id}, 邮箱: ${maskEmail(email)}`);
  
  res.status(201).json(ApiResponse.created(newUser, '用户创建成功'));
}));

router.put('/users/:id', validateId, validateUserUpdate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, email, age } = req.body;
  
  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { id: parseInt(id) },
  });
  
  if (!existingUser) {
    throw AppError.notFound(`用户 ID ${id} 不存在`);
  }
  
  // Check if email is being changed to an existing email
  if (email && email.toLowerCase() !== existingUser.email.toLowerCase()) {
    const emailConflict = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (emailConflict) {
      throw AppError.conflict('该邮箱已被其他用户使用');
    }
  }
  
  // Update user
  const updateData = {};
  if (name) updateData.name = name.trim();
  if (email) updateData.email = email.toLowerCase().trim();
  if (age !== undefined) updateData.age = parseInt(age);
  
  const updatedUser = await prisma.user.update({
    where: { id: parseInt(id) },
    data: updateData,
  });
  
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
  
  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { id: parseInt(id) },
  });
  
  if (!existingUser) {
    throw AppError.notFound(`用户 ID ${id} 不存在`);
  }
  
  // Check email conflict
  if (filteredUpdates.email) {
    const emailConflict = await prisma.user.findUnique({
      where: { email: filteredUpdates.email.toLowerCase().trim() },
    });
    if (emailConflict && emailConflict.id !== parseInt(id)) {
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
  
  const updatedUser = await prisma.user.update({
    where: { id: parseInt(id) },
    data: filteredUpdates,
  });
  
  logger.info(`部分更新用户: ID ${id}, 字段: ${Object.keys(filteredUpdates).join(', ')}`);
  
  res.json(ApiResponse.success(updatedUser, '用户更新成功'));
}));

router.delete('/users/:id', validateId, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  try {
    const deletedUser = await prisma.user.delete({
      where: { id: parseInt(id) },
    });
    
    logger.info(`删除用户: ID ${id}`);
    
    res.json(ApiResponse.success({ id: deletedUser.id }, '用户删除成功'));
  } catch (error) {
    if (error.code === 'P2025') {
      throw AppError.notFound(`用户 ID ${id} 不存在`);
    }
    throw error;
  }
}));

router.get('/users/search/:keyword', asyncHandler(async (req, res) => {
  const { keyword } = req.params;
  const { page = 1, limit = 10 } = req.query;
  
  if (!keyword || keyword.trim().length < 1) {
    throw AppError.badRequest('搜索关键词不能为空');
  }
  
  const where = {
    OR: [
      { name: { contains: keyword, mode: 'insensitive' } },
      { email: { contains: keyword, mode: 'insensitive' } },
    ],
  };
  
  const total = await prisma.user.count({ where });
  
  const users = await prisma.user.findMany({
    where,
    skip: (parseInt(page) - 1) * parseInt(limit),
    take: parseInt(limit),
    orderBy: { id: 'asc' },
  });
  
  logger.info(`搜索用户: 关键词 "${keyword}", 找到 ${total} 条记录`);
  
  res.json(ApiResponse.paginated(users, total, page, limit));
}));

router.get('/users/stats', asyncHandler(async (req, res) => {
  const total = await prisma.user.count();
  
  // Get all users for statistics
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      age: true,
      createdAt: true,
    },
  });
  
  const usersWithAge = users.filter(u => u.age !== null);
  
  const stats = {
    total: total,
    averageAge: usersWithAge.length > 0 
      ? Math.round(usersWithAge.reduce((sum, u) => sum + u.age, 0) / usersWithAge.length) 
      : 0,
    ageGroups: {
      under18: users.filter(u => u.age !== null && u.age < 18).length,
      '18to30': users.filter(u => u.age !== null && u.age >= 18 && u.age <= 30).length,
      '31to50': users.filter(u => u.age !== null && u.age >= 31 && u.age <= 50).length,
      over50: users.filter(u => u.age !== null && u.age > 50).length,
      unknown: users.filter(u => u.age === null).length,
    },
    recentUsers: users
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map(u => ({ id: u.id, name: u.name, createdAt: u.createdAt })),
  };
  
  res.json(ApiResponse.success(stats));
}));

router.head('/users', asyncHandler(async (req, res) => {
  const total = await prisma.user.count();
  res.set('X-Total-Count', total);
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
