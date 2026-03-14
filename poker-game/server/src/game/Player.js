/**
 * 玩家类
 */
class Player {
  constructor(id, name, chips = 5000, isAI = false) {
    this.id = id;
    this.name = name;
    this.chips = chips;
    this.initialChips = chips;
    this.isAI = isAI;
    this.holeCards = [];
    this.totalBet = 0; // 总下注额
    this.currentRoundBet = 0; // 本轮下注额
    this.folded = false;
    this.allIn = false;
    this.active = true; // 是否在游戏中
    this.avatar = isAI ? '/assets/ai-avatar.png' : '/assets/default-avatar.png';
  }

  // 下注
  bet(amount) {
    if (amount > this.chips) {
      amount = this.chips; // 全下
    }

    this.chips -= amount;
    this.currentRoundBet += amount;

    if (this.chips === 0) {
      this.allIn = true;
    }

    return amount;
  }

  // 跟注
  call(amount) {
    return this.bet(Math.min(amount, this.chips));
  }

  // 加注
  raise(amount) {
    return this.bet(amount);
  }

  // 弃牌
  fold() {
    this.folded = true;
    this.active = false;
  }

  // 过牌
  check() {
    // 不做任何操作
  }

  // 全下
  allIn() {
    const amount = this.chips;
    this.bet(amount);
    return amount;
  }

  // 重置玩家状态（新一轮）
  resetForNewRound() {
    this.holeCards = [];
    this.totalBet = 0;
    this.currentRoundBet = 0;
    this.folded = false;
    this.allIn = false;
    this.active = this.chips > 0;
  }

  // 重置本轮下注（新阶段）
  resetRoundBet() {
    this.currentRoundBet = 0;
  }

  // 设置底牌
  setHoleCards(cards) {
    this.holeCards = cards;
  }

  // 获取状态
  getStatus() {
    if (this.folded) return 'folded';
    if (this.allIn) return 'all-in';
    if (!this.active) return 'inactive';
    return 'active';
  }

  // 是否可以行动
  canAct() {
    return this.active && !this.folded && !this.allIn;
  }

  // 转换为JSON
  toJSON(hideCards = false) {
    return {
      id: this.id,
      name: this.name,
      chips: this.chips,
      bet: this.currentRoundBet,
      holeCards: hideCards ? [] : this.holeCards.map(c => c.toJSON()),
      folded: this.folded,
      allIn: this.allIn,
      active: this.active,
      status: this.getStatus(),
      isAI: this.isAI,
      avatar: this.avatar
    };
  }
}

module.exports = Player;
