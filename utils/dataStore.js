const prisma = require('../lib/prisma');
const { logger } = require('./logger');

async function readData() {
  try {
    const users = await prisma.user.findMany({
      orderBy: { id: 'asc' }
    });
    return { users };
  } catch (error) {
    logger.error('读取数据失败:', error.message);
    return { users: [] };
  }
}

async function writeData(data) {
  try {
    if (data && data.users) {
      for (const user of data.users) {
        if (user.id) {
          await prisma.user.update({
            where: { id: user.id },
            data: user
          });
        } else {
          await prisma.user.create({ data: user });
        }
      }
    }
    return true;
  } catch (error) {
    logger.error('写入数据失败:', error.message);
    return false;
  }
}

async function getNextId() {
  try {
    const maxIdUser = await prisma.user.findFirst({
      orderBy: { id: 'desc' },
      select: { id: true }
    });
    return maxIdUser ? maxIdUser.id + 1 : 1;
  } catch (error) {
    logger.error('获取下一个ID失败:', error.message);
    return 1;
  }
}

async function createUser(userData) {
  try {
    const user = await prisma.user.create({ data: userData });
    return user;
  } catch (error) {
    logger.error('创建用户失败:', error.message);
    throw error;
  }
}

async function getUserById(id) {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    return user || null;
  } catch (error) {
    logger.error('获取用户失败:', error.message);
    return null;
  }
}

async function updateUser(id, userData) {
  try {
    const user = await prisma.user.update({
      where: { id },
      data: userData
    });
    return user;
  } catch (error) {
    if (error.code === 'P2025') {
      return null;
    }
    logger.error('更新用户失败:', error.message);
    throw error;
  }
}

async function deleteUser(id) {
  try {
    const user = await prisma.user.delete({ where: { id } });
    return user;
  } catch (error) {
    if (error.code === 'P2025') {
      return null;
    }
    logger.error('删除用户失败:', error.message);
    throw error;
  }
}

async function searchUsers(keyword) {
  try {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: keyword, mode: 'insensitive' } },
          { email: { contains: keyword, mode: 'insensitive' } }
        ]
      }
    });
    return users;
  } catch (error) {
    logger.error('搜索用户失败:', error.message);
    return [];
  }
}

module.exports = {
  readData,
  writeData,
  getNextId,
  createUser,
  getUserById,
  updateUser,
  deleteUser,
  searchUsers
};
