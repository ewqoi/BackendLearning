require('dotenv').config();

const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: 'postgres',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  dialect: 'postgres',
  logging: console.log
});

async function testConnection() {
  try {
    console.log('正在测试数据库连接...');
    console.log('连接信息:');
    console.log(`  主机: ${process.env.DB_HOST || 'localhost'}`);
    console.log(`  端口: ${process.env.DB_PORT || 5432}`);
    console.log(`  数据库: postgres`);
    console.log(`  用户名: ${process.env.DB_USER || 'postgres'}`);
    console.log(`  密码: ${process.env.DB_PASSWORD ? '******' : 'postgres'}`);
    
    await sequelize.authenticate();
    console.log('\n✅ 数据库连接成功！');
    
    const [result] = await sequelize.query('SELECT version()');
    console.log('\n数据库版本:');
    console.log(result[0].version);
    
    return true;
  } catch (error) {
    console.log('\n❌ 数据库连接失败:');
    console.log('错误信息:', error.message);
    console.log('错误代码:', error.code);
    
    if (error.code === '28P01') {
      console.log('\n提示: 可能是密码错误，请检查 .env 文件中的 DB_PASSWORD 设置');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('\n提示: 可能是 PostgreSQL 服务未启动或端口错误');
    } else if (error.code === '3D000') {
      console.log('\n提示: 可能是数据库不存在，请先创建数据库');
    }
    
    return false;
  } finally {
    await sequelize.close();
  }
}

testConnection();
