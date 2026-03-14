import Deck from './Deck';
import Player from './Player';
import HandEvaluator from './HandEvaluator';

/**
 * 游戏控制器
 */
class Game {
  constructor(config = {}) {
    this.players = [];
    this.deck = new Deck();
    this.evaluator = new HandEvaluator();
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;
    this.minBet = config.minBet || 20; // 大盲注
    this.smallBlind = config.smallBlind || 10;
    this.bigBlind = config.bigBlind || 20;

    // 游戏阶段
    this.phases = ['preflop', 'flop', 'turn', 'river', 'showdown'];
    this.currentPhase = 'preflop';

    // 玩家位置
    this.dealerPosition = 0;
    this.currentPlayerIndex = 0;
    this.lastAggressorIndex = -1;

    // 回合状态
    this.isRoundActive = false;
    this.lastAction = null;

    // 盲注位置
    this.smallBlindPosition = 0;
    this.bigBlindPosition = 0;
  }

  /**
   * 添加玩家
   */
  addPlayer(player) {
    if (this.players.length < 10) {
      this.players.push(player);
      return true;
    }
    return false;
  }

  /**
   * 移除玩家
   */
  removePlayer(playerId) {
    const index = this.players.findIndex(p => p.id === playerId);
    if (index !== -1) {
      this.players.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * 获取活跃玩家数量
   */
  getActivePlayerCount() {
    return this.players.filter(p => p.active).length;
  }

  /**
   * 开始新一轮
   */
  startNewRound() {
    // 重置状态
    this.deck.reset();
    this.deck.shuffle();
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = this.bigBlind;
    this.currentPhase = 'preflop';
    this.isRoundActive = true;

    // 先重置玩家状态（这会更新 active 标志）
    for (const player of this.players) {
      player.resetForNewRound();
    }

    // 检查是否有足够玩家（在重置后检查）
    const activePlayers = this.players.filter(p => p.active);
    if (activePlayers.length < 2) {
      throw new Error('需要至少2名玩家才能开始游戏');
    }

    // 移动庄家位置
    this.dealerPosition = (this.dealerPosition + 1) % this.players.length;
    this.smallBlindPosition = (this.dealerPosition + 1) % this.players.length;
    this.bigBlindPosition = (this.dealerPosition + 2) % this.players.length;

    // 收取盲注
    const sbPlayer = this.players[this.smallBlindPosition];
    const bbPlayer = this.players[this.bigBlindPosition];

    console.log(`[Game] 收取盲注 - SB位置: ${this.smallBlindPosition}, BB位置: ${this.bigBlindPosition}`);

    if (sbPlayer.active) {
      const sbAmount = sbPlayer.bet(this.smallBlind);
      this.pot += sbAmount;
      console.log(`[Game] ${sbPlayer.name} 下小盲 ${sbAmount}`);
    }

    if (bbPlayer.active) {
      const bbAmount = bbPlayer.bet(this.bigBlind);
      this.pot += bbAmount;
      console.log(`[Game] ${bbPlayer.name} 下大盲 ${bbAmount}`);
    }

    // 在翻牌前，盲注玩家不算作已行动（他们仍需跟注或加注）
    // 其他阶段盲注不算，所有人都没有行动
    console.log(`[Game] 盲注收取完成，底池: ${this.pot}`);

    // 发底牌
    for (const player of this.players) {
      if (player.active) {
        player.setHoleCards(this.deck.dealMultiple(2));
      }
    }

    // 设置第一个行动玩家（大盲注后面）
    this.currentPlayerIndex = (this.bigBlindPosition + 1) % this.players.length;
    this.lastAggressorIndex = this.bigBlindPosition;

    return {
      dealerPosition: this.dealerPosition,
      smallBlindPosition: this.smallBlindPosition,
      bigBlindPosition: this.bigBlindPosition,
      pot: this.pot,
      communityCards: this.communityCards.map(c => c.toJSON()),
      players: this.players.map(p => p.toJSON(true))
    };
  }

  /**
   * 玩家行动
   */
  playerAction(playerId, action, amount = 0) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) {
      throw new Error('玩家不存在');
    }

    // 详细的玩家状态检查
    console.log(`[Game] 玩家 ${player.name} 尝试 ${action}`);
    console.log(`[Game] 玩家状态: active=${player.active}, folded=${player.folded}, hasAllIn=${player.hasAllIn}`);
    console.log(`[Game] canAct()=${player.canAct()}`);

    if (!player.canAct()) {
      let reason = '';
      if (!player.active) reason = '玩家不在游戏中';
      else if (player.folded) reason = '玩家已弃牌';
      else if (player.hasAllIn) reason = '玩家已全下';
      throw new Error(`玩家无法行动: ${reason}`);
    }

    if (this.players[this.currentPlayerIndex].id !== playerId) {
      throw new Error('不是该玩家的回合');
    }

    // 检查是否只剩一名玩家（在行动之前检查）
    const playersNotFolded = this.players.filter(p => !p.folded);
    if (playersNotFolded.length === 1) {
      console.log(`[Game] 在玩家行动前检测到只剩一名玩家: ${playersNotFolded[0].name}`);
      return {
        action: { playerId, action },
        currentPlayerIndex: this.currentPlayerIndex,
        pot: this.pot,
        currentBet: this.currentBet,
        phaseEnd: true,
        roundEnd: true,
        winners: [{
          playerId: playersNotFolded[0].id,
          playerName: playersNotFolded[0].name,
          amount: this.pot
        }],
        pot: this.pot
      };
    }

    let betAmount = 0;

    switch (action) {
      case 'fold':
        player.fold();
        this.lastAction = { playerId, action: 'fold' };
        break;

      case 'check':
        if (this.currentBet > player.currentRoundBet) {
          throw new Error('不能过牌，需要跟注');
        }
        player.check();
        this.lastAction = { playerId, action: 'check' };
        break;

      case 'call':
        const callAmount = this.currentBet - player.currentRoundBet;
        betAmount = player.call(callAmount);
        this.pot += betAmount;
        this.lastAction = { playerId, action: 'call', amount: betAmount };
        break;

      case 'raise':
        const raiseAmount = this.currentBet - player.currentRoundBet + amount;
        if (raiseAmount > player.chips + player.currentRoundBet) {
          throw new Error('筹码不足');
        }
        betAmount = player.raise(raiseAmount);
        this.pot += betAmount;
        this.currentBet = player.currentRoundBet;
        this.lastAggressorIndex = this.players.indexOf(player);
        this.lastAction = { playerId, action: 'raise', amount: betAmount };
        break;

      case 'all-in':
        console.log(`[Game] 执行全下操作 - 玩家: ${player.name}, 筹码: ${player.chips}`);

        // 直接调用 allIn 方法（现在不会与属性冲突了）
        betAmount = player.allIn();
        this.pot += betAmount;
        console.log(`[Game] 全下完成 - 下注额: ${betAmount}, 当前本轮下注: ${player.currentRoundBet}, 游戏当前下注: ${this.currentBet}`);

        if (player.currentRoundBet > this.currentBet) {
          this.currentBet = player.currentRoundBet;
          this.lastAggressorIndex = this.players.indexOf(player);
          console.log(`[Game] 更新当前下注和最后加注者: ${this.currentBet}, 索引: ${this.lastAggressorIndex}`);
        }
        this.lastAction = { playerId, action: 'all-in', amount: betAmount };
        break;

      default:
        throw new Error('无效的操作');
    }

    // 标记该玩家已行动
    player.hasActed = true;

    // 移动到下一个玩家
    const movedToEnd = this.moveToNextPlayer();

    // 检查是否需要进入下一阶段
    const phaseResult = this.checkPhaseEnd();

    return {
      action: this.lastAction,
      currentPlayerIndex: this.currentPlayerIndex,
      pot: this.pot,
      currentBet: this.currentBet,
      ...phaseResult
    };
  }

