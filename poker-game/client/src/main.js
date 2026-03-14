/**
 * 德州扑克游戏 - 主入口
 */
import { auth } from './network/auth.js';
import socketClient from './network/socket.js';
import { roomManager } from './network/room.js';

// 全局状态
const state = {
  currentPage: 'lobby',
  game: null,
  socket: socketClient,
  roomManager: roomManager,
  inMultiplayerGame: false,
  inSinglePlayerGame: false,
  myHoleCards: [],
  lastShowdownResults: null  // 保存摊牌结果
};

/**
 * 检查两个ID是否相等（处理类型不一致）
 */
function isSameId(id1, id2) {
  return String(id1) === String(id2);
}

// 全局错误处理
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// 初始化应用
async function init() {
  console.log('Initializing app...');

  try {
    setupSocketListeners();
    const app = document.getElementById('app');

    if (auth.isAuthenticated()) {
      // Socket 将在 showMainPage 中延迟连接
      showMainPage();
    } else {
      showAuthPage();
    }

    console.log('App initialized');
  } catch (error) {
    console.error('App initialization error:', error);
  }
}

/**
 * Socket 事件监听
 */
function setupSocketListeners() {
  socketClient.on('player_join', (data) => {
    console.log('玩家加入:', data);
    if (state.inMultiplayerGame) {
      renderGame();
    }
  });

  socketClient.on('player_leave', (data) => {
    console.log('玩家离开:', data);
    if (state.inMultiplayerGame) {
      renderGame();
    }
  });

  socketClient.on('game_start', (data) => {
    console.log('游戏开始:', data);
    state.gameState = data;
    if (state.inMultiplayerGame) {
      renderGame();
    }
  });

  socketClient.on('deal_cards', (data) => {
    console.log('发牌:', data);
    state.myCards = data.holeCards;
    if (state.inMultiplayerGame) {
      renderGame();
    }
  });

  socketClient.on('player_action', (data) => {
    console.log('玩家操作:', data);
    if (state.inMultiplayerGame) {
      renderGame();
    }
  });

  socketClient.on('phase_change', (data) => {
    console.log('阶段变更:', data);
    if (state.inMultiplayerGame) {
      renderGame();
    }
  });

  socketClient.on('round_end', (data) => {
    console.log('回合结束:', data);
    if (state.inMultiplayerGame) {
      renderGame();
      alert(`回合结束！赢家: ${data.winners.map(w => w.playerName).join(', ')}`);
    }
  });

  socketClient.on('error', (error) => {
    console.error('Socket 错误:', error);
    alert(error.message || '发生错误');
  });
}

/**
 * 显示认证页面
 */
function showAuthPage() {
  const app = document.getElementById('app');
  const template = document.getElementById('auth-template');
  app.innerHTML = template.innerHTML;

  // 检查服务器状态
  checkServerConnection();
  setupAuthHandlers();
}

/**
 * 检查服务器连接
 */
async function checkServerConnection() {
  const { displayServerStatus } = await import('./utils/serverStatus.js');
  const isOnline = await displayServerStatus();

  // 每30秒检查一次
  setInterval(async () => {
    await displayServerStatus();
  }, 30000);
}

/**
 * 显示主页面
 */
function showMainPage() {
  console.log('Showing main page...');

  const app = document.getElementById('app');
  const template = document.getElementById('main-template');

  if (!app || !template) {
    console.error('App or template not found!');
    return;
  }

  app.innerHTML = template.innerHTML;

  // 使用 setTimeout 确保 DOM 完全渲染后再设置事件监听器
  setTimeout(() => {
    try {
      updateUserInfo();
      setupMainHandlers();
      showPage('lobby');

      // 延迟连接 Socket，避免页面加载时的错误
      setTimeout(() => {
        if (!socketClient.socket) {
          socketClient.connect();
        }
      }, 500);

      // 定期刷新房间列表
      setInterval(() => {
        if (state.currentPage === 'lobby') {
          loadRoomList();
        }
      }, 5000);

      loadRoomList();
    } catch (error) {
      console.error('Error in showMainPage:', error);
    }
  }, 0);

  console.log('Main page rendered');
}

/**
 * 加载房间列表
 */
async function loadRoomList() {
  try {
    const rooms = await roomManager.getRoomList();
    renderRoomList(rooms);
  } catch (error) {
    console.error('加载房间列表失败:', error);
  }
}

/**
 * 渲染房间列表
 */
function renderRoomList(rooms) {
  const container = document.getElementById('room-list');
  if (!container) return;

  if (rooms.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #666;">暂无房间</p>';
    return;
  }

  container.innerHTML = rooms.map(room => `
    <div class="room-card">
      <div class="room-name">${room.name}</div>
      <div class="room-info">
        <span>${room.playerCount}/${room.maxPlayers} 人</span>
        <span>盲注: ${room.smallBlind}/${room.bigBlind}</span>
      </div>
      <button class="btn btn-primary" onclick="joinRoom('${room.id}', ${room.hasPassword})">
        ${room.hasPassword ? '加入（密码）' : '加入'}
      </button>
    </div>
  `).join('');
}

/**
 * 设置认证页面处理器
 */
function setupAuthHandlers() {
  const tabs = document.querySelectorAll('.auth-tab');
  const forms = document.querySelectorAll('.auth-form');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      forms.forEach(form => {
        form.classList.remove('active');
        if (form.id === `${targetTab}-form`) {
          form.classList.add('active');
        }
      });
    });
  });

  const loginForm = document.getElementById('login-form');
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginForm.email.value;
    const password = loginForm.password.value;
    const errorEl = document.getElementById('login-error');

    errorEl.textContent = '登录中...';

    try {
      await auth.login(email, password);
      // Socket 将在 showMainPage 中延迟连接
      showMainPage();
    } catch (error) {
      console.error('登录错误:', error);
      errorEl.textContent = '登录失败: ' + error.message;
      errorEl.style.color = '#e74c3c';
    }
  });

  const registerForm = document.getElementById('register-form');
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = registerForm.username.value;
    const email = registerForm.email.value;
    const password = registerForm.password.value;
    const initialChips = parseInt(registerForm.initialChips.value);
    const errorEl = document.getElementById('register-error');

    errorEl.textContent = '注册中...';

    try {
      await auth.register(username, email, password, initialChips);
      // Socket 将在 showMainPage 中延迟连接
      showMainPage();
    } catch (error) {
      console.error('注册错误:', error);
      errorEl.textContent = '注册失败: ' + error.message;
      errorEl.style.color = '#e74c3c';
    }
  });
}

/**
 * 设置主页面处理器
 */
function setupMainHandlers() {
  console.log('Setting up main handlers...');

  // 导航按钮
  const navBtns = document.querySelectorAll('.nav-btn');
  console.log('Found nav buttons:', navBtns.length);

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page;
      console.log('Nav button clicked:', page);
      showPage(page);
    });
  });

  // 登出按钮
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      console.log('Logout button clicked');
      socketClient.disconnect();
      auth.logout();
      showAuthPage();
    });
  } else {
    console.error('Logout button not found!');
  }

  // 创建房间按钮
  const createRoomBtn = document.getElementById('create-room-btn');
  if (createRoomBtn) {
    createRoomBtn.addEventListener('click', showCreateRoomDialog);
  }

  // 快速匹配按钮
  const quickMatchBtn = document.getElementById('quick-match-btn');
  if (quickMatchBtn) {
    quickMatchBtn.addEventListener('click', () => {
      alert('快速匹配功能开发中...');
    });
  }

  // 单机游戏开始按钮
  const startSinglePlayerBtn = document.getElementById('start-single-player-btn');
  if (startSinglePlayerBtn) {
    startSinglePlayerBtn.addEventListener('click', async () => {
      await startSinglePlayerGame();
    });
  }

  console.log('Main handlers setup complete');
}

