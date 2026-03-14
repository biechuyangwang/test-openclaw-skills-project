/**
 * 牌型评估器
 * 用于判断德州扑克的手牌类型和大小
 */
class HandEvaluator {
  constructor() {
    // 牌型等级（从高到低）
    this.HAND_RANKS = {
      ROYAL_FLUSH: 10,      // 皇家同花顺
      STRAIGHT_FLUSH: 9,    // 同花顺
      FOUR_OF_A_KIND: 8,    // 四条
      FULL_HOUSE: 7,        // 葫芦
      FLUSH: 6,             // 同花
      STRAIGHT: 5,          // 顺子
      THREE_OF_A_KIND: 4,   // 三条
      TWO_PAIR: 3,          // 两对
      ONE_PAIR: 2,          // 一对
      HIGH_CARD: 1          // 高牌
    };
  }

  /**
   * 评估最佳手牌
   * @param {Array} holeCards - 玩家底牌（2张）
   * @param {Array} communityCards - 公共牌（最多5张）
   * @returns {Object} 评估结果
   */
  evaluate(holeCards, communityCards = []) {
    const allCards = [...holeCards, ...communityCards];

    if (allCards.length < 5) {
      return {
        rank: this.HAND_RANKS.HIGH_CARD,
        name: '高牌',
        value: 0,
        cards: allCards
      };
    }

    // 从所有牌中选出最佳的5张组合
    const combinations = this.getCombinations(allCards, 5);
    let bestHand = null;

    for (const combo of combinations) {
      const result = this.evaluateFiveCards(combo);
      if (!bestHand || this.compareHands(result, bestHand) > 0) {
        bestHand = result;
      }
    }

    return bestHand;
  }

  /**
   * 评估5张牌的牌型
   */
  evaluateFiveCards(cards) {
    const sortedCards = [...cards].sort((a, b) => b.rank - a.rank);
    const ranks = sortedCards.map(c => c.rank);
    const suits = sortedCards.map(c => c.suit);

    const isFlush = suits.every(s => s === suits[0]);
    const isStraight = this.isStraight(ranks);
    const rankCounts = this.getRankCounts(ranks);
    const counts = Object.values(rankCounts).sort((a, b) => b - a);

    // 皇家同花顺
    if (isFlush && isStraight && ranks[0] === 14 && ranks[1] === 13) {
      return {
        rank: this.HAND_RANKS.ROYAL_FLUSH,
        name: '皇家同花顺',
        value: 10,
        cards: sortedCards,
        kickers: ranks
      };
    }

    // 同花顺
    if (isFlush && isStraight) {
      return {
        rank: this.HAND_RANKS.STRAIGHT_FLUSH,
        name: '同花顺',
        value: 9 + this.getStraightHighCard(ranks) / 100,
        cards: sortedCards,
        kickers: ranks
      };
    }

    // 四条
    if (counts[0] === 4) {
      return {
        rank: this.HAND_RANKS.FOUR_OF_A_KIND,
        name: '四条',
        value: 8 + this.getKickerValue(rankCounts, [4]) / 100,
        cards: sortedCards,
        kickers: this.getSortedKickers(rankCounts, [4])
      };
    }

    // 葫芦
    if (counts[0] === 3 && counts[1] === 2) {
      return {
        rank: this.HAND_RANKS.FULL_HOUSE,
        name: '葫芦',
        value: 7 + this.getKickerValue(rankCounts, [3, 2]) / 100,
        cards: sortedCards,
        kickers: this.getSortedKickers(rankCounts, [3, 2])
      };
    }

    // 同花
    if (isFlush) {
      return {
        rank: this.HAND_RANKS.FLUSH,
        name: '同花',
        value: 6 + this.getHighCardValue(ranks) / 100,
        cards: sortedCards,
        kickers: ranks
      };
    }

    // 顺子
    if (isStraight) {
      return {
        rank: this.HAND_RANKS.STRAIGHT,
        name: '顺子',
        value: 5 + this.getStraightHighCard(ranks) / 100,
        cards: sortedCards,
        kickers: ranks
      };
    }

    // 三条
    if (counts[0] === 3) {
      return {
        rank: this.HAND_RANKS.THREE_OF_A_KIND,
        name: '三条',
        value: 4 + this.getKickerValue(rankCounts, [3]) / 100,
        cards: sortedCards,
        kickers: this.getSortedKickers(rankCounts, [3])
      };
    }

    // 两对
    if (counts[0] === 2 && counts[1] === 2) {
      return {
        rank: this.HAND_RANKS.TWO_PAIR,
        name: '两对',
        value: 3 + this.getKickerValue(rankCounts, [2, 2]) / 100,
        cards: sortedCards,
        kickers: this.getSortedKickers(rankCounts, [2, 2])
      };
    }

    // 一对
    if (counts[0] === 2) {
      return {
        rank: this.HAND_RANKS.ONE_PAIR,
        name: '一对',
        value: 2 + this.getKickerValue(rankCounts, [2]) / 100,
        cards: sortedCards,
        kickers: this.getSortedKickers(rankCounts, [2])
      };
    }

    // 高牌
    return {
      rank: this.HAND_RANKS.HIGH_CARD,
      name: '高牌',
      value: 1 + this.getHighCardValue(ranks) / 100,
      cards: sortedCards,
      kickers: ranks
    };
  }