  /**
   * 移动到下一个玩家
   */
  moveToNextPlayer() {
    // 计算可以行动的玩家数量
    const activePlayers = this.players.filter(p => !p.folded && !p.hasAllIn);
    const maxAttempts = activePlayers.length + 1;  // 稍微多一点，确保能循环一圈

    let attempts = 0;

    console.log(`[Game] moveToNextPlayer - 当前索引: ${this.currentPlayerIndex}, 活跃玩家数: ${activePlayers.length}, 总玩家数: ${this.players.length}`);

    do {
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
      attempts++;

      // 添加边界检查
      if (this.currentPlayerIndex < 0 || this.currentPlayerIndex >= this.players.length) {
        console.error(`[Game] 无效的玩家索引: ${this.currentPlayerIndex}`);
        return true;
      }

      const player = this.players[this.currentPlayerIndex];
      if (!player) {
        console.error(`[Game] 玩家对象不存在，索引: ${this.currentPlayerIndex}`);
        return true;
      }

      console.log(`[Game] 尝试玩家 ${this.currentPlayerIndex}: ${player.name}, folded: ${player.folded}, hasAllIn: ${player.hasAllIn}, canAct: ${player.canAct()}`);

      // 检查是否只剩一名玩家
      const playersNotFolded = this.players.filter(p => !p.folded);
      if (playersNotFolded.length === 1) {
        console.log(`[Game] 只剩一名玩家: ${playersNotFolded[0].name}`);
        return true; // 回合结束
      }

      // 检查是否所有活跃玩家都已行动且下注相等
      if (this.lastAggressorIndex >= 0 &&
          this.currentPlayerIndex === this.lastAggressorIndex &&
          this.areAllActivePlayersMatched()) {
        console.log(`[Game] 回到最后加注者，所有玩家下注匹配`);
        return true; // 阶段结束
      }

      // 找到可以行动的玩家（未弃牌、未全下）
      if (!player.folded && !player.hasAllIn) {
        console.log(`[Game] 找到可以行动的玩家: ${player.name}`);
        return false;
      }

    } while (attempts < maxAttempts);

    console.log(`[Game] 超过最大尝试次数，结束阶段`);
    return true;
  }