/**
 * 显示创建房间对话框
 */
function showCreateRoomDialog() {
  const name = prompt('房间名称:');
  if (!name) return;

  const password = prompt('房间密码（可选，留空则无密码）:');
  const maxPlayers = prompt('最大玩家数（2-6，默认6）:', '6');
  const smallBlind = prompt('小盲注（默认10）:', '10');

  try {
    roomManager.createRoom({
      name: name.trim(),
      password: password || null,
      maxPlayers: parseInt(maxPlayers) || 6,
      smallBlind: parseInt(smallBlind) || 10,
      bigBlind: (parseInt(smallBlind) || 10) * 2,
      buyIn: 1000
    }).then(room => {
      alert(`房间创建成功！房间ID: ${room.id}`);
      roomManager.joinRoom(room.id, password);
      state.inMultiplayerGame = true;
      showGameTable();
    }).catch(error => {
      alert('创建房间失败: ' + error.message);
    });
  } catch (error) {
    alert('输入无效');
  }
}

/**
 * 全局函数：加入房间
 */
window.joinRoom = function(roomId, hasPassword) {
  let password = null;

  if (hasPassword) {
    password = prompt('请输入房间密码:');
    if (password === null) return;
  }

  roomManager.joinRoom(roomId, password);
  state.inMultiplayerGame = true;
  showGameTable();
};

/**
 * 显示页面
 */
function showPage(pageName) {
  console.log('Showing page:', pageName);

  const pages = document.querySelectorAll('.page');
  const navBtns = document.querySelectorAll('.nav-btn');

  console.log('Found pages:', pages.length);
  console.log('Found nav buttons:', navBtns.length);

  pages.forEach(page => {
    page.classList.remove('active');
    if (page.id === `${pageName}-page`) {
      page.classList.add('active');
    }
  });

  navBtns.forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.page === pageName) {
      btn.classList.add('active');
    }
  });

  state.currentPage = pageName;
}

/**
 * 更新用户信息
 */
function updateUserInfo() {
  const user = auth.getCurrentUser();
  if (user) {
    const userNameEl = document.getElementById('user-name');
    const userChipsEl = document.getElementById('user-chips');

    if (userNameEl) userNameEl.textContent = user.username;
    if (userChipsEl) userChipsEl.textContent = `${user.chips.toLocaleString()} 筹码`;

    const profileUsername = document.getElementById('profile-username');
    const profileEmail = document.getElementById('profile-email');

    if (profileUsername) profileUsername.value = user.username;
    if (profileEmail) profileEmail.value = user.email;

    updateStats(user.stats);
  }
}

/**
 * 更新统计数据
 */
function updateStats(stats) {
  // 提供默认值
  const safeStats = stats || {
    gamesPlayed: 0,
    gamesWon: 0,
    totalEarnings: 0
  };

  console.log('Updating stats:', safeStats);

  const gamesPlayedEl = document.getElementById('stat-games-played');
  const gamesWonEl = document.getElementById('stat-games-won');
  const winRateEl = document.getElementById('stat-win-rate');
  const earningsEl = document.getElementById('stat-earnings');

  if (gamesPlayedEl) gamesPlayedEl.textContent = safeStats.gamesPlayed;
  if (gamesWonEl) gamesWonEl.textContent = safeStats.gamesWon;

  const winRate = safeStats.gamesPlayed > 0 ? Math.round((safeStats.gamesWon / safeStats.gamesPlayed) * 100) : 0;
  if (winRateEl) winRateEl.textContent = `${winRate}%`;

  if (earningsEl) earningsEl.textContent = safeStats.totalEarnings.toLocaleString();
}

/**
 * 显示游戏桌面
 */
function showGameTable() {
  const app = document.getElementById('app');
  const template = document.getElementById('game-table-template');
  app.innerHTML = template.innerHTML;

  // 根据游戏模式设置不同的处理器
  if (state.inSinglePlayerGame) {
    setupSinglePlayerGameHandlers();
  } else {
    setupGameHandlers();
  }

  renderGame();
}

/**
 * 设置游戏处理器
 */
function setupGameHandlers() {
  const leaveBtn = document.getElementById('leave-game-btn');
  leaveBtn.addEventListener('click', () => {
    if (confirm('确定要离开游戏吗？')) {
      roomManager.leaveRoom();
      state.inMultiplayerGame = false;
      state.gameState = null;
      state.myCards = [];
      showMainPage();
    }
  });

  const foldBtn = document.getElementById('fold-btn');
  const checkBtn = document.getElementById('check-btn');
  const callBtn = document.getElementById('call-btn');
  const raiseBtn = document.getElementById('raise-btn');
  const allinBtn = document.getElementById('allin-btn');

  foldBtn.addEventListener('click', () => playerAction('fold'));
  checkBtn.addEventListener('click', () => playerAction('check'));
  callBtn.addEventListener('click', () => playerAction('call'));
  raiseBtn.addEventListener('click', () => showRaiseSlider());
  allinBtn.addEventListener('click', () => playerAction('all-in'));

  const confirmRaiseBtn = document.getElementById('confirm-raise-btn');
  const cancelRaiseBtn = document.getElementById('cancel-raise-btn');
  const raiseAmount = document.getElementById('raise-amount');
  const raiseValue = document.getElementById('raise-value');

  raiseAmount.addEventListener('input', () => {
    raiseValue.textContent = raiseAmount.value;
  });

  confirmRaiseBtn.addEventListener('click', () => {
    const amount = parseInt(raiseAmount.value);
    playerAction('raise', amount);
    document.getElementById('raise-slider').style.display = 'none';
  });

  cancelRaiseBtn.addEventListener('click', () => {
    document.getElementById('raise-slider').style.display = 'none';
  });
}

/**
 * 玩家行动
 */
function playerAction(action, amount = 0) {
  if (state.inSinglePlayerGame) {
    playerActionInSinglePlayer(action, amount);
  } else if (state.inMultiplayerGame) {
    roomManager.playerAction(action, amount);
  }
}

/**
 * 渲染游戏
 */
function renderGame() {
  // 根据游戏模式选择渲染函数
  if (state.inSinglePlayerGame) {
    renderSinglePlayerGame();
    return;
  }

  if (!state.gameState) return;

  const gameState = state.gameState;

  // 更新阶段
  const phaseEl = document.getElementById('game-phase');
  if (phaseEl) {
    const phaseNames = {
      'preflop': '翻牌前',
      'flop': '翻牌',
      'turn': '转牌',
      'river': '河牌',
      'showdown': '摊牌'
    };
    phaseEl.textContent = phaseNames[gameState.phase] || gameState.phase;
  }

  // 渲染公共牌
  if (gameState.communityCards) {
    renderCommunityCards(gameState.communityCards);
  }

  // 渲染玩家
  if (gameState.players) {
    renderPlayerSeats(gameState);
  }

  // 更新操作按钮
  updateControls(gameState);
}

/**
 * 渲染公共牌
 */
function renderCommunityCards(cards) {
  const container = document.getElementById('community-cards');
  if (!container) return;

  container.innerHTML = cards.map(card => `
    <div class="card ${card.name.includes('♥') || card.name.includes('♦') ? 'red' : 'black'}">
      ${card.name}
    </div>
  `).join('');
}

