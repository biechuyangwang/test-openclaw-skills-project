const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Game = require('../game/Game');

/**
 * Socket 服务
 */
class SocketService {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    this.rooms = new Map(); // 房间列表
    this.playerRooms = new Map(); // 玩家所在房间

    this.setupMiddleware();
    this.setupHandlers();
  }

  /**
   * 设置中间件
   */
  setupMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          return next(new Error('未提供认证令牌'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
          return next(new Error('用户不存在'));
        }

        socket.user = user;
        next();
      } catch (error) {
        next(new Error('认证失败'));
      }
    });
  }

  /**
   * 设置事件处理器
   */
  setupHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`用户连接: ${socket.user.username}`);

      // 加入房间
      socket.on('join_room', (data) => this.handleJoinRoom(socket, data));

      // 离开房间
      socket.on('leave_room', () => this.handleLeaveRoom(socket));

      // 玩家操作
      socket.on('player_action', (data) => this.handlePlayerAction(socket, data));

      // 聊天消息
      socket.on('chat_message', (data) => this.handleChatMessage(socket, data));

      // 断开连接
      socket.on('disconnect', () => this.handleDisconnect(socket));
    });
  }

  /**
   * 处理加入房间
   */
  async handleJoinRoom(socket, data) {
    try {
      const { roomId, password } = data;

      // 检查房间是否存在
      if (!this.rooms.has(roomId)) {
        socket.emit('error', { message: '房间不存在' });
        return;
      }

      const room = this.rooms.get(roomId);

      // 检查密码
      if (room.password && room.password !== password) {
        socket.emit('error', { message: '房间密码错误' });
        return;
      }

      // 检查房间是否已满
      if (room.players.length >= room.maxPlayers) {
        socket.emit('error', { message: '房间已满' });
        return;
      }

      // 检查玩家是否已在房间中
      if (room.players.find(p => p.id === socket.user.id)) {
        socket.emit('error', { message: '你已在此房间中' });
        return;
      }

      // 加入 Socket 房间
      socket.join(roomId);

      // 添加玩家到房间
      const player = {
        id: socket.user.id,
        name: socket.user.username,
        avatar: socket.user.avatar,
        chips: socket.user.chips,
        isAI: false,
        socketId: socket.id
      };

      room.players.push(player);
      this.playerRooms.set(socket.user.id, roomId);

      // 通知房间所有人
      this.io.to(roomId).emit('player_join', {
        player: { ...player, socketId: undefined },
        players: room.players
      });

      // 发送房间状态给新加入的玩家
      socket.emit('room_update', room);

      console.log(`${socket.user.username} 加入房间 ${roomId}`);
    } catch (error) {
      console.error('加入房间错误:', error);
      socket.emit('error', { message: '加入房间失败' });
    }
  }

  /**
   * 处理离开房间
   */
  handleLeaveRoom(socket) {
    try {
      const roomId = this.playerRooms.get(socket.user.id);

      if (!roomId) {
        return;
      }

      const room = this.rooms.get(roomId);

      if (room) {
        // 移除玩家
        room.players = room.players.filter(p => p.id !== socket.user.id);

        // 如果游戏正在运行，处理玩家离开
        if (room.game) {
          room.game.removePlayer(socket.user.id);
        }

        // 如果房间空了，删除房间
        if (room.players.length === 0) {
          this.rooms.delete(roomId);
        } else {
          // 通知其他玩家
          socket.to(roomId).emit('player_leave', {
            playerId: socket.user.id,
            players: room.players
          });
        }
      }

      socket.leave(roomId);
      this.playerRooms.delete(socket.user.id);

      console.log(`${socket.user.username} 离开房间 ${roomId}`);
    } catch (error) {
      console.error('离开房间错误:', error);
    }
  }

  /**
   * 处理玩家操作
   */
  handlePlayerAction(socket, data) {
    try {
      const { action, amount } = data;
      const roomId = this.playerRooms.get(socket.user.id);

      if (!roomId) {
        socket.emit('error', { message: '你不在任何房间中' });
        return;
      }

      const room = this.rooms.get(roomId);

      if (!room || !room.game) {
        socket.emit('error', { message: '游戏未开始' });
        return;
      }

      // 执行玩家操作
      const result = room.game.playerAction(socket.user.id, action, amount);

      // 广播操作结果
      this.io.to(roomId).emit('player_action', {
        playerId: socket.user.id,
        action: result.action,
        pot: result.pot,
        currentBet: result.currentBet
      });

      // 检查是否阶段结束
      if (result.phaseEnd) {
        if (result.roundEnd) {
          // 回合结束
          this.io.to(roomId).emit('round_end', {
            winners: result.winners,
            pot: result.pot
          });

          // 更新玩家筹码
          await this.updatePlayerChips(room);
        } else {
          // 进入下一阶段
          this.io.to(roomId).emit('phase_change', {
            phase: result.phase,
            communityCards: result.communityCards,
            currentPlayerIndex: result.currentPlayerIndex
          });
        }
      }

      // 更新当前玩家
      this.io.to(roomId).emit('current_player', {
        currentPlayerIndex: result.currentPlayerIndex
      });
    } catch (error) {
      console.error('玩家操作错误:', error);
      socket.emit('error', { message: error.message });
    }
  }

  /**
   * 处理聊天消息
   */
  handleChatMessage(socket, data) {
    try {
      const { message } = data;
      const roomId = this.playerRooms.get(socket.user.id);

      if (!roomId) {
        return;
      }

      this.io.to(roomId).emit('chat_message', {
        playerId: socket.user.id,
        playerName: socket.user.username,
        message: message.trim().substring(0, 200)
      });
    } catch (error) {
      console.error('聊天消息错误:', error);
    }
  }

  /**
   * 处理断开连接
   */
  handleDisconnect(socket) {
    console.log(`用户断开连接: ${socket.user.username}`);

    // 如果玩家在房间中，离开房间
    if (this.playerRooms.has(socket.user.id)) {
      this.handleLeaveRoom(socket);
    }
  }

  /**
   * 更新玩家筹码
   */
  async updatePlayerChips(room) {
    try {
      for (const player of room.players) {
        if (player.isAI) continue;

        const gamePlayer = room.game.players.find(p => p.id === player.id);
        if (gamePlayer) {
          await User.findByIdAndUpdate(player.id, {
            chips: gamePlayer.chips
          });
          player.chips = gamePlayer.chips;
        }
      }
    } catch (error) {
      console.error('更新筹码错误:', error);
    }
  }

  /**
   * 创建房间
   */
  createRoom(hostId, data) {
    const roomId = this.generateRoomId();

    const room = {
      id: roomId,
      name: data.name,
      password: data.password || null,
      hostId,
      maxPlayers: data.maxPlayers || 6,
      smallBlind: data.smallBlind || 10,
      bigBlind: data.bigBlind || 20,
      buyIn: data.buyIn || 1000,
      players: [],
      status: 'waiting',
      game: null,
      createdAt: new Date()
    };

    this.rooms.set(roomId, room);

    return room;
  }

  /**
   * 获取房间列表
   */
  getRoomList() {
    const rooms = [];

    for (const [id, room] of this.rooms) {
      rooms.push({
        id: room.id,
        name: room.name,
        playerCount: room.players.length,
        maxPlayers: room.maxPlayers,
        smallBlind: room.smallBlind,
        bigBlind: room.bigBlind,
        hasPassword: !!room.password,
        status: room.status
      });
    }

    return rooms;
  }

  /**
   * 开始游戏
   */
  startGame(roomId) {
    const room = this.rooms.get(roomId);

    if (!room) {
      throw new Error('房间不存在');
    }

    if (room.players.length < 2) {
      throw new Error('至少需要2名玩家才能开始游戏');
    }

    // 创建游戏实例
    room.game = new Game({
      smallBlind: room.smallBlind,
      bigBlind: room.bigBlind
    });

    // 添加玩家
    for (const player of room.players) {
      const gamePlayer = new (require('../game/Player.js'))(
        player.id,
        player.name,
        player.chips,
        player.isAI
      );
      room.game.addPlayer(gamePlayer);
    }

    // 开始新回合
    const result = room.game.startNewRound();
    room.status = 'playing';

    // 通知所有玩家
    this.io.to(roomId).emit('game_start', {
      phase: 'preflop',
      dealerPosition: result.dealerPosition,
      smallBlindPosition: result.smallBlindPosition,
      bigBlindPosition: result.bigBlindPosition,
      pot: result.pot,
      players: result.players
    });

    // 发送底牌
    for (const player of room.game.players) {
      const socket = this.getPlayerSocket(player.id);
      if (socket) {
        const myPlayer = result.players.find(p => p.id === player.id);
        socket.emit('deal_cards', {
          holeCards: myPlayer.holeCards
        });
      }
    }

    // 通知当前行动玩家
    this.io.to(roomId).emit('current_player', {
      currentPlayerIndex: room.game.currentPlayerIndex
    });

    return room;
  }

  /**
   * 获取玩家 Socket
   */
  getPlayerSocket(playerId) {
    for (const socket of this.io.sockets.sockets.values()) {
      if (socket.user && socket.user.id === playerId) {
        return socket;
      }
    }
    return null;
  }

  /**
   * 生成房间 ID
   */
  generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
}

module.exports = SocketService;
