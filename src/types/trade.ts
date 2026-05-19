export type TradeSide = "B" | "S";

export interface Trade {
  id: string;
  tradeDateRaw: string;
  tradeDate: string;
  entryOrderNumber: string;
  entrySide: TradeSide;
  entryTime: string;
  entryTimestamp: number;
  entryHour: number;
  entryPrice: number;
  exitOrderNumber: string;
  exitSide: TradeSide;
  exitTime: string;
  exitTimestamp: number;
  exitPrice: number;
  lifeSpanSeconds: number;
  fillSize: number;
  tradePnl: number;
  commissionFees: number;
  netPnl: number;
  ticksMade: number | null;
}

export interface CsvSummaryRow {
  label: string;
  values: Record<string, string>;
}

export interface CsvParseResult {
  trades: Trade[];
  summaryRows: CsvSummaryRow[];
  warnings: string[];
}

export interface GlobalStats {
  totalNetPnl: number;
  totalTradePnl: number;
  totalCommissionFees: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  scratchedTrades: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  bestTrade: number;
  worstTrade: number;
  averagePnlPerTrade: number;
  bestDay: DailyPnl | null;
  worstDay: DailyPnl | null;
  profitFactor: number | null;
  maxDrawdown: number;
  commissionPerTrade: number;
  commissionToGrossProfitRate: number | null;
  firstDate: string | null;
  lastDate: string | null;
  tradingDays: number;
}

export interface DailyPnl {
  date: string;
  netPnl: number;
  tradePnl: number;
  commissionFees: number;
  tradeCount: number;
  winners: number;
  losers: number;
}

export interface HourlyPnl {
  hour: number;
  label: string;
  netPnl: number;
  tradePnl: number;
  commissionFees: number;
  tradeCount: number;
  winners: number;
  losers: number;
  winRate: number;
}

export interface EquityPoint {
  index: number;
  label: string;
  date: string;
  netPnl: number;
  equity: number;
}

export interface TradePoint {
  index: number;
  label: string;
  date: string;
  hour: string;
  netPnl: number;
  tradePnl: number;
  commissionFees: number;
}

export interface DistributionPoint {
  name: string;
  value: number;
}

export interface DurationPoint {
  index: number;
  durationMinutes: number;
  netPnl: number;
  date: string;
  hour: string;
}

export interface LargeLoss {
  date: string;
  hour: string;
  netPnl: number;
  tradePnl: number;
  commissionFees: number;
  durationSeconds: number;
}

export interface AnalyticsPatterns {
  bestHours: HourlyPnl[];
  worstHours: HourlyPnl[];
  averageWinningDurationSeconds: number;
  averageLosingDurationSeconds: number;
  tradesPerDay: Array<{ date: string; trades: number }>;
  overtradingDays: DailyPnl[];
  isolatedLargeLosses: LargeLoss[];
  detected: string[];
}

export interface AnalyticsResult {
  trades: Trade[];
  stats: GlobalStats;
  daily: DailyPnl[];
  hourly: HourlyPnl[];
  equityCurve: EquityPoint[];
  tradeSeries: TradePoint[];
  distribution: DistributionPoint[];
  durationScatter: DurationPoint[];
  patterns: AnalyticsPatterns;
}