  /**
   * 检查所有活跃玩家下注是否匹配
   */
  areAllActivePlayersMatched() {
    // 只检查未弃牌的玩家（包括全下的玩家）
    const activePlayers = this.players.filter(p => !p.folded);
    if (activePlayers.length === 0) return true;

    // 检查所有未弃牌的玩家下注是否相等
    const firstBet = activePlayers[0].currentRoundBet;
    return activePlayers.every(p => p.currentRoundBet === firstBet);
  }

  /**
   * 检查阶段是否结束
   */
  checkPhaseEnd() {
    const playersNotFolded = this.players.filter(p => !p.folded);
    console.log(`[Game] checkPhaseEnd - 未弃牌玩家数: ${playersNotFolded.length}`);

    // 首先检查是否只剩一名玩家（重要：这个检查必须在最前面）
    if (playersNotFolded.length === 1) {
      console.log(`[Game] 只剩一名玩家，回合结束: ${playersNotFolded[0].name}`);
      return {
        phaseEnd: true,
        roundEnd: true,
        winner: playersNotFolded[0],
        pot: this.pot
      };
    }

    // 检查是否所有未弃牌玩家都已行动且下注相等
    // 全下的玩家自动算作已行动
    const playersWhoCanAct = playersNotFolded.filter(p => !p.hasAllIn);
    const allActed = playersWhoCanAct.every(p => p.hasActed) || playersWhoCanAct.length === 0;

    console.log(`[Game] 可行动玩家数: ${playersWhoCanAct.length}, 都已行动: ${allActed}`);
    console.log(`[Game] 下注匹配: ${this.areAllActivePlayersMatched()}`);

    if (!allActed || !this.areAllActivePlayersMatched()) {
      return { phaseEnd: false };
    }

    console.log(`[Game] 所有玩家已行动且下注匹配，进入下一阶段`);
    // 进入下一阶段
    return this.nextPhase();
  }

