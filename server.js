require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { WebSocketServer } = require('ws');
const http = require('http');

const apiRoutes = require('./routes/api');
const sseRoutes = require('./routes/sse');
const uploadRoutes = require('./routes/upload');
const chunkUploadRoutes = require('./routes/chunkUpload');
const resumeRoutes = require('./routes/resume');

const { errorHandler, notFoundHandler } = require('./utils/error');
const { requestLogger, logger } = require('./utils/logger');
const { corsMiddleware, securityHeaders, requestId } = require('./middleware/cors');
const { apiRateLimit, strictRateLimit, authRateLimit, uploadRateLimit } = require('./middleware/rateLimit');
const { preventDuplicateSubmit } = require('./middleware/preventDuplicate');

const initDatabase = require('./scripts/init-db');
const { sequelize } = require('./config/database');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

const uploadsDir = path.join(__dirname, 'uploads');
const chunksDir = path.join(__dirname, 'chunks');
const filesInfoDir = path.join(__dirname, 'files-info');
const resumeDir = path.join(__dirname, 'resume-uploads');
const logsDir = path.join(__dirname, 'logs');

[uploadsDir, chunksDir, filesInfoDir, resumeDir, logsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

app.use(requestId);
app.use(securityHeaders);
app.use(corsMiddleware());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestLogger);

app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', apiRateLimit(), apiRoutes);
app.use('/sse', strictRateLimit(), sseRoutes);
app.use('/upload', uploadRateLimit(), preventDuplicateSubmit({ windowMs: 2000 }), uploadRoutes);
app.use('/chunk', strictRateLimit(), chunkUploadRoutes);
app.use('/resume', strictRateLimit(), resumeRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      unit: 'MB'
    }
  });
});

app.get('/api-info', (req, res) => {
  res.json({
    success: true,
    message: 'Node.js API Server',
    version: '1.0.0',
    endpoints: {
      rest: {
        'GET /api/users': '获取用户列表',
        'GET /api/users/:id': '获取单个用户',
        'POST /api/users': '创建用户',
        'PUT /api/users/:id': '更新用户',
        'DELETE /api/users/:id': '删除用户'
      },
      fileUpload: {
        'POST /upload/single': '单文件上传',
        'POST /upload/multiple': '多文件上传'
      },
      chunkUpload: {
        'POST /chunk/init': '初始化分片上传',
        'POST /chunk/upload': '上传分片',
        'POST /chunk/merge': '合并分片',
        'POST /chunk/verify': '秒传验证'
      },
      resume: {
        'GET /resume/status/:fileId': '获取上传状态',
        'POST /resume/upload': '断点续传上传'
      },
      sse: {
        'GET /sse/events': 'SSE 事件流'
      },
      websocket: {
        'ws://localhost:3000': 'WebSocket 连接'
      }
    }
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

const wss = new WebSocketServer({ server });

const wsClients = new Map();

wss.on('connection', (ws, req) => {
  const clientId = Date.now().toString(36) + Math.random().toString(36).substr(2);
  ws.id = clientId;
  wsClients.set(clientId, ws);

  logger.info(`WebSocket 客户端连接: ${clientId}`);

  ws.send(JSON.stringify({
    type: 'connected',
    clientId,
    message: 'WebSocket 连接成功'
  }));

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleWebSocketMessage(ws, message);
    } catch (error) {
      ws.send(JSON.stringify({ type: 'error', message: '无效的消息格式' }));
    }
  });

  ws.on('close', () => {
    logger.info(`WebSocket 客户端断开: ${clientId}`);
    wsClients.delete(clientId);
  });

  ws.on('error', (error) => {
    logger.error(`WebSocket 错误: ${error.message}`);
  });
});

function handleWebSocketMessage(ws, message) {
  const { type, payload } = message;

  switch (type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      break;

    case 'broadcast':
      const broadcastMsg = JSON.stringify({
        type: 'broadcast',
        from: ws.id,
        message: payload,
        timestamp: Date.now()
      });
      wsClients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(broadcastMsg);
        }
      });
      break;

    case 'echo':
      ws.send(JSON.stringify({
        type: 'echo',
        message: payload,
        timestamp: Date.now()
      }));
      break;

    default:
      ws.send(JSON.stringify({
        type: 'error',
        message: `未知的消息类型: ${type}`
      }));
  }
}

function broadcastToAll(message) {
  const msg = JSON.stringify(message);
  wsClients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(msg);
    }
  });
}

process.on('uncaughtException', (error) => {
  logger.fatal('未捕获的异常', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的 Promise 拒绝', { reason });
});

process.on('SIGTERM', () => {
  logger.info('收到 SIGTERM 信号，正在关闭服务器...');
  server.close(() => {
    logger.info('服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('收到 SIGINT 信号，正在关闭服务器...');
  server.close(() => {
    logger.info('服务器已关闭');
    process.exit(0);
  });
});

async function startServer() {
  try {
    logger.info('正在初始化数据库...');
    const dbInitialized = await initDatabase();
    if (!dbInitialized) {
      logger.error('数据库初始化失败，服务器启动终止');
      process.exit(1);
    }

    server.listen(PORT, () => {
      logger.info(`服务器运行在 http://localhost:${PORT}`);
      logger.info(`WebSocket 服务运行在 ws://localhost:${PORT}`);
      console.log('');
      console.log('可用的 API 接口:');
      console.log(`  GET    http://localhost:${PORT}/api/users       - 获取所有用户`);
      console.log(`  GET    http://localhost:${PORT}/api/users/:id   - 获取单个用户`);
      console.log(`  POST   http://localhost:${PORT}/api/users       - 创建用户`);
      console.log(`  PUT    http://localhost:${PORT}/api/users/:id   - 更新用户`);
      console.log(`  DELETE http://localhost:${PORT}/api/users/:id   - 删除用户`);
      console.log('');
      console.log('文件上传接口:');
      console.log(`  POST   http://localhost:${PORT}/upload/single   - 单文件上传`);
      console.log(`  POST   http://localhost:${PORT}/upload/multiple - 多文件上传`);
      console.log('');
      console.log('分片上传接口:');
      console.log(`  POST   http://localhost:${PORT}/chunk/init      - 初始化分片上传`);
      console.log(`  POST   http://localhost:${PORT}/chunk/upload    - 上传分片`);
      console.log(`  POST   http://localhost:${PORT}/chunk/merge     - 合并分片`);
      console.log(`  POST   http://localhost:${PORT}/chunk/verify    - 秒传验证`);
      console.log('');
      console.log('实时通信:');
      console.log(`  GET    http://localhost:${PORT}/sse/events      - SSE 事件流`);
      console.log(`  WS     ws://localhost:${PORT}                   - WebSocket 连接`);
    });
  } catch (error) {
    logger.error('服务器启动失败:', error.message);
    logger.error(error.stack);
    process.exit(1);
  }
}

startServer();

module.exports = { app, server, wss, broadcastToAll };
