const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json());

// 初始化数据文件
function initDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ users: [] }, null, 2));
  }
}

// 读取数据
function readData() {
  const data = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(data);
}

// 写入数据
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// 获取所有用户
app.get('/api/users', (req, res) => {
  const data = readData();
  res.json({ success: true, data: data.users });
});

// 获取单个用户
app.get('/api/users/:id', (req, res) => {
  const data = readData();
  const user = data.users.find(u => u.id === parseInt(req.params.id));
  if (user) {
    res.json({ success: true, data: user });
  } else {
    res.status(404).json({ success: false, message: '用户不存在' });
  }
});

// 创建用户
app.post('/api/users', (req, res) => {
  const { name, email, age } = req.body;
  if (!name || !email) {
    return res.status(400).json({ success: false, message: '姓名和邮箱不能为空' });
  }

  const data = readData();
  const newUser = {
    id: Date.now(),
    name,
    email,
    age: age || null,
    createdAt: new Date().toISOString()
  };

  data.users.push(newUser);
  writeData(data);

  res.status(201).json({ success: true, message: '用户创建成功', data: newUser });
});

// 更新用户
app.put('/api/users/:id', (req, res) => {
  const { name, email, age } = req.body;
  const data = readData();
  const userIndex = data.users.findIndex(u => u.id === parseInt(req.params.id));

  if (userIndex === -1) {
    return res.status(404).json({ success: false, message: '用户不存在' });
  }

  data.users[userIndex] = {
    ...data.users[userIndex],
    name: name || data.users[userIndex].name,
    email: email || data.users[userIndex].email,
    age: age !== undefined ? age : data.users[userIndex].age,
    updatedAt: new Date().toISOString()
  };

  writeData(data);
  res.json({ success: true, message: '用户更新成功', data: data.users[userIndex] });
});

// 删除用户
app.delete('/api/users/:id', (req, res) => {
  const data = readData();
  const userIndex = data.users.findIndex(u => u.id === parseInt(req.params.id));

  if (userIndex === -1) {
    return res.status(404).json({ success: false, message: '用户不存在' });
  }

  const deletedUser = data.users.splice(userIndex, 1)[0];
  writeData(data);

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
