# 德州扑克游戏 - 安装与运行指南

## 环境要求

- Node.js 16+
- MongoDB 5+
- npm 或 yarn

## 快速开始

### 1. 安装依赖

在项目根目录运行：

```bash
npm run install:all
```

这会自动安装前端和后端的所有依赖。

### 2. 配置环境变量

复制 `server/.env.example` 为 `server/.env`（已创建），根据需要修改配置：

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/poker-game
JWT_SECRET=poker-game-secret-key-2024
JWT_EXPIRE=7d
CLIENT_URL=http://localhost:5173
```

### 3. 启动 MongoDB

确保 MongoDB 已启动：

```bash
# Windows (以服务方式启动)
net start MongoDB

# macOS/Linux
mongod
```

### 4. 启动开发服务器

**方式一：同时启动前后端**

```bash
npm run dev
```

**方式二：分别启动**

```bash
# 终端1 - 启动后端
npm run dev:server

# 终端2 - 启动前端
npm run dev:client
```

### 5. 访问应用

- 前端地址: http://localhost:5173
- 后端地址: http://localhost:3000
- 健康检查: http://localhost:3000/health

## 功能测试

### 1. 用户注册

1. 访问 http://localhost:5173
2. 点击"注册"标签
3. 填写用户名、邮箱、密码
4. 选择初始筹码（1000/5000/10000）
5. 点击"注册"按钮

### 2. 创建房间

1. 登录后进入"游戏大厅"
2. 点击"创建房间"按钮
3. 输入房间名称、密码（可选）、最大人数、盲注
4. 创建成功后显示房间ID

### 3. 加入房间

1. 在房间列表中选择房间
2. 点击"加入"按钮
3. 如果房间有密码，输入密码

### 4. 多人对战测试

**打开两个浏览器窗口：**

窗口A：
1. 注册并登录用户A
2. 创建房间
3. 等待其他玩家

窗口B：
1. 注册并登录用户B
2. 在大厅找到房间A创建的房间
3. 加入房间

4. 在窗口A点击"开始游戏"

## 故障排除

### MongoDB 连接失败

```bash
# 检查 MongoDB 是否运行
# Windows
net start MongoDB

# 检查端口占用
netstat -ano | findstr :27017
```

### 端口冲突

如果 3000 或 5173 端口被占用，修改配置：

```javascript
// server/.env
PORT=3001

// client/vite.config.js
server: {
  port: 5174
}
```

### Socket 连接失败

检查 `server/.env` 中的 `CLIENT_URL` 是否正确。

## 生产部署

### 1. 构建前端

```bash
npm run build:client
```

### 2. 使用 PM2 运行后端

```bash
npm install -g pm2
cd server
pm2 start src/app.js --name poker-game
pm2 save
pm2 startup
```

### 3. Nginx 配置示例

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /path/to/poker-game/client/dist;
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.io 代理
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 开发说明

### 目录结构

```
poker-game/
├── client/          # 前端代码
│   ├── src/
│   │   ├── components/   # UI 组件
│   │   ├── game/         # 游戏逻辑
│   │   ├── ai/           # AI 对手
│   │   ├── network/      # 网络通信
│   │   └── main.js       # 入口文件
│   └── index.html
├── server/          # 后端代码
│   ├── src/
│   │   ├── controllers/  # 控制器
│   │   ├── models/       # 数据模型
│   │   ├── routes/       # 路由
│   │   ├── services/     # 业务逻辑
│   │   └── game/         # 游戏核心
│   └── app.js
└── README.md
```

### API 接口文档

详见 `需求分析.md` 中的"API 接口设计"章节。

## 常见问题

**Q: 如何重置数据库？**
A: 删除 MongoDB 中的 `poker-game` 数据库：
```bash
mongosh
use poker-game
db.dropDatabase()
```

**Q: 如何查看日志？**
A: 后端日志在终端输出，前端日志在浏览器控制台（F12）。

**Q: 如何修改 AI 难度？**
A: 编辑 `client/src/ai/AIPlayer.js`，调整决策逻辑。

## 联系方式

- 项目地址: https://github.com/biechuyangwang/test-openclaw-skills-project
- Issue: https://github.com/biechuyangwang/test-openclaw-skills-project/issues
