import type {
  AnalyticsPatterns,
  AnalyticsResult,
  DailyPnl,
  DurationPoint,
  EquityPoint,
  HourlyPnl,
  LargeLoss,
  Trade,
  TradePoint
} from "@/types/trade";
import { hourLabel, round } from "@/lib/utils";

export function calculateAnalytics(trades: Trade[]): AnalyticsResult {
  const sortedTrades = [...trades].sort((a, b) => a.entryTimestamp - b.entryTimestamp);
  const daily = aggregateByDay(sortedTrades);
  const hourly = aggregateByHour(sortedTrades);
  const equityCurve = buildEquityCurve(sortedTrades);
  const tradeSeries = buildTradeSeries(sortedTrades);
  const winners = sortedTrades.filter((trade) => trade.netPnl > 0);
  const losers = sortedTrades.filter((trade) => trade.netPnl < 0);
  const scratched = sortedTrades.filter((trade) => trade.netPnl === 0);
  const totalNetPnl = sum(sortedTrades, "netPnl");
  const totalTradePnl = sum(sortedTrades, "tradePnl");
  const totalCommissionFees = sum(sortedTrades, "commissionFees");
  const grossProfit = winners.reduce((total, trade) => total + trade.netPnl, 0);
  const grossLoss = Math.abs(losers.reduce((total, trade) => total + trade.netPnl, 0));
  const bestDay = daily.length ? [...daily].sort((a, b) => b.netPnl - a.netPnl)[0] : null;
  const worstDay = daily.length ? [...daily].sort((a, b) => a.netPnl - b.netPnl)[0] : null;
  const bestTrade = sortedTrades.length
    ? Math.max(...sortedTrades.map((trade) => trade.netPnl))
    : 0;
  const worstTrade = sortedTrades.length
    ? Math.min(...sortedTrades.map((trade) => trade.netPnl))
    : 0;
  const maxDrawdown = calculateMaxDrawdown(sortedTrades);
  const patterns = detectPatterns(sortedTrades, daily, hourly, winners, losers);
  const firstDate = sortedTrades[0]?.tradeDate ?? null;
  const lastDate = sortedTrades[sortedTrades.length - 1]?.tradeDate ?? null;

  return {
    trades: sortedTrades,
    stats: {
      totalNetPnl: round(totalNetPnl),
      totalTradePnl: round(totalTradePnl),
      totalCommissionFees: round(totalCommissionFees),
      totalTrades: sortedTrades.length,
      winningTrades: winners.length,
      losingTrades: losers.length,
      scratchedTrades: scratched.length,
      winRate: ratio(winners.length, sortedTrades.length) * 100,
      averageWin: round(mean(winners.map((trade) => trade.netPnl))),
      averageLoss: round(mean(losers.map((trade) => trade.netPnl))),
      bestTrade: round(bestTrade),
      worstTrade: round(worstTrade),
      averagePnlPerTrade: round(mean(sortedTrades.map((trade) => trade.netPnl))),
      bestDay,
      worstDay,
      profitFactor: grossLoss > 0 ? round(grossProfit / grossLoss, 2) : null,
      maxDrawdown: round(maxDrawdown),
      commissionPerTrade: round(ratio(totalCommissionFees, sortedTrades.length)),
      commissionToGrossProfitRate: grossProfit > 0 ? round((totalCommissionFees / grossProfit) * 100) : null,
      firstDate,
      lastDate,
      tradingDays: daily.length
    },
    daily,
    hourly,
    equityCurve,
    tradeSeries,
    distribution: [
      { name: "Gagnants", value: winners.length },
      { name: "Perdants", value: losers.length },
      { name: "Flat", value: scratched.length }
    ],
    durationScatter: buildDurationScatter(sortedTrades),
    patterns
  };
}