  /**
   * 进入下一阶段
   */
  nextPhase() {
    console.log(`[Game] 进入下一阶段，当前: ${this.currentPhase}`);

    // 重置玩家本轮下注和行动状态
    for (const player of this.players) {
      player.resetRoundBet();
      player.hasActed = false;
      console.log(`[Game] 重置 ${player.name} 的状态, folded: ${player.folded}, hasAllIn: ${player.hasAllIn}`);
    }

    this.currentBet = 0;

    // 找到庄家之后的第一个未弃牌玩家
    let nextPlayerIndex = (this.dealerPosition + 1) % this.players.length;
    let found = false;
    for (let i = 0; i < this.players.length; i++) {
      const player = this.players[nextPlayerIndex];
      if (!player.folded && !player.hasAllIn) {
        found = true;
        break;
      }
      nextPlayerIndex = (nextPlayerIndex + 1) % this.players.length;
    }

    if (!found) {
      // 如果没有可以行动的玩家（所有人都弃牌或全下），直接进入摊牌
      console.log('[Game] 没有可行动的玩家，进入摊牌');
      return this.showdown();
    }

    this.currentPlayerIndex = nextPlayerIndex;
    this.lastAggressorIndex = this.dealerPosition;

    // 添加边界检查
    if (this.currentPlayerIndex < 0 || this.currentPlayerIndex >= this.players.length) {
      console.error(`[Game] 无效的玩家索引: ${this.currentPlayerIndex}，玩家总数: ${this.players.length}`);
      throw new Error(`无效的玩家索引: ${this.currentPlayerIndex}`);
    }

    console.log(`[Game] 新阶段第一个玩家索引: ${this.currentPlayerIndex} (${this.players[nextPlayerIndex]?.name || '未知'})`);

    switch (this.currentPhase) {
      case 'preflop':
        this.currentPhase = 'flop';
        this.communityCards.push(...this.deck.dealMultiple(3));
        console.log('[Game] 发翻牌（3张）');
        break;
      case 'flop':
        this.currentPhase = 'turn';
        this.communityCards.push(this.deck.deal());
        console.log('[Game] 发转牌（1张）');
        break;
      case 'turn':
        this.currentPhase = 'river';
        this.communityCards.push(this.deck.deal());
        console.log('[Game] 发河牌（1张）');
        break;
      case 'river':
        return this.showdown();
    }

    return {
      phaseEnd: true,
      roundEnd: false,
      phase: this.currentPhase,
      communityCards: this.communityCards.map(c => c.toJSON()),
      currentPlayerIndex: this.currentPlayerIndex
    };
  }

  /**
   * 摊牌
   */
  showdown() {
    this.currentPhase = 'showdown';
    this.isRoundActive = false;

    // 评估所有未弃牌玩家的手牌
    const activePlayers = this.players.filter(p => !p.folded);
    const results = [];

    for (const player of activePlayers) {
      const evaluation = this.evaluator.evaluate(
        player.holeCards,
        this.communityCards
      );
      results.push({
        player,
        evaluation,
        holeCards: player.holeCards.map(c => c.toJSON())
      });
    }

    // 找出赢家
    results.sort((a, b) => this.evaluator.compareHands(b.evaluation, a.evaluation));
    const winners = [results[0]];

    for (let i = 1; i < results.length; i++) {
      if (this.evaluator.compareHands(results[i].evaluation, winners[0].evaluation) === 0) {
        winners.push(results[i]);
      } else {
        break;
      }
    }

    // 分配底池
    const winAmount = Math.floor(this.pot / winners.length);
    for (const winner of winners) {
      winner.player.chips += winAmount;
    }

    return {
      phaseEnd: true,
      roundEnd: true,
      phase: 'showdown',
      results: results.map(r => ({
        playerId: r.player.id,
        playerName: r.player.name,
        handRank: r.evaluation.rank,
        handName: r.evaluation.name,
        holeCards: r.holeCards,
        isWinner: winners.includes(r)
      })),
      winners: winners.map(w => ({
        playerId: w.player.id,
        playerName: w.player.name,
        amount: winAmount
      })),
      pot: this.pot
    };
  }

  /**
   * 获取游戏状态
   */
  getState(hideCards = true) {
    return {
      phase: this.currentPhase,
      pot: this.pot,
      currentBet: this.currentBet,
      communityCards: this.communityCards.map(c => c.toJSON()),
      players: this.players.map(p => p.toJSON(hideCards)),
      currentPlayerIndex: this.currentPlayerIndex,
      dealerPosition: this.dealerPosition,
      isRoundActive: this.isRoundActive,
      lastAction: this.lastAction
    };
  }
}

export default Game;