/**
 * 渲染玩家座位
 */
function renderPlayerSeats(gameState) {
  const container = document.getElementById('player-seats');
  if (!container) return;

  const positions = [
    { top: '70%', left: '50%', transform: 'translate(-50%, -50%)' },  // 底部
    { top: '20%', left: '50%', transform: 'translate(-50%, -50%)' },  // 顶部
    { top: '30%', left: '12%', transform: 'translate(-50%, -50%)' },  // 左侧
    { top: '30%', left: '88%', transform: 'translate(-50%, -50%)' },  // 右侧
    { top: '70%', left: '12%', transform: 'translate(-50%, -50%)' },  // 左下
    { top: '70%', left: '88%', transform: 'translate(-50%, -50%)' }   // 右下
  ];

  const user = auth.getCurrentUser();

  container.innerHTML = gameState.players.map((player, index) => {
    const pos = positions[index % positions.length];
    const isMe = player.id === user.id;

    return `
      <div class="seat ${player.active ? 'active' : ''}"
           style="top: ${pos.top}; left: ${pos.left}; transform: ${pos.transform};">
        <div class="seat-info">
          <img class="seat-avatar" src="${player.avatar}" alt="头像">
          <div>
            <div class="seat-name">${player.name}</div>
            <div class="seat-chips">${player.chips.toLocaleString()}</div>
          </div>
        </div>
        <div class="seat-cards">
          ${isMe && state.myCards ? state.myCards.map(card => `
            <div class="card ${card.name.includes('♥') || card.name.includes('♦') ? 'red' : 'black'}">
              ${card.name}
            </div>
          `).join('') : '<div class="card face-down">?</div><div class="card face-down">?</div>'}
        </div>
        ${player.folded ? '<div class="seat-action">已弃牌</div>' : ''}
        ${player.allIn ? '<div class="seat-action">全下</div>' : ''}
      </div>
    `;
  }).join('');
}

/**
 * 更新操作按钮
 */
function updateControls(gameState) {
  const user = auth.getCurrentUser();
  const isMyTurn = gameState.currentPlayerIndex !== undefined &&
                   gameState.players &&
                   gameState.players[gameState.currentPlayerIndex]?.id === user.id;

  const buttons = document.querySelectorAll('.player-controls button:not(#confirm-raise-btn):not(#cancel-raise-btn)');
  buttons.forEach(btn => {
    btn.disabled = !isMyTurn;
  });
}

/**
 * 显示加注滑块
 */
function showRaiseSlider() {
  const slider = document.getElementById('raise-slider');
  slider.style.display = 'block';
}

/**
 * 开始单机游戏
 */
async function startSinglePlayerGame() {
  try {
    console.log('开始加载游戏模块...');

    // 动态导入游戏模块
    const gameModule = await import('./game/Game.js');
    const playerModule = await import('./game/Player.js');
    const aiModule = await import('./ai/AIPlayer.js');

    console.log('Game module:', gameModule);
    console.log('Game module default:', gameModule.default);
    console.log('Player module:', playerModule);

    const { default: Game } = gameModule;
    const { default: Player } = playerModule;
    const { default: AIPlayer } = aiModule;

    console.log('Game class:', typeof Game);
    console.log('Player class:', typeof Player);
    console.log('AIPlayer class:', typeof AIPlayer);

    // 获取配置
    const aiCount = parseInt(document.getElementById('ai-count').value);
    const difficulty = document.getElementById('ai-difficulty').value;
    const smallBlind = parseInt(document.getElementById('small-blind').value);

    // 创建游戏
    const game = new Game({
      smallBlind,
      bigBlind: smallBlind * 2
    });

    // 获取当前用户
    const user = auth.getCurrentUser();

    // 添加人类玩家
    const humanPlayer = new Player(user.id, user.username, user.chips, false);
    game.addPlayer(humanPlayer);

    // 添加AI玩家（使用 AI-1, AI-2 格式）
    for (let i = 0; i < aiCount; i++) {
      const aiName = `AI-${i + 1}`;
      const aiId = `ai-${Date.now()}-${i}`; // 生成唯一的AI ID
      const ai = new AIPlayer(aiId, aiName, 5000, difficulty);
      game.addPlayer(ai);
    }

    // 保存游戏状态
    state.game = game;
    state.inSinglePlayerGame = true;
    state.myHoleCards = [];
    state.lastShowdownResults = null;  // 重置 showdown 结果

    // 显示游戏桌面
    showGameTable();

    // 开始游戏
    try {
      const result = game.startNewRound();
      console.log('游戏开始:', result);

      // 设置玩家底牌
      const me = game.players.find(p => p.id === user.id);
      console.log('找到人类玩家:', me);
      if (me && me.holeCards) {
        state.myHoleCards = me.holeCards.map(c => c.toJSON());
      }

      // 调试信息：显示所有玩家
      console.log('所有玩家:');
      game.players.forEach((p, i) => {
        console.log(`  [${i}] ID: ${p.id}, Name: ${p.name}, isAI: ${p.isAI}`);
      });

      // 调试信息：当前玩家
      console.log('当前玩家索引:', game.currentPlayerIndex);
      console.log('当前玩家:', game.players[game.currentPlayerIndex]);

      renderSinglePlayerGame();
    } catch (error) {
      console.error('游戏启动错误:', error);
      alert('游戏启动失败: ' + error.message);
      showMainPage();
    }
  } catch (error) {
    console.error('加载游戏模块错误:', error);
    alert('加载游戏失败: ' + error.message);
  }
}

/**
 * 更新游戏状态消息
 */
function updateGameStatusMessage(message) {
  const statusEl = document.getElementById('game-status-message');
  if (statusEl) {
    statusEl.textContent = message;
    console.log('游戏状态:', message);
  }
}

/**
 * 设置玩家操作按钮的事件监听器
 */
