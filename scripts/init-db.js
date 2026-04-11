const { sequelize, testConnection } = require('../config/database');
const { User } = require('../models');
const { logger } = require('../utils/logger');

async function initDatabase() {
  try {
    logger.info('开始初始化数据库...');

    const connected = await testConnection();
    if (!connected) {
      logger.error('数据库连接失败，初始化终止');
      return false;
    }

    logger.info('正在同步数据库模型...');
    await sequelize.sync({
      alter: true,
      logging: (msg) => logger.debug(msg)
    });

    logger.info('数据库模型同步完成');

    const userCount = await User.count();
    if (userCount === 0) {
      logger.info('创建默认用户数据...');
      const defaultUsers = [
        {
          name: '张三',
          email: 'zhangsan@example.com',
          age: 25
        },
        {
          name: '李四',
          email: 'lisi@example.com',
          age: 30
        },
        {
          name: '王五',
          email: 'wangwu@example.com',
          age: 28
        }
      ];

      await User.bulkCreate(defaultUsers);
      logger.info('默认用户数据创建完成');
    } else {
      logger.info('数据库中已存在用户数据，跳过初始化');
    }

    logger.info('数据库初始化成功');
    return true;
  } catch (error) {
    logger.error('数据库初始化失败:', error.message);
    logger.error(error.stack);
    return false;
  }
}

if (require.main === module) {
  initDatabase()
    .then((success) => {
      if (success) {
        logger.info('数据库初始化完成');
      } else {
        logger.error('数据库初始化失败');
      }
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      logger.error('数据库初始化异常:', error.message);
      process.exit(1);
    });
}

module.exports = initDatabase;
