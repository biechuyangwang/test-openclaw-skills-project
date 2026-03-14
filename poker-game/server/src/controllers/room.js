/**
 * 房间控制器
 */
class RoomController {
  constructor(socketService) {
    this.socketService = socketService;
  }

  /**
   * 获取房间列表
   */
  getRoomList(req, res) {
    try {
      const rooms = this.socketService.getRoomList();
      res.json({
        success: true,
        rooms
      });
    } catch (error) {
      console.error('获取房间列表错误:', error);
      res.status(500).json({ message: '服务器错误' });
    }
  }

  /**
   * 创建房间
   */
  createRoom(req, res) {
    try {
      const { name, password, maxPlayers, smallBlind, bigBlind, buyIn } = req.body;

      if (!name) {
        return res.status(400).json({ message: '请提供房间名称' });
      }

      const room = this.socketService.createRoom(req.user.id, {
        name,
        password,
        maxPlayers: maxPlayers || 6,
        smallBlind: smallBlind || 10,
        bigBlind: bigBlind || 20,
        buyIn: buyIn || 1000
      });

      res.json({
        success: true,
        room: {
          id: room.id,
          name: room.name,
          maxPlayers: room.maxPlayers,
          smallBlind: room.smallBlind,
          bigBlind: room.bigBlind,
          buyIn: room.buyIn,
          hasPassword: !!room.password
        }
      });
    } catch (error) {
      console.error('创建房间错误:', error);
      res.status(500).json({ message: '服务器错误' });
    }
  }

  /**
   * 开始游戏
   */
  startGame(req, res) {
    try {
      const { roomId } = req.body;

      if (!roomId) {
        return res.status(400).json({ message: '请提供房间ID' });
      }

      const room = this.socketService.startGame(roomId);

      res.json({
        success: true,
        message: '游戏开始'
      });
    } catch (error) {
      console.error('开始游戏错误:', error);
      res.status(400).json({ message: error.message });
    }
  }
}

module.exports = RoomController;
