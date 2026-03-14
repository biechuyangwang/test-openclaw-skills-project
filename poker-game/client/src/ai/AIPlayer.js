const Player = require('../game/Player.js');
const HandEvaluator = require('../game/HandEvaluator.js');

/**
 * AI 玩家类
 */
class AIPlayer extends Player {
  constructor(name, chips = 5000, difficulty = 'medium') {
    super(name, chips, true);
    this.difficulty = difficulty;
    this.evaluator = new HandEvaluator();
    this.thinkingTime = 1000 + Math.random() * 2000; // 1-3秒思考时间
  }

  /**
   * AI 决策
   */
  decide(game) {
    const decision = this.makeDecision(game);
    return decision;
  }

  /**
   * 根据难度做出决策
   */
  makeDecision(game) {
    const handStrength = this.evaluateHandStrength(game);
    const callAmount = game.currentBet - this.currentRoundBet;
    const potOdds = callAmount / (game.pot + callAmount);

    switch (this.difficulty) {
      case 'easy':
        return this.easyDecision(handStrength, callAmount, potOdds, game);
      case 'medium':
        return this.mediumDecision(handStrength, callAmount, potOdds, game);
      case 'hard':
        return this.hardDecision(handStrength, callAmount, potOdds, game);
      default:
        return this.mediumDecision(handStrength, callAmount, potOdds, game);
    }
  }

  /**
   * 评估手牌强度 (0-1)
   */
  evaluateHandStrength(game) {
    const evaluation = this.evaluator.evaluate(this.holeCards, game.communityCards);

    // 基础牌型得分
    let score = evaluation.rank / 10;

    // 根据阶段调整
    const phaseAdjustment = {
      'preflop': this.getPreflopStrength(),
      'flop': 0.1,
      'turn': 0.05,
      'river': 0
    };

    score += phaseAdjustment[game.currentPhase] || 0;

    // 考虑位置因素
    const positionBonus = this.getPositionBonus(game);
    score += positionBonus;

    return Math.min(1, Math.max(0, score));
  }

  /**
   * 翻牌前手牌强度
   */
  getPreflopStrength() {
    const [card1, card2] = this.holeCards;
    const rank1 = card1.rank;
    const rank2 = card2.rank;

    // 口袋对子
    if (rank1 === rank2) {
      if (rank1 >= 10) return 0.4; // 高对
      return 0.2; // 低对
    }

    // 同花
    if (card1.suit === card2.suit) {
      return 0.1;
    }

    // 高牌组合
    if (rank1 >= 12 || rank2 >= 12) {
      return 0.15;
    }

    // 连牌
    if (Math.abs(rank1 - rank2) <= 2) {
      return 0.05;
    }

    return 0;
  }

  /**
   * 位置加成
   */
  getPositionBonus(game) {
    const playerIndex = game.players.indexOf(this);
    const dealerPos = game.dealerPosition;

    // 庄家位置优势
    if (playerIndex === dealerPos) return 0.05;

    // 靠近庄家位置
    const distance = (playerIndex - dealerPos + game.players.length) % game.players.length;
    if (distance >= game.players.length - 2) return 0.03;

    return 0;
  }

  /**
   * 简单难度 - 随机决策
   */
  easyDecision(strength, callAmount, potOdds, game) {
    const random = Math.random();

    // 30% 概率随机弃牌
    if (random < 0.3 && callAmount > 0) {
      return { type: 'fold' };
    }

    // 40% 概率随机跟注/过牌
    if (random < 0.7) {
      if (callAmount === 0) {
        return { type: 'check' };
      }
      return { type: 'call' };
    }

    // 30% 概率随机加注
    if (callAmount === 0) {
      return { type: 'raise', amount: game.bigBlind * 2 };
    }

    if (callAmount <= this.chips) {
      return { type: 'call' };
    }

    return { type: 'fold' };
  }

