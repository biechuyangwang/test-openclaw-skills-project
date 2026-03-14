const Card = require('./Card');

/**
 * 牌堆类
 */
class Deck {
  constructor() {
    this.cards = [];
    this.reset();
  }

  // 重置牌堆（创建一副新牌）
  reset() {
    this.cards = [];
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];

    for (const suit of suits) {
      for (let rank = 2; rank <= 14; rank++) {
        this.cards.push(new Card(suit, rank));
      }
    }
  }

  // 洗牌（Fisher-Yates 算法）
  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  // 发一张牌
  deal() {
    return this.cards.pop();
  }

  // 发多张牌
  dealMultiple(count) {
    const cards = [];
    for (let i = 0; i < count; i++) {
      if (this.cards.length > 0) {
        cards.push(this.deal());
      }
    }
    return cards;
  }

  // 获取剩余牌数
  getRemainingCount() {
    return this.cards.length;
  }

  // 转换为JSON
  toJSON() {
    return {
      cards: this.cards.map(card => card.toJSON()),
      remaining: this.cards.length
    };
  }
}

module.exports = Deck;
