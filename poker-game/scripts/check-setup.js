/**
 * 系统检查脚本
 * 运行: node scripts/check-setup.js
 */

const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');

console.log('=== 德州扑克游戏 - 系统检查 ===\n');

// 检查后端服务器
function checkBackend() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3000/health', (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const health = JSON.parse(data);
          resolve({ ok: true, message: health.message });
        } catch (e) {
          resolve({ ok: true, message: '服务器运行中' });
        }
      });
    });

    req.on('error', () => {
      resolve({ ok: false, message: '后端服务器未启动' });
    });

    req.setTimeout(2000, () => {
      req.destroy();
      resolve({ ok: false, message: '后端服务器未启动' });
    });
  });
}

// 检查 MongoDB（通过端口检查）
function checkMongoDB() {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    socket.setTimeout(2000);

    socket.on('connect', () => {
      socket.destroy();
      resolve({ ok: true, message: 'MongoDB 运行正常' });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ ok: false, message: 'MongoDB 未启动或无法连接' });
    });

    socket.on('error', () => {
      resolve({ ok: false, message: 'MongoDB 未启动或无法连接' });
    });

    socket.connect(27017, 'localhost');
  });
}

// 检查依赖
function checkDependencies() {
  const checks = [];

  // 检查后端依赖
  const serverPackage = path.join(__dirname, '../server/package.json');
  const serverNodeModules = path.join(__dirname, '../server/node_modules');

  if (fs.existsSync(serverPackage)) {
    checks.push({ name: 'server/package.json', ok: true });
  } else {
    checks.push({ name: 'server/package.json', ok: false });
  }

  if (fs.existsSync(serverNodeModules)) {
    checks.push({ name: 'server 依赖', ok: true });
  } else {
    checks.push({ name: 'server 依赖', ok: false, message: '请运行: cd server && npm install' });
  }

  // 检查前端依赖
  const clientPackage = path.join(__dirname, '../client/package.json');
  const clientNodeModules = path.join(__dirname, '../client/node_modules');

  if (fs.existsSync(clientPackage)) {
    checks.push({ name: 'client/package.json', ok: true });
  } else {
    checks.push({ name: 'client/package.json', ok: false });
  }

  if (fs.existsSync(clientNodeModules)) {
    checks.push({ name: 'client 依赖', ok: true });
  } else {
    checks.push({ name: 'client 依赖', ok: false, message: '请运行: cd client && npm install' });
  }

  return checks;
}

// 主函数
async function main() {
  let allOk = true;

  // 检查依赖
  console.log('1. 检查依赖...');
  const depChecks = checkDependencies();
  for (const check of depChecks) {
    if (check.ok) {
      console.log(`   ✅ ${check.name}`);
    } else {
      console.log(`   ❌ ${check.name}`);
      if (check.message) console.log(`      ${check.message}`);
      allOk = false;
    }
  }

  console.log('');

  // 检查 MongoDB
  console.log('2. 检查 MongoDB...');
  const mongoResult = await checkMongoDB();
  if (mongoResult.ok) {
    console.log(`   ✅ ${mongoResult.message}`);
  } else {
    console.log(`   ❌ ${mongoResult.message}`);
    console.log('      请启动 MongoDB:');
    console.log('      - Windows: net start MongoDB');
    console.log('      - macOS/Linux: mongod');
    allOk = false;
  }

  console.log('');

  // 检查后端服务器
  console.log('3. 检查后端服务器...');
  const backendResult = await checkBackend();
  if (backendResult.ok) {
    console.log(`   ✅ ${backendResult.message}`);
  } else {
    console.log(`   ❌ ${backendResult.message}`);
    console.log('      请启动后端服务器:');
    console.log('      - cd server');
    console.log('      - npm run dev');
    allOk = false;
  }

  console.log('');
  console.log('====================');

  if (allOk) {
    console.log('✅ 所有检查通过！');
    console.log('');
    console.log('现在可以启动前端:');
    console.log('  cd client');
    console.log('  npm run dev');
    console.log('');
    console.log('然后访问: http://localhost:5173');
  } else {
    console.log('❌ 发现问题，请按照上述提示修复');
    console.log('');
    console.log('快速启动指南:');
    console.log('  1. 启动 MongoDB: net start MongoDB');
    console.log('  2. 启动后端: cd server && npm run dev');
    console.log('  3. 启动前端: cd client && npm run dev');
  }

  process.exit(allOk ? 0 : 1);
}

main();