  /**
   * 判断是否是顺子
   */
  isStraight(ranks) {
    const sorted = [...ranks].sort((a, b) => b - a);
    // 普通顺子
    let isStraight = true;
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i] - sorted[i + 1] !== 1) {
        isStraight = false;
        break;
      }
    }
    if (isStraight) return true;

    // A-2-3-4-5（轮子）
    if (sorted[0] === 14 && sorted[1] === 5 && sorted[2] === 4 && sorted[3] === 3 && sorted[4] === 2) {
      return true;
    }

    return false;
  }

  /**
   * 获取顺子最大牌
   */
  getStraightHighCard(ranks) {
    const sorted = [...ranks].sort((a, b) => b - a);
    // A-2-3-4-5 的情况下，5是最大牌
    if (sorted[0] === 14 && sorted[1] === 5 && sorted[2] === 4 && sorted[3] === 3 && sorted[4] === 2) {
      return 5;
    }
    return sorted[0];
  }

  /**
   * 统计每个点数出现的次数
   */
  getRankCounts(ranks) {
    const counts = {};
    for (const rank of ranks) {
      counts[rank] = (counts[rank] || 0) + 1;
    }
    return counts;
  }

  /**
   * 获取高牌值
   */
  getHighCardValue(ranks) {
    let value = 0;
    for (let i = 0; i < ranks.length; i++) {
      value += ranks[i] / Math.pow(15, i);
    }
    return value;
  }

  /**
   * 获取Kicker值（用于比较相同牌型）
   */
  getKickerValue(rankCounts, patterns) {
    let value = 0;
    let index = 0;

    for (const pattern of patterns) {
      for (const [rank, count] of Object.entries(rankCounts)) {
        if (count === pattern) {
          value += parseInt(rank) / Math.pow(15, index);
          index++;
        }
      }
    }

    // 添加单牌
    for (const [rank, count] of Object.entries(rankCounts)) {
      if (count === 1 && !patterns.includes(count)) {
        value += parseInt(rank) / Math.pow(15, index);
        index++;
      }
    }

    return value;
  }

  /**
   * 获取排序后的Kickers
   */
  getSortedKickers(rankCounts, patterns) {
    const kickers = [];
    const used = new Set();

    for (const pattern of patterns) {
      for (const [rank, count] of Object.entries(rankCounts)) {
        if (count === pattern && !used.has(rank)) {
          kickers.push(parseInt(rank));
          used.add(rank);
          break;
        }
      }
    }

    // 添加剩余单牌
    for (const [rank, count] of Object.entries(rankCounts)) {
      if (count === 1 && !used.has(rank)) {
        kickers.push(parseInt(rank));
      }
    }

    return kickers;
  }

  /**
   * 比较两个手牌
   * @returns {number} 1: hand1 > hand2, -1: hand1 < hand2, 0: 平局
   */
  compareHands(hand1, hand2) {
    if (hand1.rank !== hand2.rank) {
      return hand1.rank - hand2.rank;
    }
    if (hand1.value !== hand2.value) {
      return hand1.value > hand2.value ? 1 : -1;
    }
    return 0;
  }

  /**
   * 获取所有组合
   */
  getCombinations(arr, size) {
    if (size > arr.length) return [arr];

    const result = [];

    const combine = (start, chosen) => {
      if (chosen.length === size) {
        result.push([...chosen]);
        return;
      }

      for (let i = start; i < arr.length; i++) {
        chosen.push(arr[i]);
        combine(i + 1, chosen);
        chosen.pop();
      }
    };

    combine(0, []);
    return result;
  }
}

module.exports = HandEvaluator;
