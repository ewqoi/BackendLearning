const http = require('http');

const BASE_URL = 'localhost';
const PORT = 3000;

// 辅助函数：发送 HTTP 请求
function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// 打印分隔线
function printLine() {
  console.log('='.repeat(60));
}

// 主测试流程
async function runTests() {
  console.log('\n🚀 开始 API 测试演示\n');

  // 1. 创建用户
  printLine();
  console.log('📌 1. 创建用户 (POST /api/users)');
  printLine();
  const newUser = await request('POST', '/api/users', {
    name: '张三',
    email: 'zhangsan@example.com',
    age: 25
  });
  console.log('请求数据:', JSON.stringify({ name: '张三', email: 'zhangsan@example.com', age: 25 }, null, 2));
  console.log('响应结果:', JSON.stringify(newUser, null, 2));

  const userId = newUser.data.id;

  // 2. 创建第二个用户
  printLine();
  console.log('📌 2. 再创建一个用户');
  printLine();
  const newUser2 = await request('POST', '/api/users', {
    name: '李四',
    email: 'lisi@example.com',
    age: 30
  });
  console.log('请求数据:', JSON.stringify({ name: '李四', email: 'lisi@example.com', age: 30 }, null, 2));
  console.log('响应结果:', JSON.stringify(newUser2, null, 2));

  // 3. 获取所有用户
  printLine();
  console.log('📌 3. 获取所有用户 (GET /api/users)');
  printLine();
  const allUsers = await request('GET', '/api/users');
  console.log('响应结果:', JSON.stringify(allUsers, null, 2));

  // 4. 获取单个用户
  printLine();
  console.log(`📌 4. 获取单个用户 (GET /api/users/${userId})`);
  printLine();
  const singleUser = await request('GET', `/api/users/${userId}`);
  console.log('响应结果:', JSON.stringify(singleUser, null, 2));

  // 5. 更新用户
  printLine();
  console.log(`📌 5. 更新用户 (PUT /api/users/${userId})`);
  printLine();
  const updatedUser = await request('PUT', `/api/users/${userId}`, {
    name: '张三（已修改）',
    age: 26
  });
  console.log('请求数据:', JSON.stringify({ name: '张三（已修改）', age: 26 }, null, 2));
  console.log('响应结果:', JSON.stringify(updatedUser, null, 2));

  // 6. 删除用户
  printLine();
  console.log(`📌 6. 删除用户 (DELETE /api/users/${userId})`);
  printLine();
  const deletedUser = await request('DELETE', `/api/users/${userId}`);
  console.log('响应结果:', JSON.stringify(deletedUser, null, 2));

  // 7. 验证删除 - 获取所有用户
  printLine();
  console.log('📌 7. 删除后获取所有用户');
  printLine();
  const remainingUsers = await request('GET', '/api/users');
  console.log('响应结果:', JSON.stringify(remainingUsers, null, 2));

  printLine();
  console.log('✅ API 测试演示完成！');
  printLine();
}

runTests().catch(console.error);
