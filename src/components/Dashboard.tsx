import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CalendarDays,
  CircleCheck,
  CircleX,
  Gauge,
  Hash,
  LineChart,
  Percent,
  Receipt,
  ShieldAlert,
  Sigma,
  Target,
  Timer,
  TrendingDown,
  TrendingUp
} from "lucide-react";
import type { CsvSummaryRow, Trade } from "@/types/trade";
import { calculateAnalytics } from "@/lib/analytics";
import { formatCurrency, formatDuration, formatNumber, formatPercent, hourLabel } from "@/lib/utils";
import { Charts } from "@/components/Charts";
import { OllamaReport } from "@/components/OllamaReport";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DashboardProps {
  trades: Trade[];
  summaryRows: CsvSummaryRow[];
  sourceName: string;
}

export function Dashboard({ trades, summaryRows, sourceName }: DashboardProps) {
  const allDates = useMemo(
    () => Array.from(new Set(trades.map((trade) => trade.tradeDate))).sort(),
    [trades]
  );
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [hourFrom, setHourFrom] = useState(0);
  const [hourTo, setHourTo] = useState(23);

  useEffect(() => {
    setDateFrom(allDates[0] ?? "");
    setDateTo(allDates[allDates.length - 1] ?? "");
    setHourFrom(0);
    setHourTo(23);
  }, [allDates]);

  const filteredTrades = useMemo(
    () =>
      trades.filter((trade) => {
        const isAfterStart = dateFrom ? trade.tradeDate >= dateFrom : true;
        const isBeforeEnd = dateTo ? trade.tradeDate <= dateTo : true;
        const lowerHour = Math.min(hourFrom, hourTo);
        const upperHour = Math.max(hourFrom, hourTo);
        return isAfterStart && isBeforeEnd && trade.entryHour >= lowerHour && trade.entryHour <= upperHour;
      }),
    [dateFrom, dateTo, hourFrom, hourTo, trades]
  );

  const analytics = useMemo(() => calculateAnalytics(filteredTrades), [filteredTrades]);
  const stats = analytics.stats;
  const pnlTone = stats.totalNetPnl >= 0 ? "positive" : "negative";
  const summaryAccount = summaryRows[0];

  if (trades.length === 0) {
    return (
      <Card>
        <CardContent className="p-5 text-sm text-muted-foreground">
          Aucun trade exploitable dans le fichier charge.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 rounded-lg border bg-white p-5 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">{sourceName}</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-normal">Dashboard</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {trades.length} trades extraits
            {summaryAccount ? ` · Synthese CSV: ${summaryAccount.label}` : ""}.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="date-from">Date debut</Label>
            <Input
              id="date-from"
              type="date"
              value={dateFrom}
              min={allDates[0]}
              max={allDates[allDates.length - 1]}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date-to">Date fin</Label>
            <Input
              id="date-to"
              type="date"
              value={dateTo}
              min={allDates[0]}
              max={allDates[allDates.length - 1]}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hour-from">Heure debut</Label>
            <Input
              id="hour-from"
              type="number"
              min={0}
              max={23}
              value={hourFrom}
              onChange={(event) => setHourFrom(clampHour(event.target.valueAsNumber))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hour-to">Heure fin</Label>
            <Input
              id="hour-to"
              type="number"
              min={0}
              max={23}
              value={hourTo}
              onChange={(event) => setHourTo(clampHour(event.target.valueAsNumber))}
            />
          </div>
        </div>
      </section>

      {filteredTrades.length === 0 ? (
        <Card>
          <CardContent className="p-5 text-sm text-muted-foreground">
            Aucun trade ne correspond au filtre actuel.
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Net PnL total"
              value={formatCurrency(stats.totalNetPnl)}
              detail={`${stats.firstDate ?? ""} - ${stats.lastDate ?? ""}`}
              icon={Banknote}
              tone={pnlTone}
            />
            <StatCard
              label="Nombre total de trades"
              value={formatNumber(stats.totalTrades, 0)}
              detail={`${stats.tradingDays} jour(s) de trading`}
              icon={Hash}
            />
            <StatCard
              label="Trades gagnants"
              value={formatNumber(stats.winningTrades, 0)}
              detail={`${formatPercent(stats.winRate)} de win rate`}
              icon={CircleCheck}
              tone="positive"
            />
            <StatCard
              label="Trades perdants"
              value={formatNumber(stats.losingTrades, 0)}
              detail={`${stats.scratchedTrades} flat`}
              icon={CircleX}
              tone="negative"
            />
            <StatCard
              label="Trade P&L total"
              value={formatCurrency(stats.totalTradePnl)}
              detail="Avant commissions"
              icon={LineChart}
              tone={stats.totalTradePnl >= 0 ? "positive" : "negative"}
            />
            <StatCard
              label="Commissions totales"
              value={formatCurrency(stats.totalCommissionFees)}
              detail={`${formatCurrency(stats.commissionPerTrade)} par trade`}
              icon={Receipt}
              tone="warning"
            />
            <StatCard
              label="Win rate"
              value={formatPercent(stats.winRate)}
              detail={`${stats.winningTrades} gagnants · ${stats.losingTrades} perdants`}
              icon={Percent}
              tone={stats.winRate >= 50 ? "positive" : "negative"}
            />
            <StatCard
              label="Gain moyen"
              value={formatCurrency(stats.averageWin)}
              detail="Trades gagnants"
              icon={TrendingUp}
              tone="positive"
            />
            <StatCard
              label="Perte moyenne"
              value={formatCurrency(stats.averageLoss)}
              detail="Trades perdants"
              icon={TrendingDown}
              tone="negative"
            />
            <StatCard
              label="Meilleur trade"
              value={formatCurrency(stats.bestTrade)}
              icon={Target}
              tone="positive"
            />
            <StatCard
              label="Pire trade"
              value={formatCurrency(stats.worstTrade)}
              icon={ShieldAlert}
              tone="negative"
            />
            <StatCard
              label="PnL moyen / trade"
              value={formatCurrency(stats.averagePnlPerTrade)}
              icon={Sigma}
              tone={stats.averagePnlPerTrade >= 0 ? "positive" : "negative"}
            />
            <StatCard
              label="Meilleure journee"
              value={stats.bestDay ? formatCurrency(stats.bestDay.netPnl) : "n/a"}
              detail={stats.bestDay?.date}
              icon={CalendarDays}
              tone="positive"
            />
            <StatCard
              label="Pire journee"
              value={stats.worstDay ? formatCurrency(stats.worstDay.netPnl) : "n/a"}
              detail={stats.worstDay?.date}
              icon={CalendarDays}
              tone="negative"
            />
            <StatCard
              label="Profit factor"
              value={stats.profitFactor === null ? "n/a" : formatNumber(stats.profitFactor, 2)}
              detail={`Drawdown approx. ${formatCurrency(stats.maxDrawdown)}`}
              icon={Gauge}
              tone={stats.profitFactor !== null && stats.profitFactor >= 1 ? "positive" : "negative"}
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <PatternCard
              title="Meilleures plages horaires"
              items={analytics.patterns.bestHours.map(
                (hour) => `${hour.label}: ${formatCurrency(hour.netPnl)} sur ${hour.tradeCount} trades`
              )}
            />
            <PatternCard
              title="Pires plages horaires"
              items={analytics.patterns.worstHours.map(
                (hour) => `${hour.label}: ${formatCurrency(hour.netPnl)} sur ${hour.tradeCount} trades`
              )}
            />
            <PatternCard
              title="Analyse automatique"
              items={[
                `Duree moyenne gagnants: ${formatDuration(
                  analytics.patterns.averageWinningDurationSeconds
                )}`,
                `Duree moyenne perdants: ${formatDuration(
                  analytics.patterns.averageLosingDurationSeconds
                )}`,
                `Jours avec trop de trades: ${analytics.patterns.overtradingDays.length}`,
                `Grosses pertes isolees: ${analytics.patterns.isolatedLargeLosses.length}`
              ]}
            />
          </section>

          <Charts analytics={analytics} />
          <OllamaReport analytics={analytics} />
        </>
      )}
    </div>
  );
}

function PatternCard({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription>Base sur les trades filtres.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {items.length > 0 ? (
            items.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>{item}</span>
              </li>
            ))
          ) : (
            <li className="text-muted-foreground">Pas assez de donnees.</li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

function clampHour(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(23, Math.max(0, Math.round(value)));
}
