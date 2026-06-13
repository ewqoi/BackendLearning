# Vercel 部署指南

## 📋 目录

1. [项目概述](#项目概述)
2. [Vercel 部署步骤](#vercel-部署步骤)
3. [环境变量配置](#环境变量配置)
4. [数据库配置](#数据库配置)
5. [部署完成后](#部署完成后)
6. [注意事项](#注意事项)

## 项目概述

本项目是一个 Node.js RESTful API 服务，包含以下功能：

- RESTful API（GET/POST/PUT/DELETE/PATCH）
- 文件上传（单文件/多文件）
- 分片上传 + 秒传
- 断点续传
- SSE 实时事件流
- WebSocket 双向通信
- 数据持久化（PostgreSQL）
- 安全增强（限流、防重复提交、CORS）

## Vercel 部署步骤

### 1. 准备工作

1. **注册 Vercel 账号**
   - 访问 [Vercel 官网](https://vercel.com/) 注册账号
   - 推荐使用 GitHub 账号登录

2. **创建 Vercel PostgreSQL 数据库**
   - 在 Vercel 控制台中，进入你的项目
   - 点击 "Storage" -> "Create Database"
   - 选择 "PostgreSQL"，创建数据库
   - Vercel 会自动配置以下环境变量：
     - `POSTGRES_URL`
     - `POSTGRES_URL_NON_POOLING`
     - `POSTGRES_PRISMA_URL`
     - `POSTGRES_USER`
     - `POSTGRES_HOST`
     - `POSTGRES_PASSWORD`
     - `POSTGRES_DATABASE`

### 2. 部署到 Vercel

#### 方法一：从 GitHub 导入（推荐）

1. 登录 Vercel 控制台
2. 点击 "Add New Project"
3. 选择 "Import from Git Repository"
4. 选择你的 GitHub 仓库
5. 点击 "Import"

#### 方法二：使用 Vercel CLI

1. **安装 Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **登录 Vercel**
   ```bash
   vercel login
   ```

3. **部署项目**
   ```bash
   vercel deploy --prod
   ```

## 环境变量配置

### 必需的环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `NODE_ENV` | 运行环境 | production |
| `PORT` | 端口 | 3000 |
| `ENCRYPTION_KEY` | 加密密钥 | 必需设置 |
| `HMAC_SECRET` | HMAC 密钥 | 必需设置 |
| `REQUEST_SECRET` | 请求签名密钥 | 必需设置 |

### 数据库环境变量（Vercel PostgreSQL 自动配置）

Vercel PostgreSQL 会自动设置以下环境变量：

- `POSTGRES_URL` - 带连接池的数据库连接 URL
- `POSTGRES_URL_NON_POOLING` - 不带连接池的数据库连接 URL
- `POSTGRES_PRISMA_URL` - Prisma 专用连接 URL

### CORS 配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `CORS_ORIGIN` | 允许的源 | * |
| `ALLOWED_ORIGIN` | 允许的来源 | http://localhost:3000 |

## 数据库配置

### Prisma 配置

项目使用 Prisma 7.x 作为 ORM，配置文件：

- `prisma/schema.prisma` - 数据库模型定义
- `prisma.config.ts` - Prisma 配置
- `lib/prisma.js` - Prisma Client 实例

### 数据库模型

当前包含 `User` 模型：

```prisma
model User {
  id        Int      @id @default(autoincrement())
  name      String   @db.VarChar(50)
  email     String   @unique @db.VarChar(255)
  age       Int?     @db.SmallInt
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("users")
}
```

### 数据库迁移

在 Vercel 部署时，需要手动运行一次迁移：

```bash
# 连接到 Vercel 环境
vercel env pull .env.production

# 运行迁移
npx prisma migrate deploy
```

## 部署完成后

1. **测试 API**
   - 访问 `https://your-project.vercel.app/api/users`
   - 应该返回空数组或默认用户数据

2. **初始化数据库（可选）**
   - 如果数据库为空，可以运行初始化脚本：
   ```bash
   curl -X POST https://your-project.vercel.app/api/users \
     -H "Content-Type: application/json" \
     -d '{"name":"Test User","email":"test@example.com","age":25}'
   ```

3. **查看 Prisma Studio（开发环境）**
   ```bash
   npx prisma studio
   ```

## 注意事项

### 1. 环境变量安全
- 敏感信息（如加密密钥）不要提交到 Git
- 使用 Vercel 环境变量管理敏感配置

### 2. 数据库连接
- Vercel PostgreSQL 要求 SSL 连接
- 连接池配置已在 `lib/prisma.js` 中处理

### 3. 文件上传
- Vercel Serverless 函数有执行时间限制（最长 10 秒）
- 大文件上传建议使用分片上传功能

### 4. 部署日志
- 可以在 Vercel 控制台查看构建和运行日志
- 如果部署失败，检查环境变量是否正确配置

### 5. 本地开发

在本地开发时，需要创建 `.env` 文件：

```bash
cp .env.example .env
```

然后编辑 `.env` 文件，配置本地数据库连接信息。

---

**部署成功后，你就可以通过 Vercel 提供的域名访问你的 API 服务了！**
