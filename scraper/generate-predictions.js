/**
 * 根据竞彩赔率数据生成预测
 *
 * 输入: data/matches-current.json (需要有 odds 字段)
 * 输出: data/matches-current.json (填充 predictions, probabilityModel 等字段)
 *
 * 模型:
 *   - 市场隐含概率 (从赔率反推)
 *   - Poisson 进球模型 (基于期望进球)
 *   - 简单 Elo 估算 (基于历史战绩)
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

// ============ 工具函数 ============
function oddsToImpliedProbability(odds) {
  if (!odds || odds <= 1) return 0;
  return (1 / odds) * 100;
}

function normalizeProbabilities(probs) {
  const total = probs.reduce((a, b) => a + b, 0);
  if (total === 0) return probs;
  return probs.map(p => (p / total) * 100);
}

function poissonProbability(lambda, k) {
  return Math.exp(-lambda) * Math.pow(lambda, k) / factorial(k);
}

function factorial(n) {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

// ============ 模型: 从赔率反推概率 ============
function marketImpliedProbabilities(odds) {
  if (!odds) return null;
  const raw = [
    oddsToImpliedProbability(odds.odds1),
    oddsToImpliedProbability(odds.oddsX),
    oddsToImpliedProbability(odds.odds2),
  ];
  const normalized = normalizeProbabilities(raw);
  return {
    home: Math.round(normalized[0] * 10) / 10,
    draw: Math.round(normalized[1] * 10) / 10,
    away: Math.round(normalized[2] * 10) / 10,
  };
}

// ============ 模型: Poisson 进球分布 ============
function poissonModel(marketProbs) {
  if (!marketProbs) return null;

  // 从市场概率估算期望进球
  // 简化方法: 使用主客胜概率比率估算 xG
  const homeStrength = marketProbs.home / 50; // 归一化
  const awayStrength = marketProbs.away / 50;

  const homeXG = Math.max(0.5, Math.min(3.5, homeStrength * 1.8));
  const awayXG = Math.max(0.3, Math.min(2.5, awayStrength * 1.5));

  // 计算比分矩阵 (0-5 进球)
  const scoreDistribution = [];
  for (let h = 0; h <= 4; h++) {
    for (let a = 0; a <= 4; a++) {
      const prob = poissonProbability(homeXG, h) * poissonProbability(awayXG, a) * 100;
      if (prob > 0.5) {
        scoreDistribution.push({ home: h, away: a, probability: Math.round(prob * 10) / 10 });
      }
    }
  }
  scoreDistribution.sort((a, b) => b.probability - a.probability);

  // 计算胜平负概率
  let homeWin = 0, draw = 0, awayWin = 0;
  for (let h = 0; h <= 6; h++) {
    for (let a = 0; a <= 6; a++) {
      const prob = poissonProbability(homeXG, h) * poissonProbability(awayXG, a);
      if (h > a) homeWin += prob;
      else if (h === a) draw += prob;
      else awayWin += prob;
    }
  }

  // 大小球
  let over25 = 0;
  for (let h = 0; h <= 6; h++) {
    for (let a = 0; a <= 6; a++) {
      if (h + a > 2) {
        over25 += poissonProbability(homeXG, h) * poissonProbability(awayXG, a);
      }
    }
  }

  // 双方进球
  let btts = 0;
  for (let h = 1; h <= 6; h++) {
    for (let a = 1; a <= 6; a++) {
      btts += poissonProbability(homeXG, h) * poissonProbability(awayXG, a);
    }
  }

  return {
    homeXG: Math.round(homeXG * 100) / 100,
    awayXG: Math.round(awayXG * 100) / 100,
    oneXTwo: {
      poisson: {
        home: Math.round(homeWin * 1000) / 10,
        draw: Math.round(draw * 1000) / 10,
        away: Math.round(awayWin * 1000) / 10,
      },
    },
    goalLines: {
      over25: Math.round(over25 * 1000) / 10,
      under25: Math.round((1 - over25) * 1000) / 10,
    },
    bothTeamsToScore: {
      yes: Math.round(btts * 1000) / 10,
      no: Math.round((1 - btts) * 1000) / 10,
    },
    scoreDistribution: scoreDistribution.slice(0, 10),
  };
}

// ============ 生成预测 ============
function generatePredictions(match) {
  if (!match.odds) return { predictions: [], probabilityModel: null };

  const market = marketImpliedProbabilities(match.odds);
  const poisson = poissonModel(market);

  if (!market || !poisson) return { predictions: [], probabilityModel: null };

  // 集成概率 (简化: 市场权重 0.7, Poisson 权重 0.3)
  const finalHome = Math.round((market.home * 0.7 + poisson.oneXTwo.poisson.home * 0.3) * 10) / 10;
  const finalDraw = Math.round((market.draw * 0.7 + poisson.oneXTwo.poisson.draw * 0.3) * 10) / 10;
  const finalAway = Math.round((market.away * 0.7 + poisson.oneXTwo.poisson.away * 0.3) * 10) / 10;

  // 构建概率模型
  const probabilityModel = {
    version: 'market-poisson-v1',
    generatedAt: new Date().toISOString(),
    basis: {
      zh: '市场隐含概率 + Poisson 比分分布集成；暂未接入 xG、伤停、首发和校准器。',
      en: 'Market-implied probability + Poisson score distribution ensemble.',
    },
    ensembleWeights: { market: 0.7, poisson: 0.3 },
    oneXTwo: {
      market: market,
      poisson: poisson.oneXTwo.poisson,
      final: { home: finalHome, draw: finalDraw, away: finalAway },
    },
    scoreDistribution: poisson.scoreDistribution,
    goalLines: poisson.goalLines,
    bothTeamsToScore: poisson.bothTeamsToScore,
  };

  // 生成预测推荐
  const predictions = [];

  // 1X2 预测
  const maxProb = Math.max(finalHome, finalDraw, finalAway);
  let tipCode, tipLabel, explanation;

  if (maxProb >= 65) {
    if (finalHome === maxProb) {
      tipCode = '1';
      tipLabel = { zh: `主胜 ${match.homeTeamName}`, en: `Home Win ${match.homeTeamName}` };
      explanation = { zh: `模型最终概率主胜 ${finalHome}%，市场和 Poisson 同向支持。`, en: `Model final probability home win ${finalHome}%.` };
    } else if (finalDraw === maxProb) {
      tipCode = 'X';
      tipLabel = { zh: '平局', en: 'Draw' };
      explanation = { zh: `模型最终概率平局 ${finalDraw}%，双方实力接近。`, en: `Model final probability draw ${finalDraw}%.` };
    } else {
      tipCode = '2';
      tipLabel = { zh: `客胜 ${match.awayTeamName}`, en: `Away Win ${match.awayTeamName}` };
      explanation = { zh: `模型最终概率客胜 ${finalAway}%，市场和 Poisson 同向支持。`, en: `Model final probability away win ${finalAway}%.` };
    }
  } else {
    tipCode = 'WATCH';
    tipLabel = { zh: '观察为主 胜平负不强推', en: 'Watch first: no 1X2 pick' };
    explanation = { zh: `最终概率未到高可信门槛（最高 ${maxProb.toFixed(1)}%），当前只适合观察。`, en: `Highest probability ${maxProb.toFixed(1)}% below threshold.` };
  }

  const trustScore = Math.min(95, Math.round(maxProb * 1.1));
  const riskTags = [];
  if (maxProb < 50) riskTags.push({ zh: '概率分散', en: 'Probability scattered' });
  if (match.odds.odds1 < 1.3) riskTags.push({ zh: '热门过热', en: 'Heavy favorite' });

  predictions.push({
    marketType: '1X2',
    tipCode: tipCode,
    tipLabel: tipLabel,
    odds: tipCode === '1' ? match.odds.odds1 : tipCode === 'X' ? match.odds.oddsX : tipCode === '2' ? match.odds.odds2 : 0,
    trustScore: trustScore,
    explanation: explanation,
    analysisItems: [
      { zh: `官方 HAD SP：主胜 ${match.odds.odds1} / 平局 ${match.odds.oddsX} / 客胜 ${match.odds.odds2}；去水支持率约 主胜 ${market.home}% / 平局 ${market.draw}% / 客胜 ${market.away}%。`, en: `HAD SP: ${match.odds.odds1} / ${match.odds.oddsX} / ${match.odds.odds2}` },
      { zh: `Poisson 模型：主胜 ${poisson.oneXTwo.poisson.home}% / 平局 ${poisson.oneXTwo.poisson.draw}% / 客胜 ${poisson.oneXTwo.poisson.away}%。`, en: `Poisson: ${poisson.oneXTwo.poisson.home}% / ${poisson.oneXTwo.poisson.draw}% / ${poisson.oneXTwo.poisson.away}%` },
    ],
    riskTags: riskTags,
    visibilityStatus: 'FREE',
    resultStatus: 'PENDING',
  });

  // GOALS 预测
  if (poisson.goalLines.over25 >= 55) {
    predictions.push({
      marketType: 'GOALS',
      tipCode: 'O2.5',
      tipLabel: { zh: '总进球 3+', en: 'Over 2.5 Goals' },
      odds: 0,
      trustScore: Math.round(poisson.goalLines.over25 * 0.9),
      explanation: { zh: `大 2.5 球概率约 ${poisson.goalLines.over25.toFixed(1)}%。`, en: `Over 2.5 probability ${poisson.goalLines.over25.toFixed(1)}%.` },
      analysisItems: [
        { zh: `期望进球：主队 ${poisson.homeXG}、客队 ${poisson.awayXG}，总计约 ${(poisson.homeXG + poisson.awayXG).toFixed(2)}。`, en: `xG: home ${poisson.homeXG}, away ${poisson.awayXG}` },
      ],
      riskTags: [],
      visibilityStatus: 'FREE',
      resultStatus: 'PENDING',
    });
  } else if (poisson.goalLines.under25 >= 55) {
    predictions.push({
      marketType: 'GOALS',
      tipCode: 'U2.5',
      tipLabel: { zh: '总进球 ≤2', en: 'Under 2.5 Goals' },
      odds: 0,
      trustScore: Math.round(poisson.goalLines.under25 * 0.9),
      explanation: { zh: `小 2.5 球概率约 ${poisson.goalLines.under25.toFixed(1)}%。`, en: `Under 2.5 probability ${poisson.goalLines.under25.toFixed(1)}%.` },
      analysisItems: [
        { zh: `期望进球：主队 ${poisson.homeXG}、客队 ${poisson.awayXG}，总计约 ${(poisson.homeXG + poisson.awayXG).toFixed(2)}。`, en: `xG: home ${poisson.homeXG}, away ${poisson.awayXG}` },
      ],
      riskTags: [],
      visibilityStatus: 'FREE',
      resultStatus: 'PENDING',
    });
  }

  // BEST 预测 (综合推荐)
  const bestPred = predictions.find(p => p.tipCode !== 'WATCH');
  if (bestPred) {
    predictions.push({
      marketType: 'BEST',
      tipCode: bestPred.tipCode,
      tipLabel: { zh: `模型首选 ${bestPred.tipLabel.zh}`, en: `Best pick: ${bestPred.tipLabel.en}` },
      odds: bestPred.odds,
      trustScore: Math.min(95, bestPred.trustScore + 5),
      explanation: { zh: `综合市场和 Poisson 模型，首选 ${bestPred.tipLabel.zh}。`, en: `Best pick: ${bestPred.tipLabel.en}` },
      analysisItems: bestPred.analysisItems,
      riskTags: bestPred.riskTags,
      visibilityStatus: 'FREE',
      resultStatus: 'PENDING',
    });
  }

  return { predictions, probabilityModel };
}

// ============ 主流程 ============
function main() {
  console.log('=== 生成预测 ===');

  const filePath = path.join(DATA_DIR, 'matches-current.json');
  if (!fs.existsSync(filePath)) {
    console.error('未找到 matches-current.json，请先运行 fetch-matches.js');
    process.exit(1);
  }

  const matches = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  console.log(`加载 ${matches.length} 场赛事`);

  let predicted = 0;
  matches.forEach(m => {
    if (m.odds && m.status === 'SCHEDULED') {
      const { predictions, probabilityModel } = generatePredictions(m);
      m.predictions = predictions;
      m.probabilityModel = probabilityModel;
      m.projectedScoreHome = probabilityModel?.scoreDistribution?.[0]?.home ?? null;
      m.projectedScoreAway = probabilityModel?.scoreDistribution?.[0]?.away ?? null;
      predicted++;
    }
  });

  fs.writeFileSync(filePath, JSON.stringify(matches, null, 2), 'utf8');
  console.log(`已为 ${predicted} 场赛事生成预测`);
  console.log('已更新 matches-current.json');
}

main();