  /**
   * 中等难度 - 根据牌力决策
   */
  mediumDecision(strength, callAmount, potOdds, game) {
    // 强牌 (>0.7)
    if (strength > 0.7) {
      if (callAmount === 0) {
        return { type: 'raise', amount: game.bigBlind * 3 };
      }
      if (Math.random() < 0.7) {
        return { type: 'raise', amount: callAmount * 2 };
      }
      return { type: 'call' };
    }

    // 中等牌 (0.4-0.7)
    if (strength > 0.4) {
      if (callAmount === 0) {
        return Math.random() < 0.5 ? { type: 'check' } : { type: 'raise', amount: game.bigBlind };
      }

      if (potOdds < strength) {
        return { type: 'call' };
      }

      if (Math.random() < 0.3) {
        return { type: 'raise', amount: callAmount * 2 };
      }
      return { type: 'call' };
    }

    // 弱牌 (<0.4)
    if (callAmount === 0) {
      return { type: 'check' };
    }

    if (potOdds < strength * 0.5) {
      return { type: 'call' };
    }

    return { type: 'fold' };
  }

  /**
   * 困难难度 - 考虑多种因素
   */
  hardDecision(strength, callAmount, potOdds, game) {
    // 考虑对手数量
    const activePlayers = game.players.filter(p => !p.folded && p.active).length;

    // 考虑底池大小
    const potSize = game.pot;
    const isBigPot = potSize > game.bigBlind * 10;

    // 超强牌 (>0.85)
    if (strength > 0.85) {
      if (isBigPot && Math.random() < 0.3) {
        // 慢玩
        return callAmount === 0 ? { type: 'check' } : { type: 'call' };
      }
      // 激进加注
      if (callAmount === 0) {
        return { type: 'raise', amount: game.bigBlind * 4 };
      }
      return { type: 'raise', amount: Math.min(callAmount * 3, this.chips) };
    }

    // 强牌 (0.7-0.85)
    if (strength > 0.7) {
      if (activePlayers <= 2) {
        // 单挑时更激进
        if (Math.random() < 0.6) {
          return { type: 'raise', amount: callAmount * 2 + game.bigBlind };
        }
      }
      return { type: 'call' };
    }

    // 中等牌 (0.5-0.7)
    if (strength > 0.5) {
      const impliedOdds = this.getImpliedOdds(game);
      const adjustedStrength = strength + impliedOdds * 0.1;

      if (potOdds < adjustedStrength) {
        if (Math.random() < 0.2 && callAmount === 0) {
          return { type: 'raise', amount: game.bigBlind * 2 };
        }
        return { type: 'call' };
      }

      if (callAmount === 0) {
        return { type: 'check' };
      }

      // 偶尔诈唬
      if (Math.random() < 0.1) {
        return { type: 'raise', amount: callAmount * 2 };
      }

      return { type: 'fold' };
    }

    // 弱牌 (0.3-0.5)
    if (strength > 0.3) {
      if (callAmount === 0) {
        // 偶尔偷鸡
        if (Math.random() < 0.15 && activePlayers <= 2) {
          return { type: 'raise', amount: game.bigBlind * 2 };
        }
        return { type: 'check' };
      }

      if (potOdds < strength * 0.7) {
        return { type: 'call' };
      }

      return { type: 'fold' };
    }

    // 很弱的牌 (<0.3)
    if (callAmount === 0) {
      return { type: 'check' };
    }

    // 偶尔诈唬（翻牌前）
    if (game.currentPhase === 'preflop' && Math.random() < 0.05) {
      return { type: 'raise', amount: game.bigBlind * 3 };
    }

    return { type: 'fold' };
  }

  /**
   * 计算隐含赔率
   */
  getImpliedOdds(game) {
    const activePlayers = game.players.filter(p => !p.folded && p.active).length;
    const avgStack = game.players.reduce((sum, p) => sum + p.chips, 0) / game.players.length;

    // 如果对手筹码多，隐含赔率高
    if (avgStack > game.pot * 3) {
      return 0.3;
    }

    return 0;
  }

  /**
   * 模拟思考时间
   */
  async think() {
    return new Promise(resolve => {
      setTimeout(resolve, this.thinkingTime);
    });
  }
}

module.exports = AIPlayer;
