/**
 * Socket 客户端
 */
import { io } from 'socket.io-client';
import { auth } from './auth.js';

class SocketClient {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.currentRoom = null;
  }

  /**
   * 连接服务器
   */
  connect() {
    const token = auth.getToken();

    this.socket = io({
      auth: { token },
      transports: ['websocket']
    });

    this.setupEventHandlers();
  }

  /**
   * 设置事件处理器
   */
  setupEventHandlers() {
    this.socket.on('connect', () => {
      console.log('已连接到服务器');
      this.emit('connection', { connected: true });
    });

    this.socket.on('disconnect', () => {
      console.log('与服务器断开连接');
      this.emit('disconnection', { disconnected: true });
    });

    this.socket.on('error', (error) => {
      console.error('Socket 错误:', error);
      this.emit('error', error);
    });

    // 房间事件
    this.socket.on('player_join', (data) => {
      this.emit('player_join', data);
    });

    this.socket.on('player_leave', (data) => {
      this.emit('player_leave', data);
    });

    this.socket.on('room_update', (data) => {
      this.emit('room_update', data);
    });

    // 游戏事件
    this.socket.on('game_start', (data) => {
      this.emit('game_start', data);
    });

    this.socket.on('deal_cards', (data) => {
      this.emit('deal_cards', data);
    });

    this.socket.on('player_action', (data) => {
      this.emit('player_action', data);
    });

    this.socket.on('phase_change', (data) => {
      this.emit('phase_change', data);
    });

    this.socket.on('round_end', (data) => {
      this.emit('round_end', data);
    });

    this.socket.on('current_player', (data) => {
      this.emit('current_player', data);
    });

    // 聊天事件
    this.socket.on('chat_message', (data) => {
      this.emit('chat_message', data);
    });
  }

  /**
   * 加入房间
   */
  joinRoom(roomId, password = null) {
    this.currentRoom = roomId;
    this.socket.emit('join_room', { roomId, password });
  }

  /**
   * 离开房间
   */
  leaveRoom() {
    if (this.currentRoom) {
      this.socket.emit('leave_room');
      this.currentRoom = null;
    }
  }

  /**
   * 玩家操作
   */
  playerAction(action, amount = 0) {
    this.socket.emit('player_action', { action, amount });
  }

  /**
   * 发送聊天消息
   */
  sendChatMessage(message) {
    this.socket.emit('chat_message', { message });
  }

  /**
   * 添加事件监听器
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * 移除事件监听器
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * 触发事件
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      for (const callback of this.listeners.get(event)) {
        callback(data);
      }
    }
  }

  /**
   * 断开连接
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

// 导出单例
export const socketClient = new SocketClient();
export default socketClient;