function setupPlayerButtonHandlers() {
  console.log('设置玩家按钮事件监听器...');

  // 玩家操作按钮
  const foldBtn = document.getElementById('fold-btn');
  const checkBtn = document.getElementById('check-btn');
  const callBtn = document.getElementById('call-btn');
  const raiseBtn = document.getElementById('raise-btn');
  const allinBtn = document.getElementById('allin-btn');

  if (!foldBtn || !checkBtn || !callBtn || !raiseBtn || !allinBtn) {
    console.error('Some buttons not found!');
    return;
  }

  // 添加事件监听器
  foldBtn.addEventListener('click', (e) => {
    console.log('Fold button clicked');
    e.preventDefault();
    e.stopPropagation();
    playerActionInSinglePlayer('fold');
  });

  checkBtn.addEventListener('click', (e) => {
    console.log('Check button clicked');
    e.preventDefault();
    e.stopPropagation();
    playerActionInSinglePlayer('check');
  });

  callBtn.addEventListener('click', (e) => {
    console.log('Call button clicked');
    e.preventDefault();
    e.stopPropagation();
    playerActionInSinglePlayer('call');
  });

  raiseBtn.addEventListener('click', (e) => {
    console.log('Raise button clicked');
    e.preventDefault();
    e.stopPropagation();
    const slider = document.getElementById('raise-slider');
    const input = document.getElementById('raise-amount');
    const minRaiseSpan = document.getElementById('min-raise');
    const maxRaiseSpan = document.getElementById('max-raise');
    const errorDiv = document.getElementById('raise-error');
    const user = auth.getCurrentUser();
    const me = state.game.players.find(p => p.id === user.id);

    if (me && state.game) {
      // 最小加注：当前最大注的2倍，或至少是大盲注的2倍
      const minRaise = Math.max(state.game.currentBet * 2, state.game.bigBlind * 2);
      const maxRaise = me.chips;

      input.value = minRaise;
      input.min = minRaise;
      input.max = maxRaise;
      minRaiseSpan.textContent = minRaise;
      maxRaiseSpan.textContent = maxRaise;
      errorDiv.style.display = 'none';
      console.log(`设置加注范围: ${minRaise} - ${maxRaise}, 当前值: ${minRaise}`);
    }
    slider.style.display = 'block';
  });

  allinBtn.addEventListener('click', (e) => {
    console.log('All-in button clicked');
    e.preventDefault();
    e.stopPropagation();
    playerActionInSinglePlayer('all-in');
  });

  // 加注确认
  const confirmRaiseBtn = document.getElementById('confirm-raise-btn');
  const cancelRaiseBtn = document.getElementById('cancel-raise-btn');
  const decreaseRaiseBtn = document.getElementById('decrease-raise-btn');
  const increaseRaiseBtn = document.getElementById('increase-raise-btn');
  const raiseAmountInput = document.getElementById('raise-amount');
  const raiseErrorDiv = document.getElementById('raise-error');

  if (confirmRaiseBtn) {
    confirmRaiseBtn.addEventListener('click', (e) => {
      console.log('Confirm raise clicked');
      e.preventDefault();

      // 验证输入
      const amount = parseInt(raiseAmountInput.value);
      const user = auth.getCurrentUser();
      const me = state.game.players.find(p => p.id === user.id);

      if (me && state.game) {
        const minRaise = Math.max(state.game.currentBet * 2, state.game.bigBlind * 2);
        const maxRaise = me.chips;

        // 验证输入
        if (isNaN(amount)) {
          raiseErrorDiv.textContent = '请输入有效的数字';
          raiseErrorDiv.style.display = 'block';
          return;
        }

        if (amount < minRaise) {
          raiseErrorDiv.textContent = `加注金额不能少于 ${minRaise}`;
          raiseErrorDiv.style.display = 'block';
          return;
        }

        if (amount > maxRaise) {
          raiseErrorDiv.textContent = `加注金额不能超过您的筹码 ${maxRaise}`;
          raiseErrorDiv.style.display = 'block';
          return;
        }

        // 输入有效，执行加注
        playerActionInSinglePlayer('raise', amount);
        document.getElementById('raise-slider').style.display = 'none';
        raiseErrorDiv.style.display = 'none';
      }
    });
  }

  if (cancelRaiseBtn) {
    cancelRaiseBtn.addEventListener('click', (e) => {
      console.log('Cancel raise clicked');
      e.preventDefault();
      document.getElementById('raise-slider').style.display = 'none';
      if (raiseErrorDiv) {
        raiseErrorDiv.style.display = 'none';
      }
    });
  }

  // 减少加注金额按钮
  if (decreaseRaiseBtn && raiseAmountInput) {
    decreaseRaiseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const currentValue = parseInt(raiseAmountInput.value) || 0;
      const user = auth.getCurrentUser();
      const me = state.game.players.find(p => p.id === user.id);

      if (me && state.game) {
        const minRaise = Math.max(state.game.currentBet * 2, state.game.bigBlind * 2);
        const newValue = Math.max(minRaise, currentValue - 10);
        raiseAmountInput.value = newValue;
      }
    });
  }

  // 增加加注金额按钮
  if (increaseRaiseBtn && raiseAmountInput) {
    increaseRaiseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const currentValue = parseInt(raiseAmountInput.value) || 0;
      const user = auth.getCurrentUser();
      const me = state.game.players.find(p => p.id === user.id);

      if (me && state.game) {
        const maxRaise = me.chips;
        const newValue = Math.min(maxRaise, currentValue + 10);
        raiseAmountInput.value = newValue;
      }
    });
  }

  // 输入框验证
  if (raiseAmountInput) {
    raiseAmountInput.addEventListener('input', (e) => {
      // 清除错误提示
      if (raiseErrorDiv) {
        raiseErrorDiv.style.display = 'none';
      }
    });

    raiseAmountInput.addEventListener('blur', (e) => {
      const value = parseInt(e.target.value);
      const user = auth.getCurrentUser();
      const me = state.game.players.find(p => p.id === user.id);

      if (me && state.game && !isNaN(value)) {
        const minRaise = Math.max(state.game.currentBet * 2, state.game.bigBlind * 2);
        const maxRaise = me.chips;

        // 自动调整到合法范围
        if (value < minRaise) {
          e.target.value = minRaise;
        } else if (value > maxRaise) {
          e.target.value = maxRaise;
        }
      }
    });

    console.log('加注输入框事件监听器已设置');
  }

  console.log('玩家按钮事件监听器设置完成');
}

/**
 * 恢复原始的操作按钮
 */
function restorePlayerControls() {
  const playerControls = document.getElementById('player-controls');
  if (!playerControls) return;

  // 恢复原始的按钮HTML
  playerControls.innerHTML = `
    <button class="btn btn-danger" id="fold-btn">弃牌</button>
    <button class="btn btn-warning" id="check-btn">过牌</button>
    <button class="btn btn-info" id="call-btn">跟注</button>
    <button class="btn btn-success" id="raise-btn">加注</button>
    <button class="btn btn-primary" id="allin-btn">全下</button>
  `;

  // 设置事件监听器
  setupPlayerButtonHandlers();

  console.log('已恢复操作按钮');
}

/**
 * 显示"再开一局"按钮
 */
function showNewRoundButton() {
  const playerControls = document.getElementById('player-controls');
  if (!playerControls) return;

  // 移除旧的按钮（如果存在）
  const oldButton = document.getElementById('new-round-btn');
  if (oldButton) {
    oldButton.remove();
  }

  // 创建新按钮
  const newRoundBtn = document.createElement('button');
  newRoundBtn.id = 'new-round-btn';
  newRoundBtn.className = 'btn btn-success';
  newRoundBtn.textContent = '再开一局';
  newRoundBtn.style.fontSize = '18px';
  newRoundBtn.style.padding = '16px 32px';
  newRoundBtn.style.margin = '0 auto';

  newRoundBtn.addEventListener('click', () => {
    console.log('点击再开一局');
    startNewRoundInSinglePlayer();
  });

  // 清空并添加按钮
  playerControls.innerHTML = '';
  playerControls.appendChild(newRoundBtn);

  console.log('已显示"再开一局"按钮');
}

/**
 * 显示摊牌结果
 */
function showShowdownResults() {
  const statusEl = document.getElementById('game-status-message');
  if (!statusEl) return;

  if (!state.lastShowdownResults || !state.lastShowdownResults.results) {
    console.log('没有摊牌结果可显示');
    return;
  }

  const user = auth.getCurrentUser();

  // 创建结果HTML
  let resultsHTML = '<div style="text-align: left; max-width: 600px; margin: 0 auto;">';

  // 使用保存的 showdown 结果
  state.lastShowdownResults.results.forEach((result) => {
    const isWinner = result.isWinner;
    const isMe = result.playerId === user.id;

    // 获取玩家的底牌
    let cardsHTML = '';
    if (result.holeCards && result.holeCards.length > 0) {
      cardsHTML = result.holeCards.map(card =>
        `<span class="card ${card.name.includes('♥') || card.name.includes('♦') ? 'red' : 'black'}">${card.name}</span>`
      ).join(' ');
    }

    resultsHTML += `
      <div style="margin-bottom: 10px; padding: 10px; background: ${isWinner ? '#d4edda' : 'transparent'}; border-radius: 5px;">
        <strong style="color: ${isWinner ? '#155724' : '#333'};">
          ${isMe ? '★ ' : ''}${result.playerName}${isWinner ? ' (赢家!)' : ''}
        </strong><br>
        牌型: ${result.handName}<br>
        底牌: ${cardsHTML || '已弃牌'}
      </div>
    `;
  });

  resultsHTML += '</div>';

  // 更新状态消息
  statusEl.innerHTML = resultsHTML;
}

