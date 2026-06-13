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

const prisma = require('./lib/prisma');

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
        'GET /api/users': 'Get all users',
        'GET /api/users/:id': 'Get user by ID',
        'POST /api/users': 'Create new user',
        'PUT /api/users/:id': 'Update user',
        'DELETE /api/users/:id': 'Delete user'
      },
      fileUpload: {
        'POST /upload/single': 'Upload single file',
        'POST /upload/multiple': 'Upload multiple files'
      },
      chunkUpload: {
        'POST /chunk/init': 'Initialize chunk upload',
        'POST /chunk/upload': 'Upload chunk',
        'POST /chunk/merge': 'Merge chunks',
        'POST /chunk/verify': 'Verify upload'
      },
      resume: {
        'GET /resume/status/:fileId': 'Get upload status',
        'POST /resume/upload': 'Resume upload'
      },
      sse: {
        'GET /sse/events': 'SSE Events'
      },
      websocket: {
        'ws://localhost:3000': 'WebSocket Connection'
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

  ws.send(JSON.stringify({
    type: 'connected',
    clientId,
    message: 'WebSocket connected'
  }));

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleWebSocketMessage(ws, message);
    } catch (error) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });

  ws.on('close', () => {
    logger.info(`WebSocket disconnected: ${clientId}`);
    wsClients.delete(clientId);
  });

  ws.on('error', (error) => {
    logger.error(`WebSocket error: ${error.message}`);
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
        message: `Unknown message type: ${type}`
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
  logger.fatal('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason });
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

async function startServer() {
  try {
    logger.info('Initializing database connection...');
    
    await prisma.$connect();
    logger.info('Database connection successful');

    server.listen(PORT, () => {
      logger.info(`Server running at http://localhost:${PORT}`);
      logger.info(`WebSocket server running at ws://localhost:${PORT}`);
      console.log('');
      console.log('REST API Endpoints:');
      console.log(`  GET    http://localhost:${PORT}/api/users       - Get all users`);
      console.log(`  GET    http://localhost:${PORT}/api/users/:id   - Get user by ID`);
      console.log(`  POST   http://localhost:${PORT}/api/users       - Create user`);
      console.log(`  PUT    http://localhost:${PORT}/api/users/:id   - Update user`);
      console.log(`  DELETE http://localhost:${PORT}/api/users/:id   - Delete user`);
      console.log('');
      console.log('File Upload:');
      console.log(`  POST   http://localhost:${PORT}/upload/single   - Upload single file`);
      console.log(`  POST   http://localhost:${PORT}/upload/multiple - Upload multiple files`);
      console.log('');
      console.log('Chunk Upload:');
      console.log(`  POST   http://localhost:${PORT}/chunk/init      - Initialize chunk upload`);
      console.log(`  POST   http://localhost:${PORT}/chunk/upload    - Upload chunk`);
      console.log(`  POST   http://localhost:${PORT}/chunk/merge     - Merge chunks`);
      console.log(`  POST   http://localhost:${PORT}/chunk/verify    - Verify upload`);
      console.log('');
      console.log('Realtime:');
      console.log(`  GET    http://localhost:${PORT}/sse/events      - SSE Events`);
      console.log(`  WS     ws://localhost:${PORT}                   - WebSocket Connection`);
    });
  } catch (error) {
    logger.error('Server startup failed:', error.message);
    logger.error(error.stack);
    process.exit(1);
  }
}

if (process.env.VERCEL) {
  module.exports = app;
} else {
  startServer();
  module.exports = { app, server, wss, broadcastToAll };
}
