const User = require('../models/User');

// 更新用户资料
const updateProfile = async (req, res) => {
  try {
    const { username, avatar } = req.body;
    const userId = req.user.id;

    const updateData = {};
    if (username) updateData.username = username;
    if (avatar) updateData.avatar = avatar;

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        chips: user.chips,
        stats: user.stats
      }
    });
  } catch (error) {
    console.error('更新资料错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
};

// 获取用户统计
const getStats = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('stats');
    res.json({
      success: true,
      stats: user.stats
    });
  } catch (error) {
    console.error('获取统计错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
};

module.exports = { updateProfile, getStats };