/**
 * 在单机游戏中开始新的一局
 */
function startNewRoundInSinglePlayer() {
  if (!state.game) {
    console.error('游戏对象不存在');
    return;
  }

  const user = auth.getCurrentUser();

  try {
    console.log('开始新的一局...');

    // 检查有多少玩家有足够的筹码继续游戏
    const playersWithChips = state.game.players.filter(p => p.chips >= state.game.smallBlind * 2);
    console.log(`有足够筹码的玩家数: ${playersWithChips.length}/${state.game.players.length}`);

    // 如果少于2名玩家有足够筹码，才补充筹码
    const INITIAL_CHIPS = 5000;
    let needRebuy = false;

    if (playersWithChips.length < 2) {
      console.log('少于2名玩家有足够筹码，为所有玩家补充筹码');
      state.game.players.forEach(player => {
        if (player.chips < state.game.smallBlind * 2) {
          console.log(`${player.name} 筹码不足，补充到 ${INITIAL_CHIPS}`);
          player.chips = INITIAL_CHIPS;
          player.active = true;
          needRebuy = true;
        }
      });
    } else {
      // 有足够玩家继续游戏，只补充完全没筹码的玩家
      state.game.players.forEach(player => {
        if (player.chips <= 0) {
          console.log(`${player.name} 筹码归零，补充到 ${INITIAL_CHIPS}`);
          player.chips = INITIAL_CHIPS;
          player.active = true;
          needRebuy = true;
        }
      });
    }

    if (needRebuy) {
      updateGameStatusMessage('已为筹码不足的玩家补充筹码');
    }

    // 重置游戏状态
    const result = state.game.startNewRound();
    console.log('新的一局开始:', result);

    // 重置 showdown 结果
    state.lastShowdownResults = null;

    // 更新玩家底牌
    const me = state.game.players.find(p => p.id === user.id);
    if (me && me.holeCards) {
      state.myHoleCards = me.holeCards.map(c => c.toJSON());
    }

    // 恢复操作按钮
    restorePlayerControls();

    // 重新渲染游戏
    renderSinglePlayerGame();
  } catch (error) {
    console.error('开始新的一局错误:', error);
    console.error('错误信息:', error.message);
    console.error('错误堆栈:', error.stack);

    // 显示详细错误信息
    const errorMessage = error.message || '未知错误';
    alert('开始新的一局失败: ' + errorMessage);

    // 如果错误是因为玩家不足，提示用户
    if (errorMessage.includes('至少2名玩家')) {
      // 检查每个玩家的状态
      console.log('玩家状态:');
      state.game.players.forEach((p, i) => {
        console.log(`  [${i}] ${p.name}: chips=${p.chips}, active=${p.active}, folded=${p.folded}`);
      });

      alert('所有AI都已失去筹码！游戏结束。');
      // 返回主页面
      state.game = null;
      state.inSinglePlayerGame = false;
      state.myHoleCards = [];
      showMainPage();
    }
  }
}

/**
 * 渲染单机游戏
 */
function renderSinglePlayerGame() {
  if (!state.game) return;

  const gameState = state.game.getState();
  console.log('渲染游戏状态 - 阶段:', gameState.phase, '当前玩家索引:', gameState.currentPlayerIndex);

  // 更新阶段
  const phaseEl = document.getElementById('game-phase');
  if (phaseEl) {
    const phaseNames = {
      'preflop': '翻牌前',
      'flop': '翻牌',
      'turn': '转牌',
      'river': '河牌',
      'showdown': '摊牌'
    };
    phaseEl.textContent = phaseNames[gameState.phase] || gameState.phase;
  }

  // 更新底池
  const potEl = document.getElementById('pot-amount');
  if (potEl) potEl.textContent = gameState.pot.toLocaleString();

  // 渲染公共牌
  if (gameState.communityCards && gameState.communityCards.length > 0) {
    renderCommunityCards(gameState.communityCards);
  } else {
    const container = document.getElementById('community-cards');
    if (container) container.innerHTML = '';
  }

  // 渲染玩家座位
  renderSinglePlayerSeats(gameState);

  // 更新操作按钮和状态消息
  updateSinglePlayerControls(gameState);

  // 只在游戏进行中且不是摊牌阶段时才处理AI
  if (state.game.isRoundActive && gameState.phase !== 'showdown') {
    setTimeout(() => processAITurn(), 1000);
  }
}

/**
 * 渲染单机游戏玩家座位
 */
function renderSinglePlayerSeats(gameState) {
  const container = document.getElementById('player-seats');
  if (!container) return;

  const positions = [
    { top: '70%', left: '50%', transform: 'translate(-50%, -50%)' },  // 底部（玩家）
    { top: '20%', left: '50%', transform: 'translate(-50%, -50%)' },  // 顶部
    { top: '30%', left: '12%', transform: 'translate(-50%, -50%)' },  // 左侧
    { top: '30%', left: '88%', transform: 'translate(-50%, -50%)' },  // 右侧
    { top: '70%', left: '12%', transform: 'translate(-50%, -50%)' },  // 左下
    { top: '70%', left: '88%', transform: 'translate(-50%, -50%)' }   // 右下
  ];

  const user = auth.getCurrentUser();

  container.innerHTML = gameState.players.map((player, index) => {
    const pos = positions[index % positions.length];
    const isCurrentPlayer = index === gameState.currentPlayerIndex;
    const isMe = player.id === user.id;
    const isShowdown = gameState.phase === 'showdown';

    // 处理头像 - 使用 data URI 作为默认头像
    const avatar = player.avatar || '/assets/default-avatar.png';
    const avatarUrl = avatar.startsWith('http') || avatar.startsWith('data:')
      ? avatar
      : `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzNiIgaGVpZ2h0PSIzNiIgdmlld0JveD0iMCAwIDM2I+PGNpcmNsZSBjeD0iMTgiIGN5PSIxOCIgcj0iMTgiIGZpbGw9IiNmZmZmZmYiLz48L3N2Zz4`;

    // 在摊牌阶段，显示所有未弃牌玩家的底牌
    let cardsHtml = '';
    if (isMe && state.myHoleCards && state.myHoleCards.length > 0) {
      // 显示自己的底牌
      cardsHtml = state.myHoleCards.map(card => `
        <div class="card ${card.name.includes('♥') || card.name.includes('♦') ? 'red' : 'black'}">
          ${card.name}
        </div>
      `).join('');
    } else if (isShowdown && !player.folded && player.holeCards && player.holeCards.length > 0) {
      // 摊牌阶段显示未弃牌玩家的底牌
      cardsHtml = player.holeCards.map(card => `
        <div class="card ${card.name.includes('♥') || card.name.includes('♦') ? 'red' : 'black'}">
          ${card.name}
        </div>
      `).join('');
    } else {
      // 隐藏底牌
      cardsHtml = '<div class="card face-down">?</div><div class="card face-down">?</div>';
    }

    return `
      <div class="seat ${isCurrentPlayer ? 'current-turn' : ''} ${player.active ? 'active' : ''}"
           style="top: ${pos.top}; left: ${pos.left}; transform: ${pos.transform};">
        <div class="seat-info">
          <img class="seat-avatar" src="${avatarUrl}" alt="${player.name}">
          <div>
            <div class="seat-name">${player.name}</div>
            <div class="seat-chips">${player.chips.toLocaleString()}</div>
          </div>
        </div>
        <div class="seat-cards">
          ${cardsHtml}
        </div>
        ${player.currentRoundBet > 0 ? `<div class="seat-action">下注: ${player.currentRoundBet}</div>` : ''}
        ${player.folded ? '<div class="seat-action">已弃牌</div>' : ''}
        ${player.allIn ? '<div class="seat-action">全下</div>' : ''}
      </div>
    `;
  }).join('');
}

