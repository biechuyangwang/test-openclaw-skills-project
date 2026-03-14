const express = require('express');
const auth = require('../middlewares/auth');

const router = express.Router();

// 这些路由会在 app.js 中动态设置控制器
let roomController;

// 设置控制器的中间件
router.setController = (controller) => {
  roomController = controller;
};

router.get('/list', auth, (req, res) => {
  if (roomController) roomController.getRoomList(req, res);
});

router.post('/create', auth, (req, res) => {
  if (roomController) roomController.createRoom(req, res);
});

router.post('/start', auth, (req, res) => {
  if (roomController) roomController.startGame(req, res);
});

module.exports = router;
