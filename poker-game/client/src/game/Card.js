/**
 * 扑克牌类
 */
class Card {
  constructor(suit, rank) {
    this.suit = suit; // 'hearts', 'diamonds', 'clubs', 'spades'
    this.rank = rank; // 2-14 (11=J, 12=Q, 13=K, 14=A)
  }

  // 获取牌面显示名称
  getRankName() {
    const names = {
      11: 'J', 12: 'Q', 13: 'K', 14: 'A'
    };
    return names[this.rank] || this.rank.toString();
  }

  // 获取花色符号
  getSuitSymbol() {
    const symbols = {
      hearts: '♥',
      diamonds: '♦',
      clubs: '♣',
      spades: '♠'
    };
    return symbols[this.suit];
  }

  // 获取花色颜色
  isRed() {
    return this.suit === 'hearts' || this.suit === 'diamonds';
  }

  // 转换为字符串
  toString() {
    return `${this.getRankName()}${this.getSuitSymbol()}`;
  }

  // 转换为JSON
  toJSON() {
    return {
      suit: this.suit,
      rank: this.rank,
      name: this.toString()
    };
  }

  // 从JSON创建Card对象
  static fromJSON(json) {
    return new Card(json.suit, json.rank);
  }
}

module.exports = Card;