/**
 * 更新单机游戏操作按钮
 */
function updateSinglePlayerControls(gameState) {
  const user = auth.getCurrentUser();
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];

  console.log('===== 更新控制按钮 =====');
  console.log('user.id:', user.id, '类型:', typeof user.id);
  console.log('currentPlayer:', currentPlayer);
  console.log('currentPlayer.id:', currentPlayer?.id, '类型:', typeof currentPlayer?.id);
  console.log('currentPlayerIndex:', gameState.currentPlayerIndex);

  // 检查每个玩家的ID
  gameState.players.forEach((p, i) => {
    console.log(`玩家[${i}]: id=${p.id} (${typeof p.id}), name=${p.name}, isAI=${p.isAI}`);
  });

  const isMyTurn = currentPlayer && isSameId(currentPlayer.id, user.id);
  const isGameEnded = gameState.phase === 'showdown' || !gameState.isRoundActive;

  console.log('是否我的回合:', isMyTurn, '游戏结束:', isGameEnded);

  // 更新状态消息
  if (currentPlayer) {
    if (gameState.phase === 'showdown') {
      // 检查是否有玩家输光筹码
      const playersWithNoChips = state.game.players.filter(p => p.chips < state.game.smallBlind * 2);
      if (playersWithNoChips.length > 0) {
        updateGameStatusMessage('摊牌！游戏结束 - 部分玩家筹码已用完');
      } else {
        updateGameStatusMessage('摊牌！查看结果');
      }
      showNewRoundButton();
      showShowdownResults();
    } else if (isMyTurn) {
      updateGameStatusMessage('轮到你了！请选择操作');
    } else if (currentPlayer.isAI) {
      updateGameStatusMessage(`${currentPlayer.name} 正在思考...`);
    } else {
      updateGameStatusMessage(`等待 ${currentPlayer.name} 行动...`);
    }
  }

  // 如果游戏已结束，不继续处理按钮
  if (isGameEnded) {
    return;
  }

  // 根据是否我的回合禁用/启用按钮
  const buttons = document.querySelectorAll('.player-controls button:not(#confirm-raise-btn):not(#cancel-raise-btn)');
  buttons.forEach(btn => {
    btn.disabled = !isMyTurn;
    console.log('按钮:', btn.id, 'disabled:', !isMyTurn);
  });

  // 如果进入 showdown 且没有保存的结果，从 game 获取
  if (gameState.phase === 'showdown' && !state.lastShowdownResults) {
    console.log('进入 showdown，获取摊牌结果');

    // 评估所有未弃牌玩家
    const activePlayers = state.game.players.filter(p => !p.folded);
    console.log('未弃牌玩家数:', activePlayers.length);

    if (activePlayers.length === 0) {
      console.log('没有未弃牌的玩家');
      return;
    }

    const results = activePlayers.map(player => {
      console.log(`评估玩家 ${player.name} 的手牌...`);
      console.log(`  底牌:`, player.holeCards);
      console.log(`  公共牌:`, state.game.communityCards);

      const evaluation = state.game.evaluator.evaluate(
        player.holeCards,
        state.game.communityCards
      );

      console.log(`  牌型: ${evaluation.name} (rank: ${evaluation.rank})`);

      return {
        playerId: player.id,
        playerName: player.name,
        handRank: evaluation.rank,
        handName: evaluation.name,
        holeCards: player.holeCards.map(c => c.toJSON()),
        isWinner: false
      };
    });

    // 找出赢家（牌力最强的）
    results.sort((a, b) => {
      const comparison = state.game.evaluator.compareHands(
        { rank: b.handRank },
        { rank: a.handRank }
      );
      return comparison;
    });

    const winnerResult = results[0];
    console.log('赢家:', winnerResult.playerName, '牌型:', winnerResult.handName);

    // 标记所有赢家（可能有平局）
    results.forEach(r => {
      const comparison = state.game.evaluator.compareHands(
        { rank: r.handRank },
        { rank: winnerResult.handRank }
      );
      r.isWinner = comparison === 0;
    });

    const winners = results.filter(r => r.isWinner);

    state.lastShowdownResults = {
      results: results,
      winners: winners.map(r => ({
        playerId: r.playerId,
        playerName: r.playerName,
        amount: 0
      })),
      pot: state.game.pot
    };

    console.log('生成的 showdown 结果:', state.lastShowdownResults);
  }

  // 根据当前状态显示/隐藏按钮
  const checkBtn = document.getElementById('check-btn');
  const callBtn = document.getElementById('call-btn');

  if (gameState.currentBet === 0) {
    if (checkBtn) {
      checkBtn.style.display = 'inline-block';
    }
    if (callBtn) {
      callBtn.style.display = 'none';
    }
  } else {
    if (checkBtn) {
      checkBtn.style.display = 'none';
    }
    if (callBtn) {
      callBtn.style.display = 'inline-block';
    }
  }

  console.log('===== 更新控制按钮结束 =====');
}

/**
 * 玩家行动（单机模式）
 */
function playerActionInSinglePlayer(action, amount = 0) {
  console.log('playerActionInSinglePlayer called with:', action, amount);

  if (!state.game || !state.inSinglePlayerGame) {
    console.error('Game not active!');
    return;
  }

  const user = auth.getCurrentUser();
  console.log('Current user:', user.id);
  console.log('Game state:', state.game.getState());

  // 显示操作消息
  const actionNames = {
    'fold': '弃牌',
    'check': '过牌',
    'call': `跟注 ${amount}`,
    'raise': `加注到 ${amount}`,
    'all-in': '全下'
  };
  updateGameStatusMessage(`你${actionNames[action] || action}`);

  try {
    const result = state.game.playerAction(user.id, action, amount);
    console.log('玩家操作结果:', result);

    // 检查是否只剩一名玩家（在玩家行动后）
    const activePlayers = state.game.players.filter(p => !p.folded);
    if (activePlayers.length === 1) {
      console.log('玩家行动后只剩一名玩家，结束游戏');
      const winner = activePlayers[0];
      const winAmount = state.game.pot;

      // 手动创建 showdown 结果
      state.lastShowdownResults = {
        results: [{
          playerId: winner.id,
          playerName: winner.name,
          handRank: 0,
          handName: '其他玩家弃牌',
          holeCards: [],
          isWinner: true
        }],
        winners: [{
          playerId: winner.id,
          playerName: winner.name,
          amount: winAmount
        }],
        pot: winAmount
      };

      winner.chips += winAmount;
      state.game.pot = 0;
      state.game.isRoundActive = false;
      state.game.currentPhase = 'showdown';

      renderSinglePlayerGame();
      return;
    }

    // 处理阶段结束
    if (result.phaseEnd) {
      if (result.roundEnd) {
        // 回合结束，保存 showdown 结果
        if (result.results) {
          state.lastShowdownResults = {
            results: result.results,
            winners: result.winners,
            pot: result.pot
          };
          console.log('保存 showdown 结果:', state.lastShowdownResults);
        }
        // 回合结束
        if (result.winners) {
          alert(`回合结束！赢家: ${result.winners.map(w => w.playerName).join(', ')}`);
        }
      }
      // 不需要手动更新 communityCards，Game 对象已经管理了
    }

    renderSinglePlayerGame();
  } catch (error) {
    console.error('玩家操作错误:', error);
    console.error('错误名称:', error.name);
    console.error('错误信息:', error.message);
    console.error('错误堆栈:', error.stack);

    // 显示友好的错误消息
    const errorMessage = error.message || '未知错误';
    alert(`操作失败: ${errorMessage}`);

    // 重新渲染游戏以恢复状态
    renderSinglePlayerGame();
  }
}

