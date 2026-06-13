# 远程数据库连接与初始化

## 1. 配置连接

复制环境变量示例并填入 Prisma Postgres 连接串：

```bash
cp .env.example .env
```

在 `.env` 中设置（建议三个保持一致）：

```env
POSTGRES_URL="postgres://USER:PASSWORD@db.prisma.io:5432/postgres?sslmode=require"
DATABASE_URL="postgres://USER:PASSWORD@db.prisma.io:5432/postgres?sslmode=require"
PRISMA_DATABASE_URL="postgres://USER:PASSWORD@db.prisma.io:5432/postgres?sslmode=require"
```

- 应用读取 `POSTGRES_URL` 或 `DATABASE_URL`（见 `lib/prisma.js`）
- Prisma CLI 读取同一组变量（见 `prisma.config.ts`）
- 远程库需带 `sslmode=require`

## 2. 安装依赖

```bash
npm install
```

## 3. 初始化远程数据库

```bash
npm run prisma:generate   # 生成 Prisma Client
npm run prisma:push       # 将 schema 同步到远程库
npm run db:init           # 测试连接；若 users 表为空则写入默认用户
```

## 4. 验证连接

```bash
npm run db:init
```

看到「数据库连接成功」「数据库初始化成功」即表示远程库可用。

可选：用 Prisma Studio 查看数据：

```bash
npm run prisma:studio
```
