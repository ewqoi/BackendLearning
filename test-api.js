const http = require('http');

const BASE_URL = 'http://localhost:3000';

function request(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: JSON.parse(body)
          });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('请求超时'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

function log(name, result) {
  const status = result.status >= 200 && result.status < 300 ? '✅' : '❌';
  console.log(`\n${status} ${name}`);
  console.log(`   状态码: ${result.status}`);
  if (result.data) {
    console.log(`   响应: ${JSON.stringify(result.data).substring(0, 200)}...`);
  }
}

async function runTests() {
  console.log('========================================');
  console.log('  Node.js API 功能测试');
  console.log('========================================');

  try {
    console.log('\n📋 测试健康检查...');
    const health = await request('GET', '/health');
    log('健康检查', health);

    console.log('\n📋 测试 API 信息...');
    const apiInfo = await request('GET', '/api-info');
    log('API 信息', apiInfo);

    console.log('\n📋 测试统一响应格式...');
    const users = await request('GET', '/api/users?page=1&limit=5');
    log('获取用户列表（分页）', users);

    console.log('\n📋 测试参数校验...');
    const invalidUser = await request('POST', '/api/users', {
      name: 'A',
      email: 'invalid-email',
      age: -1
    });
    log('参数校验失败测试', invalidUser);

    console.log('\n📋 测试创建用户...');
    const createResult = await request('POST', '/api/users', {
      name: '测试用户',
      email: 'test@example.com',
      age: 25
    });
    log('创建用户', createResult);

    let createdUserId = createResult.data?.data?.id;

    if (createdUserId) {
      console.log('\n📋 测试获取单个用户...');
      const user = await request('GET', `/api/users/${createdUserId}`);
      log('获取用户详情', user);

      console.log('\n📋 测试更新用户...');
      const updateResult = await request('PUT', `/api/users/${createdUserId}`, {
        name: '更新后的用户',
        email: 'updated@example.com',
        age: 30
      });
      log('更新用户', updateResult);

      console.log('\n📋 测试部分更新用户...');
      const patchResult = await request('PATCH', `/api/users/${createdUserId}`, {
        age: 35
      });
      log('部分更新用户', patchResult);
    }

    console.log('\n📋 测试搜索用户...');
    const searchResult = await request('GET', '/api/users/search/张');
    log('搜索用户', searchResult);

    console.log('\n📋 测试用户统计...');
    const stats = await request('GET', '/api/users/stats');
    log('用户统计', stats);

    console.log('\n📋 测试排序和筛选...');
    const sortedUsers = await request('GET', '/api/users?sortBy=age&sortOrder=desc&minAge=20&maxAge=40');
    log('排序筛选用户', sortedUsers);

    console.log('\n📋 测试重复邮箱...');
    const duplicateEmail = await request('POST', '/api/users', {
      name: '重复邮箱测试',
      email: 'test@example.com',
      age: 28
    });
    log('重复邮箱检测', duplicateEmail);

    console.log('\n📋 测试不存在的资源...');
    const notFound = await request('GET', '/api/users/99999');
    log('404 错误处理', notFound);

    console.log('\n📋 测试 HEAD 请求...');
    const headResult = await request('HEAD', '/api/users');
    log('HEAD 请求', headResult);

    console.log('\n📋 测试 OPTIONS 请求...');
    const optionsResult = await request('OPTIONS', '/api/users');
    log('OPTIONS 请求', optionsResult);

    if (createdUserId) {
      console.log('\n📋 测试删除用户...');
      const deleteResult = await request('DELETE', `/api/users/${createdUserId}`);
      log('删除用户', deleteResult);
    }

    console.log('\n📋 测试安全头...');
    const securityHeaders = await request('GET', '/api/users');
    const headers = securityHeaders.headers;
    console.log('   X-Content-Type-Options:', headers['x-content-type-options']);
    console.log('   X-Frame-Options:', headers['x-frame-options']);
    console.log('   X-XSS-Protection:', headers['x-xss-protection']);
    console.log('   X-Request-ID:', headers['x-request-id']);

    console.log('\n📋 测试限流头...');
    console.log('   X-RateLimit-Limit:', headers['x-ratelimit-limit']);
    console.log('   X-RateLimit-Remaining:', headers['x-ratelimit-remaining']);
    console.log('   X-RateLimit-Reset:', headers['x-ratelimit-reset']);

    console.log('\n========================================');
    console.log('  测试完成！');
    console.log('========================================');

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.log('\n请确保服务器正在运行: npm start');
  }
}

runTests();
