/**
 * 游戏逻辑测试
 * 运行方式: node test/game.test.js
 */

// 测试 Card 类
console.log('=== 测试 Card 类 ===');
const Card = require('../server/src/game/Card');

const card1 = new Card('hearts', 14); // A♥
const card2 = new Card('spades', 2);  // 2♠

console.log('Card 1:', card1.toString()); // A♥
console.log('Card 2:', card2.toString()); // 2♠
console.log('Card 1 is red:', card1.isRed()); // true
console.log('Card 2 is red:', card2.isRed()); // false

// 测试 Deck 类
console.log('\n=== 测试 Deck 类 ===');
const Deck = require('../server/src/game/Deck');

const deck = new Deck();
console.log('初始牌数:', deck.getRemainingCount()); // 52

deck.shuffle();
console.log('洗牌后牌数:', deck.getRemainingCount()); // 52

const dealtCard = deck.deal();
console.log('发出的牌:', dealtCard.toString());
console.log('剩余牌数:', deck.getRemainingCount()); // 51

// 测试 HandEvaluator 类
console.log('\n=== 测试 HandEvaluator 类 ===');
const HandEvaluator = require('../server/src/game/HandEvaluator');

const evaluator = new HandEvaluator();

// 皇家同花顺
const royalFlush = [
  new Card('hearts', 14),
  new Card('hearts', 13),
  new Card('hearts', 12),
  new Card('hearts', 11),
  new Card('hearts', 10)
];
const result1 = evaluator.evaluateFiveCards(royalFlush);
console.log('皇家同花顺:', result1.name, '等级:', result1.rank); // 皇家同花顺 10

// 一对
const pair = [
  new Card('hearts', 14),
  new Card('spades', 14),
  new Card('hearts', 10),
  new Card('diamonds', 7),
  new Card('clubs', 3)
];
const result2 = evaluator.evaluateFiveCards(pair);
console.log('一对:', result2.name, '等级:', result2.rank); // 一对 2

// 测试 Player 类
console.log('\n=== 测试 Player 类 ===');
const Player = require('../server/src/game/Player');

const player = new Player('player1', 'Alice', 5000, false);
console.log('玩家:', player.name, '筹码:', player.chips);

player.bet(100);
console.log('下注100后筹码:', player.chips); // 4900
console.log('本轮下注:', player.currentRoundBet); // 100

player.resetForNewRound();
console.log('重置后本轮下注:', player.currentRoundBet); // 0

// 测试 Game 类
console.log('\n=== 测试 Game 类 ===');
const Game = require('../server/src/game/Game');

const game = new Game({ smallBlind: 10, bigBlind: 20 });

// 添加玩家
game.addPlayer(new Player('p1', 'Alice', 5000, false));
game.addPlayer(new Player('p2', 'Bob', 5000, false));
game.addPlayer(new Player('p3', 'Charlie', 5000, true));

console.log('玩家数量:', game.getActivePlayerCount()); // 3

// 开始新回合
try {
  const roundResult = game.startNewRound();
  console.log('游戏开始!');
  console.log('底池:', roundResult.pot);
  console.log('庄家位置:', roundResult.dealerPosition);
  console.log('小盲位置:', roundResult.smallBlindPosition);
  console.log('大盲位置:', roundResult.bigBlindPosition);
  console.log('公共牌:', roundResult.communityCards);
  console.log('当前行动玩家索引:', game.currentPlayerIndex);

  // 玩家操作（按照正确的顺序）
  const currentPlayerId = game.players[game.currentPlayerIndex].id;
  const actionResult = game.playerAction(currentPlayerId, 'call');
  console.log('玩家跟注:', actionResult.action);

  console.log('\n✅ 所有测试通过！');
} catch (error) {
  console.error('❌ 测试失败:', error.message);
}