/**
 * 处理AI回合
 */
function processAITurn() {
  if (!state.game || !state.inSinglePlayerGame) {
    console.log('processAITurn: 游戏未激活');
    return;
  }

  const gameState = state.game.getState();
  const currentPlayerIndex = state.game.currentPlayerIndex;
  const currentPlayer = state.game.players[currentPlayerIndex];

  console.log('===== processAITurn =====');
  console.log('当前玩家索引:', currentPlayerIndex);
  console.log('当前玩家:', currentPlayer?.name, 'isAI:', currentPlayer?.isAI, 'folded:', currentPlayer?.folded, 'hasAllIn:', currentPlayer?.hasAllIn);

  // 检查游戏是否还在进行
  if (!state.game.isRoundActive || gameState.phase === 'showdown') {
    console.log('游戏已结束或进入摊牌，停止AI处理');
    console.log('===== processAITurn 结束 =====');
    return;
  }

  // 首先检查是否只剩一名玩家（这个检查必须在最前面）
  const activePlayers = state.game.players.filter(p => !p.folded);
  console.log('未弃牌玩家数:', activePlayers.length);

  if (activePlayers.length === 1) {
    console.log('只剩一名玩家，游戏应该立即结束');
    // 结束游戏回合
    const winner = activePlayers[0];
    const winAmount = state.game.pot;

    // 手动创建 showdown 结果
    state.lastShowdownResults = {
      results: [{
        playerId: winner.id,
        playerName: winner.name,
        handRank: 0,
        handName: '其他玩家弃牌',
        holeCards: [],
        isWinner: true
      }],
      winners: [{
        playerId: winner.id,
        playerName: winner.name,
        amount: winAmount
      }],
      pot: winAmount
    };

    // 分配底池
    winner.chips += winAmount;
    state.game.pot = 0;
    state.game.isRoundActive = false;
    state.game.currentPhase = 'showdown';

    console.log(`赢家 ${winner.name} 获得 ${winAmount} 筹码`);

    setTimeout(() => {
      renderSinglePlayerGame();
    }, 100);
    console.log('===== processAITurn 结束 =====');
    return;
  }

  // 如果当前玩家已弃牌或不存在，说明状态有问题，尝试修复
  if (!currentPlayer || currentPlayer.folded || !currentPlayer.isAI) {
    console.log('当前玩家状态异常或不是AI，跳过');
    console.log('currentPlayer存在:', !!currentPlayer);
    console.log('currentPlayer.folded:', currentPlayer?.folded);
    console.log('currentPlayer.isAI:', currentPlayer?.isAI);

    // 如果当前玩家已弃牌，尝试移动到下一个玩家
    if (currentPlayer && currentPlayer.folded) {
      console.log('尝试移动到下一个玩家');
      const moved = state.game.moveToNextPlayer();
      const result = state.game.checkPhaseEnd();

      if (result.roundEnd) {
        // 保存 showdown 结果
        if (result.results) {
          state.lastShowdownResults = {
            results: result.results,
            winners: result.winners,
            pot: result.pot
          };
          console.log('保存 showdown 结果:', state.lastShowdownResults);
        }
        // 回合结束
        if (result.winners) {
          setTimeout(() => {
            alert(`回合结束！赢家: ${result.winners.map(w => w.playerName).join(', ')}`);
          }, 500);
        } else if (result.winner) {
          setTimeout(() => {
            alert(`回合结束！赢家: ${result.winner.name}`);
            result.winner.chips += state.game.pot;
            renderSinglePlayerGame();
          }, 500);
        }
      } else {
        // 继续处理
        renderSinglePlayerGame();
        if (!result.phaseEnd) {
          setTimeout(() => processAITurn(), 1000);
        }
      }
    }

    console.log('===== processAITurn 结束 =====');
    return;
  }

  const user = auth.getCurrentUser();
  const isMyTurn = isSameId(currentPlayer.id, user.id);

  console.log('user.id:', user.id);
  console.log('currentPlayer.id:', currentPlayer.id);
  console.log('是否人类玩家回合:', isMyTurn);

  // 如果是人类玩家回合，不处理AI
  if (isMyTurn) {
    console.log('是人类玩家回合，不处理AI');
    console.log('===== processAITurn 结束 =====');
    return;
  }

  console.log('AI思考中:', currentPlayer.name);
  updateGameStatusMessage(`${currentPlayer.name} 正在思考...`);

  // AI决策
  setTimeout(() => {
    try {
      const action = currentPlayer.decide(state.game);
      console.log('AI决策:', action);

      const result = state.game.playerAction(currentPlayer.id, action.type, action.amount);
      console.log('AI操作结果:', result);

      // 检查是否只剩一名玩家（在AI行动后）
      const activePlayers = state.game.players.filter(p => !p.folded);
      if (activePlayers.length === 1) {
        console.log('AI行动后只剩一名玩家，结束游戏');
        const winner = activePlayers[0];
        const winAmount = state.game.pot;

        // 手动创建 showdown 结果
        state.lastShowdownResults = {
          results: [{
            playerId: winner.id,
            playerName: winner.name,
            handRank: 0,
            handName: '其他玩家弃牌',
            holeCards: [],
            isWinner: true
          }],
          winners: [{
            playerId: winner.id,
            playerName: winner.name,
            amount: winAmount
          }],
          pot: winAmount
        };

        winner.chips += winAmount;
        state.game.pot = 0;
        state.game.isRoundActive = false;
        state.game.currentPhase = 'showdown';

        renderSinglePlayerGame();
        return;
      }

      // 检查是否回合结束
      if (result.phaseEnd && result.roundEnd) {
        // 保存 showdown 结果
        if (result.results) {
          state.lastShowdownResults = {
            results: result.results,
            winners: result.winners,
            pot: result.pot
          };
          console.log('保存 showdown 结果:', state.lastShowdownResults);
        }
        if (result.winners) {
          setTimeout(() => {
            alert(`回合结束！赢家: ${result.winners.map(w => w.playerName).join(', ')}`);
          }, 500);
        }
        // 渲染游戏以显示"再开一局"按钮
        renderSinglePlayerGame();
        return; // 回合结束，不再继续AI
      }

      renderSinglePlayerGame();

      // 继续下一个AI
      setTimeout(() => processAITurn(), 1500);
    } catch (error) {
      console.error('AI操作错误:', error);
      // 出错时也尝试继续游戏
      renderSinglePlayerGame();
    }
  }, 1000);
}

/**
 * 设置单机游戏处理器
 */
