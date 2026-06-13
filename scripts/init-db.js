const prisma = require('../lib/prisma');
const { logger } = require('../utils/logger');

async function testConnection() {
  try {
    await prisma.$connect();
    logger.info('数据库连接成功');
    return true;
  } catch (error) {
    logger.error('数据库连接失败:', error.message);
    return false;
  }
}

async function initDatabase() {
  try {
    logger.info('开始初始化数据库...');

    const connected = await testConnection();
    if (!connected) {
      logger.error('数据库连接失败，初始化终止');
      return false;
    }

    logger.info('检查用户数据...');
    const userCount = await prisma.user.count();
    
    if (userCount === 0) {
      logger.info('创建默认用户数据...');
      const defaultUsers = [
        { name: '张三', email: 'zhangsan@example.com', age: 25 },
        { name: '李四', email: 'lisi@example.com', age: 30 },
        { name: '王五', email: 'wangwu@example.com', age: 28 }
      ];

      await prisma.user.createMany({ data: defaultUsers });
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
