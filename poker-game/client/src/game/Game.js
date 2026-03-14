const Deck = require('./Deck');
const Player = require('./Player');
const HandEvaluator = require('./HandEvaluator');

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
    // 检查是否有足够玩家
    const activePlayers = this.players.filter(p => p.active);
    if (activePlayers.length < 2) {
      throw new Error('需要至少2名玩家才能开始游戏');
    }

    // 重置状态
    this.deck.reset();
    this.deck.shuffle();
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = this.bigBlind;
    this.currentPhase = 'preflop';
    this.isRoundActive = true;

    // 重置玩家状态
    for (const player of this.players) {
      player.resetForNewRound();
    }

    // 移动庄家位置
    this.dealerPosition = (this.dealerPosition + 1) % this.players.length;
    this.smallBlindPosition = (this.dealerPosition + 1) % this.players.length;
    this.bigBlindPosition = (this.dealerPosition + 2) % this.players.length;

    // 收取盲注
    const sbPlayer = this.players[this.smallBlindPosition];
    const bbPlayer = this.players[this.bigBlindPosition];

    if (sbPlayer.active) {
      const sbAmount = sbPlayer.bet(this.smallBlind);
      this.pot += sbAmount;
    }

    if (bbPlayer.active) {
      const bbAmount = bbPlayer.bet(this.bigBlind);
      this.pot += bbAmount;
    }

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

    if (!player.canAct()) {
      throw new Error('玩家无法行动');
    }

    if (this.players[this.currentPlayerIndex].id !== playerId) {
      throw new Error('不是该玩家的回合');
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
        betAmount = player.allIn();
        this.pot += betAmount;
        if (player.currentRoundBet > this.currentBet) {
          this.currentBet = player.currentRoundBet;
          this.lastAggressorIndex = this.players.indexOf(player);
        }
        this.lastAction = { playerId, action: 'all-in', amount: betAmount };
        break;

      default:
        throw new Error('无效的操作');
    }

    // 移动到下一个玩家
    this.moveToNextPlayer();

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
    let attempts = 0;
    const maxAttempts = this.players.length * 2;

    do {
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
      attempts++;

      const player = this.players[this.currentPlayerIndex];

      // 检查是否所有活跃玩家都已行动且下注相等
      if (this.currentPlayerIndex === this.lastAggressorIndex &&
          this.areAllActivePlayersMatched()) {
        return true; // 阶段结束
      }

      // 找到可以行动的玩家
      if (player.canAct() && player.currentRoundBet < this.currentBet) {
        return false;
      } else if (player.canAct() && player.currentRoundBet === this.currentBet) {
        // 可以过牌
        return false;
      }

    } while (attempts < maxAttempts);

    return true;
  }

  /**
   * 检查所有活跃玩家下注是否匹配
   */
  areAllActivePlayersMatched() {
    const activePlayers = this.players.filter(p => p.canAct());
    if (activePlayers.length === 0) return true;

    const firstBet = activePlayers[0].currentRoundBet;
    return activePlayers.every(p => p.currentRoundBet === firstBet);
  }

  /**
   * 检查阶段是否结束
   */
  checkPhaseEnd() {
    if (!this.areAllActivePlayersMatched()) {
      return { phaseEnd: false };
    }

    // 检查是否只剩一名玩家
    const activePlayers = this.players.filter(p => !p.folded);
    if (activePlayers.length === 1) {
      return {
        phaseEnd: true,
        roundEnd: true,
        winner: activePlayers[0],
        pot: this.pot
      };
    }

    // 进入下一阶段
    return this.nextPhase();
  }

  /**
   * 进入下一阶段
   */
  nextPhase() {
    // 重置玩家本轮下注
    for (const player of this.players) {
      player.resetRoundBet();
    }

    this.currentBet = 0;
    this.currentPlayerIndex = (this.dealerPosition + 1) % this.players.length;
    this.lastAggressorIndex = this.dealerPosition;

    switch (this.currentPhase) {
      case 'preflop':
        this.currentPhase = 'flop';
        this.communityCards.push(...this.deck.dealMultiple(3));
        break;
      case 'flop':
        this.currentPhase = 'turn';
        this.communityCards.push(this.deck.deal());
        break;
      case 'turn':
        this.currentPhase = 'river';
        this.communityCards.push(this.deck.deal());
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

module.exports = Game;