function setupSinglePlayerGameHandlers() {
  console.log('Setting up single player game handlers...');

  // 玩家操作按钮
  const foldBtn = document.getElementById('fold-btn');
  const checkBtn = document.getElementById('check-btn');
  const callBtn = document.getElementById('call-btn');
  const raiseBtn = document.getElementById('raise-btn');
  const allinBtn = document.getElementById('allin-btn');

  console.log('Button elements:', { foldBtn, checkBtn, callBtn, raiseBtn, allinBtn });

  if (!foldBtn || !checkBtn || !callBtn || !raiseBtn || !allinBtn) {
    console.error('Some buttons not found!');
    return;
  }

  // 移除旧的事件监听器（如果存在）
  const newFoldBtn = foldBtn.cloneNode(true);
  const newCheckBtn = checkBtn.cloneNode(true);
  const newCallBtn = callBtn.cloneNode(true);
  const newRaiseBtn = raiseBtn.cloneNode(true);
  const newAllinBtn = allinBtn.cloneNode(true);

  foldBtn.parentNode.replaceChild(newFoldBtn, foldBtn);
  checkBtn.parentNode.replaceChild(newCheckBtn, checkBtn);
  callBtn.parentNode.replaceChild(newCallBtn, callBtn);
  raiseBtn.parentNode.replaceChild(newRaiseBtn, raiseBtn);
  allinBtn.parentNode.replaceChild(newAllinBtn, allinBtn);

  // 添加新的事件监听器
  newFoldBtn.addEventListener('click', (e) => {
    console.log('Fold button clicked');
    e.preventDefault();
    e.stopPropagation();
    playerActionInSinglePlayer('fold');
  });

  newCheckBtn.addEventListener('click', (e) => {
    console.log('Check button clicked');
    e.preventDefault();
    e.stopPropagation();
    playerActionInSinglePlayer('check');
  });

  newCallBtn.addEventListener('click', (e) => {
    console.log('Call button clicked');
    e.preventDefault();
    e.stopPropagation();
    playerActionInSinglePlayer('call');
  });

  newRaiseBtn.addEventListener('click', (e) => {
    console.log('Raise button clicked');
    e.preventDefault();
    e.stopPropagation();
    const slider = document.getElementById('raise-slider');
    const input = document.getElementById('raise-amount');
    const minRaiseSpan = document.getElementById('min-raise');
    const maxRaiseSpan = document.getElementById('max-raise');
    const errorDiv = document.getElementById('raise-error');
    const user = auth.getCurrentUser();
    const me = state.game.players.find(p => p.id === user.id);

    if (me && state.game) {
      // 最小加注：当前最大注的2倍，或至少是大盲注的2倍
      const minRaise = Math.max(state.game.currentBet * 2, state.game.bigBlind * 2);
      const maxRaise = me.chips;

      input.value = minRaise;
      input.min = minRaise;
      input.max = maxRaise;
      minRaiseSpan.textContent = minRaise;
      maxRaiseSpan.textContent = maxRaise;
      errorDiv.style.display = 'none';
      console.log(`设置加注范围: ${minRaise} - ${maxRaise}, 当前值: ${minRaise}`);
    }
    slider.style.display = 'block';
  });

  newAllinBtn.addEventListener('click', (e) => {
    console.log('All-in button clicked');
    e.preventDefault();
    e.stopPropagation();
    playerActionInSinglePlayer('all-in');
  });

  // 加注相关按钮和输入框
  const decreaseRaiseBtn = document.getElementById('decrease-raise-btn');
  const increaseRaiseBtn = document.getElementById('increase-raise-btn');
  const raiseAmountInput = document.getElementById('raise-amount');
  const raiseErrorDiv = document.getElementById('raise-error');
  const confirmRaiseBtn = document.getElementById('confirm-raise-btn');
  const cancelRaiseBtn = document.getElementById('cancel-raise-btn');

  // 减少加注金额
  if (decreaseRaiseBtn && raiseAmountInput) {
    decreaseRaiseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const currentValue = parseInt(raiseAmountInput.value) || 0;
      const user = auth.getCurrentUser();
      const me = state.game.players.find(p => p.id === user.id);

      if (me && state.game) {
        const minRaise = Math.max(state.game.currentBet * 2, state.game.bigBlind * 2);
        const newValue = Math.max(minRaise, currentValue - 10);
        raiseAmountInput.value = newValue;
      }
    });
  }

  // 增加加注金额
  if (increaseRaiseBtn && raiseAmountInput) {
    increaseRaiseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const currentValue = parseInt(raiseAmountInput.value) || 0;
      const user = auth.getCurrentUser();
      const me = state.game.players.find(p => p.id === user.id);

      if (me && state.game) {
        const maxRaise = me.chips;
        const newValue = Math.min(maxRaise, currentValue + 10);
        raiseAmountInput.value = newValue;
      }
    });
  }

  // 输入框验证
  if (raiseAmountInput) {
    raiseAmountInput.addEventListener('input', (e) => {
      if (raiseErrorDiv) {
        raiseErrorDiv.style.display = 'none';
      }
    });

    raiseAmountInput.addEventListener('blur', (e) => {
      const value = parseInt(e.target.value);
      const user = auth.getCurrentUser();
      const me = state.game.players.find(p => p.id === user.id);

      if (me && state.game && !isNaN(value)) {
        const minRaise = Math.max(state.game.currentBet * 2, state.game.bigBlind * 2);
        const maxRaise = me.chips;

        // 自动调整到合法范围
        if (value < minRaise) {
          e.target.value = minRaise;
        } else if (value > maxRaise) {
          e.target.value = maxRaise;
        }
      }
    });
  }

  // 确认加注
  if (confirmRaiseBtn) {
    confirmRaiseBtn.addEventListener('click', (e) => {
      console.log('Confirm raise clicked');
      e.preventDefault();

      // 验证输入
      const amount = parseInt(raiseAmountInput.value);
      const user = auth.getCurrentUser();
      const me = state.game.players.find(p => p.id === user.id);

      if (me && state.game) {
        const minRaise = Math.max(state.game.currentBet * 2, state.game.bigBlind * 2);
        const maxRaise = me.chips;

        // 验证输入
        if (isNaN(amount)) {
          raiseErrorDiv.textContent = '请输入有效的数字';
          raiseErrorDiv.style.display = 'block';
          return;
        }

        if (amount < minRaise) {
          raiseErrorDiv.textContent = `加注金额不能少于 ${minRaise}`;
          raiseErrorDiv.style.display = 'block';
          return;
        }

        if (amount > maxRaise) {
          raiseErrorDiv.textContent = `加注金额不能超过您的筹码 ${maxRaise}`;
          raiseErrorDiv.style.display = 'block';
          return;
        }

        // 输入有效，执行加注
        playerActionInSinglePlayer('raise', amount);
        document.getElementById('raise-slider').style.display = 'none';
        raiseErrorDiv.style.display = 'none';
      }
    });
  }

  // 取消加注
  if (cancelRaiseBtn) {
    cancelRaiseBtn.addEventListener('click', (e) => {
      console.log('Cancel raise clicked');
      e.preventDefault();
      document.getElementById('raise-slider').style.display = 'none';
      if (raiseErrorDiv) {
        raiseErrorDiv.style.display = 'none';
      }
    });
  }

  // 离开游戏按钮
  const leaveBtn = document.getElementById('leave-game-btn');
  if (leaveBtn) {
    leaveBtn.addEventListener('click', () => {
      if (confirm('确定要离开游戏吗？')) {
        state.game = null;
        state.inSinglePlayerGame = false;
        state.myHoleCards = [];
        showMainPage();
      }
    });
  }

  console.log('Single player game handlers setup complete');
}

// 初始化应用
init();
