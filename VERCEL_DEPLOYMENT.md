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

2. **准备数据库**
   - 选择一个免费的 PostgreSQL 服务（推荐 Neon 或 Supabase）
   - 创建数据库并获取连接信息

### 2. 部署到 Vercel

#### 方法一：从 GitHub 导入（推荐）

1. 登录 Vercel 控制台
2. 点击 "Add New Project"
3. 选择 "Import from Git Repository"
4. 选择你的 GitHub 仓库 `ewqoi/BackendLearning`
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
   # 开发环境部署
   vercel deploy
   
   # 生产环境部署
   vercel deploy --prod
   ```

### 3. 配置项目

1. **项目设置**
   - 项目名称：BackendLearning
   - Framework Preset：Other
   - Root Directory：保持默认

2. **Build & Output Settings**
   - Build Command：`npm install`
   - Output Directory：保持默认
   - Install Command：`npm install`
   - Development Command：`npm run dev`

## 环境变量配置

在 Vercel 项目的 "Environment Variables" 中添加以下环境变量：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| NODE_ENV | production | 运行环境 |
| PORT | 3000 | 服务端口 |
| DB_HOST | your_db_host | 数据库主机 |
| DB_PORT | 5432 | 数据库端口 |
| DB_NAME | your_db_name | 数据库名称 |
| DB_USER | your_db_user | 数据库用户 |
| DB_PASSWORD | your_db_password | 数据库密码 |
| ENCRYPTION_KEY | your_encryption_key | 加密密钥 |
| HMAC_SECRET | your_hmac_secret | HMAC 密钥 |
| REQUEST_SECRET | your_request_secret | 请求签名密钥 |
| CORS_ORIGIN | * | CORS 源 |

## 数据库配置

### 推荐的免费 PostgreSQL 服务

#### 1. Neon

1. 访问 [Neon 官网](https://neon.tech/)
2. 注册账号并创建项目
3. 获取连接字符串，格式：
   ```
   postgres://user:password@ep-some-name-123456.us-east-2.aws.neon.tech/dbname
   ```
4. 从连接字符串中提取：
   - DB_HOST: ep-some-name-123456.us-east-2.aws.neon.tech
   - DB_USER: user
   - DB_PASSWORD: password
   - DB_NAME: dbname

#### 2. Supabase

1. 访问 [Supabase 官网](https://supabase.com/)
2. 注册账号并创建项目
3. 在 "Settings" → "Database" 中获取连接信息
4. 提取所需的数据库连接参数

### 数据库初始化

部署完成后，需要初始化数据库：

1. 访问 Vercel 部署的应用地址
2. 运行数据库初始化脚本：
   ```bash
   # 使用 Vercel CLI 运行
   vercel run db:init
   
   # 或直接访问 API 端点（如果实现了初始化接口）
   # GET /api/init-db
   ```

## 部署完成后

### 访问地址

部署成功后，Vercel 会提供一个域名，格式为：
- 开发环境：`https://backend-learning-xxx.vercel.app`
- 生产环境：`https://backend-learning.vercel.app`（如果配置了自定义域名）

### 可用的 API 接口

| 接口 | 地址 | 方法 |
|------|------|------|
| 健康检查 | `https://your-vercel-domain.vercel.app/health` | GET |
| API 信息 | `https://your-vercel-domain.vercel.app/api-info` | GET |
| 获取所有用户 | `https://your-vercel-domain.vercel.app/api/users` | GET |
| 获取单个用户 | `https://your-vercel-domain.vercel.app/api/users/:id` | GET |
| 创建用户 | `https://your-vercel-domain.vercel.app/api/users` | POST |
| 更新用户 | `https://your-vercel-domain.vercel.app/api/users/:id` | PUT |
| 删除用户 | `https://your-vercel-domain.vercel.app/api/users/:id` | DELETE |
| 文件上传 | `https://your-vercel-domain.vercel.app/upload/single` | POST |
| SSE 事件 | `https://your-vercel-domain.vercel.app/sse/events` | GET |

## 注意事项

### 1. 数据库连接

- Vercel 是无服务器平台，函数执行完成后会释放资源
- 确保数据库连接配置正确，使用连接池
- 对于 Neon 等服务，确保连接字符串包含 sslmode=require

### 2. 文件上传

- Vercel 的 Serverless Functions 有 50MB 的请求大小限制
- 对于大文件上传，建议使用分片上传功能
- 上传的文件会存储在 Vercel 的临时存储中，建议配置持久化存储

### 3. WebSocket

- Vercel 的 Serverless Functions 不直接支持 WebSocket
- 对于 WebSocket 功能，建议使用 Vercel Edge Functions 或第三方服务
- 可以考虑使用 Socket.io 等库，它会自动降级为轮询

### 4. 环境变量

- 敏感信息（如数据库密码）必须通过环境变量配置
- 不要在代码中硬编码敏感信息
- Vercel 会自动加密环境变量

### 5. 部署优化

- 启用 Vercel 的 Edge Network 加速全球访问
- 配置适当的缓存策略
- 监控应用性能和错误

## 故障排查

### 1. 部署失败

- 检查 package.json 中的依赖是否正确
- 确保所有环境变量已配置
- 查看 Vercel 部署日志

### 2. 数据库连接失败

- 验证数据库连接信息是否正确
- 检查数据库服务是否可访问
- 确认数据库防火墙设置

### 3. API 接口无响应

- 检查服务器日志
- 验证环境变量配置
- 测试数据库连接

### 4. 文件上传失败

- 检查文件大小是否超过限制
- 验证上传目录权限
- 查看上传相关日志

## 快速部署命令

```bash
# 安装 Vercel CLI
npm install -g vercel

# 登录 Vercel
vercel login

# 开发环境部署
vercel deploy

# 生产环境部署
vercel deploy --prod

# 查看部署状态
vercel status

# 查看日志
vercel logs
```

## 部署检查清单

- [ ] Vercel 账号已注册
- [ ] PostgreSQL 数据库已创建
- [ ] 环境变量已配置
- [ ] 项目已部署到 Vercel
- [ ] 数据库已初始化
- [ ] API 接口可访问
- [ ] 安全配置已启用
- [ ] 监控已设置

---

**部署完成后，项目将在 Vercel 上运行，提供全球可访问的 API 服务！** 🚀
