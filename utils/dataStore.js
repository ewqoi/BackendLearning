const { User } = require('../models');
const { Op } = require('sequelize');
const { logger } = require('./logger');

async function readData() {
  try {
    const users = await User.findAll({
      order: [['id', 'ASC']]
    });
    return { users: users.map(user => user.toJSON()) };
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
          await User.update(user, {
            where: { id: user.id }
          });
        } else {
          await User.create(user);
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
    const maxIdUser = await User.findOne({
      order: [['id', 'DESC']],
      attributes: ['id']
    });
    return maxIdUser ? maxIdUser.id + 1 : 1;
  } catch (error) {
    logger.error('获取下一个ID失败:', error.message);
    return 1;
  }
}

async function createUser(userData) {
  try {
    const user = await User.create(userData);
    return user.toJSON();
  } catch (error) {
    logger.error('创建用户失败:', error.message);
    throw error;
  }
}

async function getUserById(id) {
  try {
    const user = await User.findByPk(id);
    return user ? user.toJSON() : null;
  } catch (error) {
    logger.error('获取用户失败:', error.message);
    return null;
  }
}

async function updateUser(id, userData) {
  try {
    const user = await User.findByPk(id);
    if (!user) return null;
    
    await user.update(userData);
    return user.toJSON();
  } catch (error) {
    logger.error('更新用户失败:', error.message);
    throw error;
  }
}

async function deleteUser(id) {
  try {
    const user = await User.findByPk(id);
    if (!user) return null;
    
    await user.destroy();
    return user.toJSON();
  } catch (error) {
    logger.error('删除用户失败:', error.message);
    throw error;
  }
}

async function searchUsers(keyword) {
  try {
    const users = await User.findAll({
      where: {
        [Op.or]: [
          {
            name: {
              [Op.iLike]: `%${keyword}%`
            }
          },
          {
            email: {
              [Op.iLike]: `%${keyword}%`
            }
          }
        ]
      }
    });
    return users.map(user => user.toJSON());
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
