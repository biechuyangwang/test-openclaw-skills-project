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
  inMultiplayerGame: false
};

// 初始化应用
async function init() {
  setupSocketListeners();
  const app = document.getElementById('app');

  if (auth.isAuthenticated()) {
    socketClient.connect();
    showMainPage();
  } else {
    showAuthPage();
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
  setupAuthHandlers();
}

/**
 * 显示主页面
 */
function showMainPage() {
  const app = document.getElementById('app');
  const template = document.getElementById('main-template');
  app.innerHTML = template.innerHTML;

  updateUserInfo();
  setupMainHandlers();
  showPage('lobby');

  // 定期刷新房间列表
  setInterval(() => {
    if (state.currentPage === 'lobby') {
      loadRoomList();
    }
  }, 5000);

  loadRoomList();
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

    try {
      await auth.login(email, password);
      socketClient.connect();
      showMainPage();
    } catch (error) {
      errorEl.textContent = error.message;
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

    try {
      await auth.register(username, email, password, initialChips);
      socketClient.connect();
      showMainPage();
    } catch (error) {
      errorEl.textContent = error.message;
    }
  });
}

/**
 * 设置主页面处理器
 */
function setupMainHandlers() {
  // 导航按钮
  const navBtns = document.querySelectorAll('.nav-btn');
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page;
      showPage(page);
    });
  });

  // 登出按钮
  const logoutBtn = document.getElementById('logout-btn');
  logoutBtn.addEventListener('click', () => {
    socketClient.disconnect();
    auth.logout();
    showAuthPage();
  });

  // 创建房间按钮
  const createRoomBtn = document.getElementById('create-room-btn');
  createRoomBtn.addEventListener('click', showCreateRoomDialog);

  // 快速匹配按钮
  const quickMatchBtn = document.getElementById('quick-match-btn');
  quickMatchBtn.addEventListener('click', () => {
    alert('快速匹配功能开发中...');
  });

  // 单机游戏开始按钮
  const startSinglePlayerBtn = document.getElementById('start-single-player-btn');
  if (startSinglePlayerBtn) {
    startSinglePlayerBtn.addEventListener('click', () => {
      alert('单机游戏功能开发中，敬请期待！');
    });
  }
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
  const pages = document.querySelectorAll('.page');
  const navBtns = document.querySelectorAll('.nav-btn');

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
  const gamesPlayedEl = document.getElementById('stat-games-played');
  const gamesWonEl = document.getElementById('stat-games-won');
  const winRateEl = document.getElementById('stat-win-rate');
  const earningsEl = document.getElementById('stat-earnings');

  if (gamesPlayedEl) gamesPlayedEl.textContent = stats.gamesPlayed;
  if (gamesWonEl) gamesWonEl.textContent = stats.gamesWon;

  const winRate = stats.gamesPlayed > 0 ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0;
  if (winRateEl) winRateEl.textContent = `${winRate}%`;

  if (earningsEl) earningsEl.textContent = stats.totalEarnings.toLocaleString();
}

/**
 * 显示游戏桌面
 */
function showGameTable() {
  const app = document.getElementById('app');
  const template = document.getElementById('game-table-template');
  app.innerHTML = template.innerHTML;

  setupGameHandlers();
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
  if (state.inMultiplayerGame) {
    roomManager.playerAction(action, amount);
  }
}

/**
 * 渲染游戏
 */
function renderGame() {
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

// 初始化应用
init();