function aggregateByDay(trades: Trade[]): DailyPnl[] {
  const map = new Map<string, DailyPnl>();

  trades.forEach((trade) => {
    const item =
      map.get(trade.tradeDate) ??
      ({
        date: trade.tradeDate,
        netPnl: 0,
        tradePnl: 0,
        commissionFees: 0,
        tradeCount: 0,
        winners: 0,
        losers: 0
      } satisfies DailyPnl);

    item.netPnl += trade.netPnl;
    item.tradePnl += trade.tradePnl;
    item.commissionFees += trade.commissionFees;
    item.tradeCount += 1;
    item.winners += trade.netPnl > 0 ? 1 : 0;
    item.losers += trade.netPnl < 0 ? 1 : 0;
    map.set(trade.tradeDate, item);
  });

  return Array.from(map.values())
    .map((item) => ({
      ...item,
      netPnl: round(item.netPnl),
      tradePnl: round(item.tradePnl),
      commissionFees: round(item.commissionFees)
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function aggregateByHour(trades: Trade[]): HourlyPnl[] {
  const map = new Map<number, HourlyPnl>();

  trades.forEach((trade) => {
    const item =
      map.get(trade.entryHour) ??
      ({
        hour: trade.entryHour,
        label: hourLabel(trade.entryHour),
        netPnl: 0,
        tradePnl: 0,
        commissionFees: 0,
        tradeCount: 0,
        winners: 0,
        losers: 0,
        winRate: 0
      } satisfies HourlyPnl);

    item.netPnl += trade.netPnl;
    item.tradePnl += trade.tradePnl;
    item.commissionFees += trade.commissionFees;
    item.tradeCount += 1;
    item.winners += trade.netPnl > 0 ? 1 : 0;
    item.losers += trade.netPnl < 0 ? 1 : 0;
    item.winRate = ratio(item.winners, item.tradeCount) * 100;
    map.set(trade.entryHour, item);
  });

  return Array.from(map.values())
    .map((item) => ({
      ...item,
      netPnl: round(item.netPnl),
      tradePnl: round(item.tradePnl),
      commissionFees: round(item.commissionFees),
      winRate: round(item.winRate, 1)
    }))
    .sort((a, b) => a.hour - b.hour);
}

function buildEquityCurve(trades: Trade[]): EquityPoint[] {
  let equity = 0;

  return trades.map((trade, index) => {
    equity += trade.netPnl;

    return {
      index: index + 1,
      label: `#${index + 1}`,
      date: trade.tradeDate,
      netPnl: round(trade.netPnl),
      equity: round(equity)
    };
  });
}

function buildTradeSeries(trades: Trade[]): TradePoint[] {
  return trades.map((trade, index) => ({
    index: index + 1,
    label: `#${index + 1}`,
    date: trade.tradeDate,
    hour: hourLabel(trade.entryHour),
    netPnl: round(trade.netPnl),
    tradePnl: round(trade.tradePnl),
    commissionFees: round(trade.commissionFees)
  }));
}

function buildDurationScatter(trades: Trade[]): DurationPoint[] {
  return trades.map((trade, index) => ({
    index: index + 1,
    durationMinutes: round(trade.lifeSpanSeconds / 60, 2),
    netPnl: round(trade.netPnl),
    date: trade.tradeDate,
    hour: hourLabel(trade.entryHour)
  }));
}

function detectPatterns(
  trades: Trade[],
  daily: DailyPnl[],
  hourly: HourlyPnl[],
  winners: Trade[],
  losers: Trade[]
): AnalyticsPatterns {
  const bestHours = [...hourly].sort((a, b) => b.netPnl - a.netPnl).slice(0, 3);
  const worstHours = [...hourly].sort((a, b) => a.netPnl - b.netPnl).slice(0, 3);
  const averageWinningDurationSeconds = round(mean(winners.map((trade) => trade.lifeSpanSeconds)));
  const averageLosingDurationSeconds = round(mean(losers.map((trade) => trade.lifeSpanSeconds)));
  const tradesPerDay = daily.map((day) => ({ date: day.date, trades: day.tradeCount }));
  const dayCounts = daily.map((day) => day.tradeCount);
  const overtradingThreshold = Math.max(15, Math.ceil(mean(dayCounts) + standardDeviation(dayCounts)));
  const overtradingDays = daily.filter((day) => day.tradeCount >= overtradingThreshold);
  const isolatedLargeLosses = findLargeLosses(losers);
  const detected = buildDetectedSentences({
    trades,
    bestHours,
    worstHours,
    averageWinningDurationSeconds,
    averageLosingDurationSeconds,
    overtradingDays,
    isolatedLargeLosses
  });

  return {
    bestHours,
    worstHours,
    averageWinningDurationSeconds,
    averageLosingDurationSeconds,
    tradesPerDay,
    overtradingDays,
    isolatedLargeLosses,
    detected
  };
}

function findLargeLosses(losers: Trade[]): LargeLoss[] {
  if (losers.length === 0) {
    return [];
  }

  const losses = losers.map((trade) => trade.netPnl);
  const threshold = mean(losses) - standardDeviation(losses);

  return losers
    .filter((trade) => trade.netPnl <= threshold)
    .sort((a, b) => a.netPnl - b.netPnl)
    .slice(0, 5)
    .map((trade) => ({
      date: trade.tradeDate,
      hour: hourLabel(trade.entryHour),
      netPnl: round(trade.netPnl),
      tradePnl: round(trade.tradePnl),
      commissionFees: round(trade.commissionFees),
      durationSeconds: round(trade.lifeSpanSeconds)
    }));
}

function buildDetectedSentences({
  trades,
  bestHours,
  worstHours,
  averageWinningDurationSeconds,
  averageLosingDurationSeconds,
  overtradingDays,
  isolatedLargeLosses
}: {
  trades: Trade[];
  bestHours: HourlyPnl[];
  worstHours: HourlyPnl[];
  averageWinningDurationSeconds: number;
  averageLosingDurationSeconds: number;
  overtradingDays: DailyPnl[];
  isolatedLargeLosses: LargeLoss[];
}) {
  const messages: string[] = [];
  const totalFees = sum(trades, "commissionFees");
  const grossProfit = trades
    .filter((trade) => trade.netPnl > 0)
    .reduce((total, trade) => total + trade.netPnl, 0);

  if (bestHours[0]) {
    messages.push(`Meilleure plage horaire: ${bestHours[0].label} avec ${round(bestHours[0].netPnl)} $ net.`);
  }

  if (worstHours[0]) {
    messages.push(`Plage horaire la plus defavorable: ${worstHours[0].label} avec ${round(worstHours[0].netPnl)} $ net.`);
  }

  if (averageLosingDurationSeconds > averageWinningDurationSeconds * 1.25) {
    messages.push("Les trades perdants durent nettement plus longtemps que les gagnants.");
  } else if (averageWinningDurationSeconds > averageLosingDurationSeconds * 1.25) {
    messages.push("Les trades gagnants durent nettement plus longtemps que les perdants.");
  }

  if (grossProfit > 0 && totalFees / grossProfit > 0.25) {
    messages.push("Les commissions absorbent plus de 25 % du profit brut des trades gagnants.");
  }

  if (overtradingDays.length > 0) {
    messages.push(`${overtradingDays.length} jour(s) depassent le seuil simple de surtrading.`);
  }

  if (isolatedLargeLosses.length > 0) {
    messages.push(`${isolatedLargeLosses.length} grosse(s) perte(s) isolee(s) detectee(s).`);
  }

  return messages;
}

function calculateMaxDrawdown(trades: Trade[]) {
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;

  trades.forEach((trade) => {
    equity += trade.netPnl;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
  });

  return maxDrawdown;
}

function sum<T extends Record<K, number>, K extends keyof T>(items: T[], key: K) {
  return items.reduce((total, item) => total + item[key], 0);
}

function mean(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function standardDeviation(values: number[]) {
  if (values.length <= 1) {
    return 0;
  }

  const average = mean(values);
  const variance = mean(values.map((value) => (value - average) ** 2));
  return Math.sqrt(variance);
}

function ratio(value: number, total: number) {
  if (total === 0) {
    return 0;
  }

  return value / total;
}
