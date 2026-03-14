require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/database');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const roomRoutes = require('./routes/room');
const SocketService = require('./services/socketService');
const RoomController = require('./controllers/room');

const app = express();

// 连接数据库
connectDB();

// 中间件
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件
app.use('/assets', express.static('client/src/assets'));

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});

// 初始化 Socket 服务
const socketService = new SocketService(server);

// 初始化房间控制器
const roomController = new RoomController(socketService);
roomRoutes.setController(roomController);

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/room', roomRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Poker Game Server is running' });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({ message: '请求的资源不存在' });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err.stack);

  // 确保始终返回 JSON
  res.status(err.status || 500).json({
    success: false,
    message: err.message || '服务器内部错误',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 捕获未处理的 Promise 拒绝
process.on('unhandledRejection', (err) => {
  console.error('未处理的 Promise 拒绝:', err);
});

process.on('uncaughtException', (err) => {
  console.error('未捕获的异常:', err);
});

module.exports = { app, server };
