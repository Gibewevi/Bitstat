import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis
} from "recharts";
import type { AnalyticsResult, DurationPoint } from "@/types/trade";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/utils";

interface ChartsProps {
  analytics: AnalyticsResult;
}

const chartMargin = { top: 12, right: 16, bottom: 8, left: 0 };
const positiveColor = "#047857";
const negativeColor = "#be123c";
const neutralColor = "#4f46e5";
const feeColor = "#d97706";

export function Charts({ analytics }: ChartsProps) {
  const commissionData = analytics.daily.map((day) => ({
    ...day,
    commissionCost: -day.commissionFees
  }));
  const positiveDurations = analytics.durationScatter.filter((point) => point.netPnl >= 0);
  const negativeDurations = analytics.durationScatter.filter((point) => point.netPnl < 0);

  return (
    <section className="grid gap-4 xl:grid-cols-2">
      <ChartPanel
        title="Courbe d'equity cumulative"
        description="Somme progressive du Net P&L, trades tries chronologiquement."
      >
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={analytics.equityCurve} margin={chartMargin}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tickLine={false} interval="preserveStartEnd" />
            <YAxis tickFormatter={(value) => formatNumber(Number(value), 0)} width={72} />
            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            <Area
              type="monotone"
              dataKey="equity"
              name="Equity"
              stroke={neutralColor}
              fill={neutralColor}
              fillOpacity={0.14}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartPanel>

      <ChartPanel title="PnL par jour" description="Net P&L agrege par date de trade.">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={analytics.daily} margin={chartMargin}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tickLine={false} />
            <YAxis tickFormatter={(value) => formatNumber(Number(value), 0)} width={72} />
            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            <Bar dataKey="netPnl" name="Net P&L" radius={[4, 4, 0, 0]}>
              {analytics.daily.map((day) => (
                <Cell key={day.date} fill={day.netPnl >= 0 ? positiveColor : negativeColor} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartPanel>

      <ChartPanel title="PnL par trade" description="Resultat net de chaque trade.">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={analytics.tradeSeries} margin={chartMargin}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tickLine={false} hide />
            <YAxis tickFormatter={(value) => formatNumber(Number(value), 0)} width={72} />
            <Tooltip
              formatter={(value) => formatCurrency(Number(value))}
              labelFormatter={(_, items) => {
                const payload = items?.[0]?.payload as { label?: string; date?: string; hour?: string };
                return `${payload?.label ?? ""} ${payload?.date ?? ""} ${payload?.hour ?? ""}`;
              }}
            />
            <Bar dataKey="netPnl" name="Net P&L">
              {analytics.tradeSeries.map((trade) => (
                <Cell
                  key={trade.index}
                  fill={trade.netPnl >= 0 ? positiveColor : negativeColor}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartPanel>

      <ChartPanel title="PnL par heure" description="Performance nette par heure d'entree.">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={analytics.hourly} margin={chartMargin}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tickLine={false} />
            <YAxis tickFormatter={(value) => formatNumber(Number(value), 0)} width={72} />
            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            <Bar dataKey="netPnl" name="Net P&L" radius={[4, 4, 0, 0]}>
              {analytics.hourly.map((hour) => (
                <Cell key={hour.hour} fill={hour.netPnl >= 0 ? positiveColor : negativeColor} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartPanel>

      <ChartPanel title="Win rate par heure" description="Pourcentage de trades gagnants par heure.">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={analytics.hourly} margin={chartMargin}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tickLine={false} />
            <YAxis yAxisId="left" tickFormatter={(value) => `${formatNumber(Number(value), 0)} %`} />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip
              formatter={(value, name) =>
                name === "Win rate"
                  ? `${formatNumber(Number(value), 1)} %`
                  : formatNumber(Number(value), 0)
              }
            />
            <Legend />
            <Bar yAxisId="right" dataKey="tradeCount" name="Trades" fill="#64748b" radius={[4, 4, 0, 0]} />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="winRate"
              name="Win rate"
              stroke={neutralColor}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartPanel>

      <ChartPanel title="Repartition gagnants / perdants" description="Classification par Net P&L.">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={analytics.distribution}
              dataKey="value"
              nameKey="name"
              innerRadius={68}
              outerRadius={105}
              paddingAngle={3}
              label
            >
              <Cell fill={positiveColor} />
              <Cell fill={negativeColor} />
              <Cell fill="#71717a" />
            </Pie>
            <Tooltip formatter={(value) => formatNumber(Number(value), 0)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </ChartPanel>

      <ChartPanel title="Impact des commissions" description="P&L brut, frais et Net P&L par jour.">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={commissionData} margin={chartMargin}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tickLine={false} />
            <YAxis tickFormatter={(value) => formatNumber(Number(value), 0)} width={72} />
            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            <Legend />
            <Bar dataKey="tradePnl" name="Trade P&L" fill={positiveColor} radius={[4, 4, 0, 0]} />
            <Bar dataKey="commissionCost" name="Commissions" fill={feeColor} radius={[4, 4, 0, 0]} />
            <Line type="monotone" dataKey="netPnl" name="Net P&L" stroke={neutralColor} strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartPanel>

      <ChartPanel
        title="Duree des trades vs resultat"
        description="Chaque point compare duree en minutes et Net P&L."
      >
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={chartMargin}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="durationMinutes"
              name="Duree"
              unit=" min"
              tickLine={false}
            />
            <YAxis
              type="number"
              dataKey="netPnl"
              name="Net P&L"
              tickFormatter={(value) => formatNumber(Number(value), 0)}
              width={72}
            />
            <ZAxis range={[48, 48]} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<DurationTooltip />} />
            <Scatter name="Gagnants" data={positiveDurations} fill={positiveColor} />
            <Scatter name="Perdants" data={negativeDurations} fill={negativeColor} />
            <Legend />
          </ScatterChart>
        </ResponsiveContainer>
      </ChartPanel>
    </section>
  );
}

function ChartPanel({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function DurationTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: DurationPoint }> }) {
  if (!active || !payload?.[0]) {
    return null;
  }

  const point = payload[0].payload;

  return (
    <div className="rounded-md border bg-white p-3 text-sm shadow-sm">
      <p className="font-medium">
        {point.date} · {point.hour}
      </p>
      <p>Duree: {formatNumber(point.durationMinutes, 2)} min</p>
      <p>Net P&L: {formatCurrency(point.netPnl)}</p>
    </div>
  );
}
