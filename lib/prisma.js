require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const databaseUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('缺少数据库连接：请在 .env 中设置 POSTGRES_URL 或 DATABASE_URL');
}

const poolConfig = { connectionString: databaseUrl };
if (/sslmode=(require|verify-full|verify-ca|prefer)/i.test(databaseUrl)) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolConfig);

// 创建 PrismaPg adapter
const adapter = new PrismaPg(pool);

// 创建 PrismaClient
const prisma = new PrismaClient({
  adapter,
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

// Log queries in development
if (process.env.NODE_ENV !== 'production') {
  prisma.$on('query', (e) => {
    console.log('Query:', e.query);
    console.log('Duration:', e.duration + 'ms');
  });
}

module.exports = prisma;