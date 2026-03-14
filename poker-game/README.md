# 德州扑克在线游戏

一个功能完整的德州扑克 Web 游戏，支持单机 AI 对战和多人在线对战。

## 功能特性

- ✅ 用户注册/登录系统
- ✅ 单机模式（与 AI 对战）
- ✅ 多人在线对战
- ✅ 实时聊天
- ✅ 游戏大厅
- ✅ 房间系统
- ✅ 统计数据

## 技术栈

**前端**
- HTML5/CSS3
- JavaScript (ES6+)
- Socket.io Client
- Vite

**后端**
- Node.js
- Express
- Socket.io
- MongoDB
- JWT 认证

## 安装运行

### 前置要求

- Node.js 16+
- MongoDB 5+

### 安装依赖

```bash
npm run install:all
```

### 配置环境变量

复制 `server/.env.example` 为 `server/.env`，根据需要修改配置。

### 启动开发服务器

```bash
# 同时启动前后端
npm run dev

# 或分别启动
npm run dev:server  # 终端1
npm run dev:client  # 终端2
```

### 访问

- 前端: http://localhost:5173
- 后端: http://localhost:3000

## 游戏规则

标准德州扑克规则：
- 每人发 2 张底牌
- 5 张公共牌（翻牌3张 + 转牌1张 + 河牌1张）
- 最佳 5 张牌组合决定胜负

## 项目结构

```
poker-game/
├── client/          # 前端代码
├── server/          # 后端代码
└── README.md
```

## 开发者

OpenClaw Team

## 许可证

MIT
