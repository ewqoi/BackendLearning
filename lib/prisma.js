const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

// 数据库连接 URL
const databaseUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;

// 创建 pg Pool
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

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