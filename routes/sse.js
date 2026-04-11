const express = require('express');
const router = express.Router();

router.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent({
    type: 'connected',
    message: 'SSE 连接成功',
    timestamp: Date.now()
  });

  const intervalId = setInterval(() => {
    sendEvent({
      type: 'heartbeat',
      message: '心跳检测',
      timestamp: Date.now()
    });
  }, 30000);

  const counterInterval = setInterval(() => {
    sendEvent({
      type: 'counter',
      value: Math.floor(Math.random() * 100),
      timestamp: Date.now()
    });
  }, 5000);

  const newsInterval = setInterval(() => {
    const news = [
      '系统更新完成',
      '新功能已上线',
      '服务器运行正常',
      '数据备份完成',
      '用户活跃度报告'
    ];
    sendEvent({
      type: 'news',
      content: news[Math.floor(Math.random() * news.length)],
      timestamp: Date.now()
    });
  }, 10000);

  req.on('close', () => {
    clearInterval(intervalId);
    clearInterval(counterInterval);
    clearInterval(newsInterval);
    console.log('SSE 客户端断开连接');
  });
});

router.get('/custom', (req, res) => {
  const { event = 'message', id } = req.query;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  let eventId = parseInt(id) || Date.now();

  const sendCustomEvent = (eventName, data) => {
    res.write(`id: ${eventId++}\n`);
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  sendCustomEvent(event, {
    message: '自定义事件流已启动',
    eventName: event,
    timestamp: Date.now()
  });

  const intervalId = setInterval(() => {
    sendCustomEvent(event, {
      type: 'update',
      value: Math.random().toString(36).substring(7),
      timestamp: Date.now()
    });
  }, 3000);

  req.on('close', () => {
    clearInterval(intervalId);
  });
});

module.exports = router;
