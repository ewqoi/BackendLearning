# 项目部署指南

## 📋 目录

1. [项目概述](#项目概述)
2. [技术栈](#技术栈)
3. [数据库配置](#数据库配置)
4. [部署步骤](#部署步骤)
5. [环境变量配置](#环境变量配置)
6. [免费 PostgreSQL 服务推荐](#免费-postgresql-服务推荐)
7. [故障排查](#故障排查)
8. [维护建议](#维护建议)

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

## 技术栈

- **语言**: JavaScript (Node.js)
- **框架**: Express 4.x
- **数据库**: PostgreSQL
- **ORM**: Sequelize
- **依赖管理**: npm

## 数据库配置

### 本地开发环境

1. **安装 PostgreSQL**
   - 下载地址: [PostgreSQL 官网](https://www.postgresql.org/download/)
   - 安装时设置密码（默认用户: postgres）

2. **创建数据库**
   ```bash
   # 使用 psql 命令行
   psql -U postgres
   CREATE DATABASE crud_api;
   \q
   ```

3. **配置 .env 文件**
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=crud_api
   DB_USER=postgres
   DB_PASSWORD=your_password
   ```

### 线上环境

推荐使用以下免费 PostgreSQL 服务：

- [Neon](https://neon.tech/) - 512MB 免费存储
- [Supabase](https://supabase.com/) - 500MB 免费存储
- [Railway](https://railway.app/) - 512MB 免费存储
- [ElephantSQL](https://www.elephantsql.com/) - 20MB 免费存储

## 部署步骤

### 1. 准备代码

```bash
# 克隆项目
git clone <repository-url>
cd <project-directory>

# 安装依赖
npm install

# 编译（如果使用 TypeScript）
npm run build
```

### 2. 配置环境变量

创建 `.env` 文件，根据实际情况填写：

```env
NODE_ENV=production
PORT=3000

# 数据库配置
DB_HOST=your_db_host
DB_PORT=5432
DB_NAME=your_db_name
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# 加密配置
ENCRYPTION_KEY=your_encryption_key
HMAC_SECRET=your_hmac_secret
REQUEST_SECRET=your_request_secret

# CORS配置
CORS_ORIGIN=*
```

### 3. 数据库初始化

```bash
# 运行数据库初始化脚本
npm run db:init

# 或者手动运行
node scripts/init-db.js
```

### 4. 启动服务

#### 使用 PM2（推荐）

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm run start:prod

# 或者直接使用 PM2
pm run start:pm2

# 查看状态
pm run status

# 查看日志
pm run logs
```

#### 使用 Docker

```bash
# 构建镜像
docker build -t crud-api .

# 运行容器
docker run -d -p 3000:3000 --env-file .env crud-api
```

### 5. 部署到云服务

#### Vercel

1. 登录 [Vercel](https://vercel.com/)
2. 导入项目
3. 在 "Environment Variables" 中添加所有环境变量
4. 部署完成后获取域名

#### Railway

1. 登录 [Railway](https://railway.app/)
2. 创建新项目
3. 选择 "Deploy from GitHub"
4. 配置环境变量
5. Railway 会自动部署并提供域名

#### Render

1. 登录 [Render](https://render.com/)
2. 创建新的 "Web Service"
3. 连接 GitHub 仓库
4. 配置环境变量
5. 部署完成后获取域名

## 环境变量配置

| 变量名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| NODE_ENV | string | 否 | development | 运行环境 |
| PORT | number | 否 | 3000 | 服务端口 |
| DB_HOST | string | 是 | localhost | 数据库主机 |
| DB_PORT | number | 否 | 5432 | 数据库端口 |
| DB_NAME | string | 是 | crud_api | 数据库名称 |
| DB_USER | string | 是 | postgres | 数据库用户 |
| DB_PASSWORD | string | 是 | - | 数据库密码 |
| ENCRYPTION_KEY | string | 否 | - | 加密密钥 |
| HMAC_SECRET | string | 否 | - | HMAC 密钥 |
| REQUEST_SECRET | string | 否 | - | 请求签名密钥 |
| CORS_ORIGIN | string | 否 | * | CORS 源 |

## 免费 PostgreSQL 服务推荐

### 1. Neon

- **免费额度**: 512MB 存储，10GB 带宽
- **优势**: 无服务器架构，按需计费
- **连接方式**: 提供连接字符串
- **官网**: [neon.tech](https://neon.tech/)

### 2. Supabase

- **免费额度**: 500MB 存储，无带宽限制
- **优势**: 提供完整的后端服务，包括认证、存储等
- **连接方式**: 提供连接字符串
- **官网**: [supabase.com](https://supabase.com/)

### 3. Railway

- **免费额度**: 512MB 存储，500小时/月运行时间
- **优势**: 一键部署，集成 GitHub
- **连接方式**: 提供连接字符串
- **官网**: [railway.app](https://railway.app/)

### 4. ElephantSQL

- **免费额度**: 20MB 存储，5 个并发连接
- **优势**: 简单易用，适合小型项目
- **连接方式**: 提供连接字符串
- **官网**: [elephantsql.com](https://www.elephantsql.com/)

## 故障排查

### 1. 数据库连接失败

**症状**: 服务启动时出现 "Connection refused" 或 "Password authentication failed"

**解决方法**:
- 检查 PostgreSQL 服务是否运行
- 验证数据库连接信息是否正确
- 确认防火墙是否允许连接
- 尝试使用 psql 命令行连接测试

### 2. 数据表不存在

**症状**: 出现 "relation "users" does not exist" 错误

**解决方法**:
- 运行 `npm run db:init` 初始化数据库
- 检查 Sequelize 模型定义是否正确
- 确认数据库权限是否足够

### 3. 服务启动失败

**症状**: 服务无法启动，出现错误日志

**解决方法**:
- 检查端口是否被占用
- 验证环境变量配置
- 查看详细日志 `npm run logs`
- 确保所有依赖已安装

## 维护建议

### 1. 数据库备份

- 定期备份数据库
- 使用 pg_dump 命令备份：
  ```bash
  pg_dump -U postgres -d crud_api > backup.sql
  ```

### 2. 日志管理

- 定期清理日志文件
- 配置日志轮转
- 监控错误日志

### 3. 性能优化

- 为数据库表添加索引
- 优化查询语句
- 配置连接池大小
- 启用 gzip 压缩

### 4. 安全维护

- 定期更新依赖包
- 更改数据库密码
- 监控异常访问
- 配置 HTTPS

## 快速启动命令

```bash
# 安装依赖
npm install

# 本地开发
npm run dev

# 数据库初始化
npm run db:init

# 运行测试
npm test

# 生产启动
npm start

# 使用 PM2 启动
npm run start:pm2

# 查看状态
npm run status

# 查看日志
npm run logs
```

## 部署检查清单

- [ ] 数据库已创建并可连接
- [ ] 环境变量配置正确
- [ ] 依赖已安装
- [ ] 数据库初始化完成
- [ ] 服务启动成功
- [ ] API 接口可访问
- [ ] 安全配置已启用
- [ ] 监控已设置

---

**部署完成后，服务将在以下地址运行：**
- API: `http://your-domain:3000/api`
- 健康检查: `http://your-domain:3000/health`
- API 信息: `http://your-domain:3000/api-info`
