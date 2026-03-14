/**
 * 房间管理
 */
import { authAPI, userAPI } from './api.js';
import { auth } from './auth.js';
import socketClient from './socket.js';

export class RoomManager {
  constructor() {
    this.currentRoom = null;
    this.rooms = [];
    this.gameState = null;
  }

  /**
   * 获取房间列表
   */
  async getRoomList() {
    try {
      const response = await fetch('/api/room/list', {
        headers: {
          'Authorization': `Bearer ${auth.getToken()}`
        }
      });
      const data = await response.json();

      if (data.success) {
        this.rooms = data.rooms;
        return data.rooms;
      }
      throw new Error('获取房间列表失败');
    } catch (error) {
      console.error('获取房间列表错误:', error);
      throw error;
    }
  }

  /**
   * 创建房间
   */
  async createRoom(config) {
    try {
      const response = await fetch('/api/room/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.getToken()}`
        },
        body: JSON.stringify(config)
      });
      const data = await response.json();

      if (data.success) {
        return data.room;
      }
      throw new Error(data.message || '创建房间失败');
    } catch (error) {
      console.error('创建房间错误:', error);
      throw error;
    }
  }

  /**
   * 加入房间
   */
  joinRoom(roomId, password = null) {
    this.currentRoom = roomId;
    socketClient.joinRoom(roomId, password);
  }

  /**
   * 离开房间
   */
  leaveRoom() {
    if (this.currentRoom) {
      socketClient.leaveRoom();
      this.currentRoom = null;
      this.gameState = null;
    }
  }

  /**
   * 开始游戏
   */
  async startGame() {
    try {
      const response = await fetch('/api/room/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.getToken()}`
        },
        body: JSON.stringify({ roomId: this.currentRoom })
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || '开始游戏失败');
      }
    } catch (error) {
      console.error('开始游戏错误:', error);
      throw error;
    }
  }

  /**
   * 玩家操作
   */
  playerAction(action, amount = 0) {
    socketClient.playerAction(action, amount);
  }

  /**
   * 发送聊天消息
   */
  sendChatMessage(message) {
    socketClient.sendChatMessage(message);
  }
}

export const roomManager = new RoomManager();
export default roomManager;
