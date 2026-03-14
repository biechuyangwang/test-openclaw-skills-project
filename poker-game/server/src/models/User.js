const mongoose = require('mongoose');
const { memoryStorage } = require('../config/database');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  avatar: {
    type: String,
    default: '/assets/default-avatar.png'
  },
  chips: {
    type: Number,
    default: 5000
  },
  initialChips: {
    type: Number,
    default: 5000
  },
  stats: {
    gamesPlayed: {
      type: Number,
      default: 0
    },
    gamesWon: {
      type: Number,
      default: 0
    },
    totalEarnings: {
      type: Number,
      default: 0
    },
    bestHand: {
      type: String,
      default: ''
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: Date.now
  }
});

// MongoDB 模型
const User = mongoose.model('User', userSchema);

// 内存存储模型（开发模式）
class MemoryUser {
  constructor(data = {}) {
    Object.assign(this, data);
  }

  static async findOne(query) {
    let user = null;

    if (query._id) {
      user = memoryStorage.users.find(u => u._id === query._id);
    }
    if (query.email) {
      user = memoryStorage.users.find(u => u.email === query.email);
    }
    if (query.username) {
      user = memoryStorage.users.find(u => u.username === query.username);
    }
    if (query.$or) {
      for (const condition of query.$or) {
        const found = await this.findOne(condition);
        if (found) {
          user = found;
          break;
        }
      }
    }

    // 返回一个 MemoryUser 实例，而不是普通对象
    return user ? new MemoryUser(user) : null;
  }

  static async findById(id) {
    const user = memoryStorage.users.find(u => u._id === id);
    return user ? new MemoryUser(user) : null;
  }

  static async create(data) {
    const newUser = {
      _id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      ...data,
      createdAt: new Date(),
      lastLogin: new Date()
    };
    memoryStorage.users.push(newUser);
    return Promise.resolve(newUser);
  }

  static async find() {
    return Promise.resolve(memoryStorage.users);
  }

  static async findOneAndUpdate(query, update, options = {}) {
    const user = await this.findOne(query);
    if (!user) return null;

    Object.assign(user, update);
    return user;
  }

  static async findByIdAndUpdate(id, update, options = {}) {
    const user = await this.findById(id);
    if (!user) return null;

    Object.assign(user, update);
    return user;
  }

  static async deleteOne(query) {
    const index = memoryStorage.users.findIndex(u => u._id === query._id);
    if (index !== -1) {
      memoryStorage.users.splice(index, 1);
    }
  }

  save() {
    // 在内存存储中找到并更新这个用户
    const index = memoryStorage.users.findIndex(u => u._id === this._id);
    if (index !== -1) {
      memoryStorage.users[index] = { ...memoryStorage.users[index], ...this };
    }
    return Promise.resolve(this);
  }
}

// 根据环境返回相应的模型
const getModel = () => {
  if (process.env.USE_MEMORY_DB === 'true') {
    return MemoryUser;
  }
  return User;
};

module.exports = getModel();
