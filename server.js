const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// 中间件
app.use(express.json());

// CORS 支持
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// 日志中间件
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// 初始化数据文件
function initDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ users: [] }, null, 2));
  }
}

// 读取数据
function readData() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('读取数据文件失败:', error);
    return { users: [] };
  }
}

// 写入数据
function writeData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('写入数据文件失败:', error);
    return false;
  }
}

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ success: false, message: '服务器内部错误' });
});

// 获取所有用户
app.get('/api/users', (req, res) => {
  const data = readData();
  res.json({ success: true, data: data.users });
});

// 获取单个用户
app.get('/api/users/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  
  if (isNaN(userId)) {
    return res.status(400).json({ success: false, message: '无效的用户ID' });
  }
  
  const data = readData();
  const user = data.users.find(u => u.id === userId);
  if (user) {
    res.json({ success: true, data: user });
  } else {
    res.status(404).json({ success: false, message: '用户不存在' });
  }
});

// 创建用户
app.post('/api/users', (req, res) => {
  const { name, email, age } = req.body;
  
  // 输入验证
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ success: false, message: '姓名不能为空且必须是字符串' });
  }
  
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ success: false, message: '邮箱不能为空且必须是字符串' });
  }
  
  // 简单的邮箱格式验证
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, message: '邮箱格式不正确' });
  }
  
  if (age !== undefined && (typeof age !== 'number' || age < 0)) {
    return res.status(400).json({ success: false, message: '年龄必须是非负数字' });
  }

  const data = readData();
  
  // 检查邮箱是否已存在
  const existingUser = data.users.find(u => u.email === email);
  if (existingUser) {
    return res.status(400).json({ success: false, message: '该邮箱已被注册' });
  }
  
  const newUser = {
    id: Date.now(),
    name: name.trim(),
    email: email.toLowerCase().trim(),
    age: age || null,
    createdAt: new Date().toISOString()
  };

  data.users.push(newUser);
  const success = writeData(data);
  
  if (!success) {
    return res.status(500).json({ success: false, message: '保存数据失败' });
  }

  res.status(201).json({ success: true, message: '用户创建成功', data: newUser });
});

// 更新用户
app.put('/api/users/:id', (req, res) => {
  const { name, email, age } = req.body;
  const userId = parseInt(req.params.id);
  
  if (isNaN(userId)) {
    return res.status(400).json({ success: false, message: '无效的用户ID' });
  }
  
  // 输入验证
  if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
    return res.status(400).json({ success: false, message: '姓名必须是非空字符串' });
  }
  
  if (email !== undefined) {
    if (typeof email !== 'string') {
      return res.status(400).json({ success: false, message: '邮箱必须是字符串' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: '邮箱格式不正确' });
    }
  }
  
  if (age !== undefined && (typeof age !== 'number' || age < 0)) {
    return res.status(400).json({ success: false, message: '年龄必须是非负数字' });
  }

  const data = readData();
  const userIndex = data.users.findIndex(u => u.id === userId);

  if (userIndex === -1) {
    return res.status(404).json({ success: false, message: '用户不存在' });
  }

  // 检查邮箱是否已被其他用户使用
  if (email !== undefined && email !== data.users[userIndex].email) {
    const existingUser = data.users.find(u => u.email === email && u.id !== userId);
    if (existingUser) {
      return res.status(400).json({ success: false, message: '该邮箱已被其他用户注册' });
    }
  }

  data.users[userIndex] = {
    ...data.users[userIndex],
    name: name ? name.trim() : data.users[userIndex].name,
    email: email ? email.toLowerCase().trim() : data.users[userIndex].email,
    age: age !== undefined ? age : data.users[userIndex].age,
    updatedAt: new Date().toISOString()
  };

  const success = writeData(data);
  if (!success) {
    return res.status(500).json({ success: false, message: '保存数据失败' });
  }

  res.json({ success: true, message: '用户更新成功', data: data.users[userIndex] });
});

// 删除用户
app.delete('/api/users/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  
  if (isNaN(userId)) {
    return res.status(400).json({ success: false, message: '无效的用户ID' });
  }
  
  const data = readData();
  const userIndex = data.users.findIndex(u => u.id === userId);

  if (userIndex === -1) {
    return res.status(404).json({ success: false, message: '用户不存在' });
  }

  const deletedUser = data.users.splice(userIndex, 1)[0];
  const success = writeData(data);
  
  if (!success) {
    return res.status(500).json({ success: false, message: '保存数据失败' });
  }

  res.json({ success: true, message: '用户删除成功', data: deletedUser });
});

// 启动服务器
initDataFile();
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log('');
  console.log('可用的 API 接口:');
  console.log(`  GET    http://localhost:${PORT}/api/users       - 获取所有用户`);
  console.log(`  GET    http://localhost:${PORT}/api/users/:id   - 获取单个用户`);
  console.log(`  POST   http://localhost:${PORT}/api/users       - 创建用户`);
  console.log(`  PUT    http://localhost:${PORT}/api/users/:id   - 更新用户`);
  console.log(`  DELETE http://localhost:${PORT}/api/users/:id   - 删除用户`);
});
