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
  myHoleCards: []
};

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
    { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
    { top: '20%', left: '50%', transform: 'translate(-50%, -50%)' },
    { top: '35%', left: '15%', transform: 'translate(-50%, -50%)' },
    { top: '35%', left: '85%', transform: 'translate(-50%, -50%)' },
    { top: '65%', left: '15%', transform: 'translate(-50%, -50%)' },
    { top: '65%', left: '85%', transform: 'translate(-50%, -50%)' }
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

    // 添加AI玩家
    for (let i = 0; i < aiCount; i++) {
      const ai = new AIPlayer(`AI-${i + 1}`, 5000, difficulty);
      game.addPlayer(ai);
    }

    // 保存游戏状态
    state.game = game;
    state.inSinglePlayerGame = true;
    state.myHoleCards = [];

    // 显示游戏桌面
    showGameTable();

    // 开始游戏
    try {
      const result = game.startNewRound();
      console.log('游戏开始:', result);

      // 设置玩家底牌
      const me = game.players.find(p => p.id === user.id);
      if (me && me.holeCards) {
        state.myHoleCards = me.holeCards.map(c => c.toJSON());
      }

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
 * 渲染单机游戏
 */
function renderSinglePlayerGame() {
  if (!state.game) return;

  const gameState = state.game.getState();

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

  // 更新操作按钮
  updateSinglePlayerControls(gameState);

  // 如果当前是AI回合，自动执行AI操作
  setTimeout(() => processAITurn(), 1000);
}

/**
 * 渲染单机游戏玩家座位
 */
function renderSinglePlayerSeats(gameState) {
  const container = document.getElementById('player-seats');
  if (!container) return;

  const positions = [
    { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
    { top: '20%', left: '50%', transform: 'translate(-50%, -50%)' },
    { top: '35%', left: '15%', transform: 'translate(-50%, -50%)' },
    { top: '35%', left: '85%', transform: 'translate(-50%, -50%)' },
    { top: '65%', left: '15%', transform: 'translate(-50%, -50%)' },
    { top: '65%', left: '85%', transform: 'translate(-50%, -50%)' }
  ];

  const user = auth.getCurrentUser();

  container.innerHTML = gameState.players.map((player, index) => {
    const pos = positions[index % positions.length];
    const isCurrentPlayer = index === gameState.currentPlayerIndex;
    const isMe = player.id === user.id;

    return `
      <div class="seat ${isCurrentPlayer ? 'current-turn' : ''} ${player.active ? 'active' : ''}"
           style="top: ${pos.top}; left: ${pos.left}; transform: ${pos.transform};">
        <div class="seat-info">
          <img class="seat-avatar" src="${player.avatar}" alt="头像">
          <div>
            <div class="seat-name">${player.name}</div>
            <div class="seat-chips">${player.chips.toLocaleString()}</div>
          </div>
        </div>
        <div class="seat-cards">
          ${isMe && state.myHoleCards ? state.myHoleCards.map(card => `
            <div class="card ${card.name.includes('♥') || card.name.includes('♦') ? 'red' : 'black'}">
              ${card.name}
            </div>
          `).join('') : '<div class="card face-down">?</div><div class="card face-down">?</div>'}
        </div>
        ${player.bet > 0 ? `<div class="seat-action">下注: ${player.bet}</div>` : ''}
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
  const isMyTurn = currentPlayer && currentPlayer.id === user.id;

  const buttons = document.querySelectorAll('.player-controls button:not(#confirm-raise-btn):not(#cancel-raise-btn)');
  buttons.forEach(btn => {
    btn.disabled = !isMyTurn;
  });

  // 根据当前状态显示/隐藏按钮
  const checkBtn = document.getElementById('check-btn');
  const callBtn = document.getElementById('call-btn');

  if (gameState.currentBet === 0) {
    if (checkBtn) checkBtn.style.display = 'inline-block';
    if (callBtn) callBtn.style.display = 'none';
  } else {
    if (checkBtn) checkBtn.style.display = 'none';
    if (callBtn) callBtn.style.display = 'inline-block';
  }
}

/**
 * 玩家行动（单机模式）
 */
function playerActionInSinglePlayer(action, amount = 0) {
  if (!state.game || !state.inSinglePlayerGame) return;

  const user = auth.getCurrentUser();
  try {
    const result = state.game.playerAction(user.id, action, amount);
    console.log('玩家操作:', result);

    // 处理阶段结束
    if (result.phaseEnd) {
      if (result.roundEnd) {
        // 回合结束
        if (result.winners) {
          alert(`回合结束！赢家: ${result.winners.map(w => w.playerName).join(', ')}`);
        }
      } else {
        // 进入下一阶段，发公共牌
        if (result.communityCards) {
          state.game.communityCards = result.communityCards;
        }
      }
    }

    renderSinglePlayerGame();
  } catch (error) {
    console.error('玩家操作错误:', error);
    alert(error.message);
  }
}

/**
 * 处理AI回合
 */
function processAITurn() {
  if (!state.game || !state.inSinglePlayerGame) return;

  const currentPlayerIndex = state.game.currentPlayerIndex;
  const currentPlayer = state.game.players[currentPlayerIndex];

  // 如果不是AI或游戏结束，返回
  if (!currentPlayer || !currentPlayer.isAI || !state.game.isRoundActive) {
    return;
  }

  console.log('AI思考中:', currentPlayer.name);

  // AI决策
  setTimeout(() => {
    try {
      const action = currentPlayer.decide(state.game);
      console.log('AI决策:', action);

      const result = state.game.playerAction(currentPlayer.id, action.type, action.amount);
      console.log('AI操作结果:', result);

      // 检查是否回合结束
      if (result.phaseEnd && result.roundEnd) {
        if (result.winners) {
          setTimeout(() => {
            alert(`回合结束！赢家: ${result.winners.map(w => w.playerName).join(', ')}`);
          }, 500);
        }
      }

      renderSinglePlayerGame();

      // 继续下一个AI
      if (!result.roundEnd) {
        setTimeout(() => processAITurn(), 1500);
      }
    } catch (error) {
      console.error('AI操作错误:', error);
    }
  }, 1000);
}

/**
 * 设置单机游戏处理器
 */
function setupSinglePlayerGameHandlers() {
  // 玩家操作按钮
  const foldBtn = document.getElementById('fold-btn');
  const checkBtn = document.getElementById('check-btn');
  const callBtn = document.getElementById('call-btn');
  const raiseBtn = document.getElementById('raise-btn');
  const allinBtn = document.getElementById('allin-btn');

  foldBtn.addEventListener('click', () => playerActionInSinglePlayer('fold'));
  checkBtn.addEventListener('click', () => playerActionInSinglePlayer('check'));
  callBtn.addEventListener('click', () => playerActionInSinglePlayer('call'));

  raiseBtn.addEventListener('click', () => {
    const slider = document.getElementById('raise-slider');
    const input = document.getElementById('raise-amount');
    const user = auth.getCurrentUser();
    const me = state.game.players.find(p => p.id === user.id);

    if (me && state.game) {
      const minRaise = state.game.currentBet * 2;
      input.min = minRaise;
      input.max = me.chips;
      input.value = minRaise;
      document.getElementById('raise-value').textContent = minRaise;
    }
    slider.style.display = 'block';
  });

  allinBtn.addEventListener('click', () => playerActionInSinglePlayer('all-in'));

  // 加注确认
  const confirmRaiseBtn = document.getElementById('confirm-raise-btn');
  const cancelRaiseBtn = document.getElementById('cancel-raise-btn');

  confirmRaiseBtn.addEventListener('click', () => {
    const amount = parseInt(document.getElementById('raise-amount').value);
    playerActionInSinglePlayer('raise', amount);
    document.getElementById('raise-slider').style.display = 'none';
  });

  cancelRaiseBtn.addEventListener('click', () => {
    document.getElementById('raise-slider').style.display = 'none';
  });

  // 离开游戏按钮
  const leaveBtn = document.getElementById('leave-game-btn');
  leaveBtn.addEventListener('click', () => {
    if (confirm('确定要离开游戏吗？')) {
      state.game = null;
      state.inSinglePlayerGame = false;
      state.myHoleCards = [];
      showMainPage();
    }
  });
}

// 初始化应用
init();
