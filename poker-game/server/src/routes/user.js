const express = require('express');
const { updateProfile, getStats } = require('../controllers/user');
const auth = require('../middlewares/auth');

const router = express.Router();

router.put('/profile', auth, updateProfile);
router.get('/stats', auth, getStats);

module.exports = router;
