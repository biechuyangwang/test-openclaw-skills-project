const mongoose = require('mongoose');

// 内存存储（开发模式）
let memoryStorage = {
  users: []
};

const connectDB = async () => {
  // 检查是否使用内存模式
  if (process.env.USE_MEMORY_DB === 'true') {
    console.log('⚠️  使用内存数据库模式（数据不会持久化）');
    console.log('提示: 如需持久化存储，请安装 MongoDB 并设置 USE_MEMORY_DB=false');
    return;
  }

  // MongoDB 连接
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB 连接失败: ${error.message}`);
    console.log('\n提示:');
    console.log('1. 确保 MongoDB 已启动');
    console.log('2. 或者在 .env 文件中设置 USE_MEMORY_DB=true 使用内存模式\n');

    // 开发环境自动切换到内存模式
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 自动切换到内存数据库模式...\n');
      process.env.USE_MEMORY_DB = 'true';
    } else {
      process.exit(1);
    }
  }
};

module.exports = { connectDB, memoryStorage };
