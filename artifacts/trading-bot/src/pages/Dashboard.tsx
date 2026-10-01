import { 
  useGetPortfolioSummary, 
  useGetMarketPrices, 
  useGetSignals,
  getGetPortfolioSummaryQueryKey,
  getGetMarketPricesQueryKey,
  getGetSignalsQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";
import { formatNumber, formatCurrency, formatPercent } from "@/lib/formatters";

export default function Dashboard() {
  const { data: summary } = useGetPortfolioSummary({
    query: { refetchInterval: 5000, queryKey: getGetPortfolioSummaryQueryKey() }
  });
  
  const { data: prices } = useGetMarketPrices({
    query: { refetchInterval: 5000, queryKey: getGetMarketPricesQueryKey() }
  });
  
  const { data: signals } = useGetSignals(
    { limit: 10 },
    { query: { refetchInterval: 5000, queryKey: getGetSignalsQueryKey({ limit: 10 }) } }
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight uppercase">Dashboard</h1>
        <p className="text-muted-foreground font-mono text-xs">Real-time telemetry and strategy execution</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Total Equity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {formatCurrency(summary?.equity ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              Active Balance
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Unrealised P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold font-mono flex items-center ${(summary?.totalUnrealisedPnl ?? 0) >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
              {(summary?.totalUnrealisedPnl ?? 0) >= 0 ? '+' : ''}{formatCurrency(summary?.totalUnrealisedPnl ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              Across {summary?.openPositions ?? 0} open positions
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Win Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {summary?.winRate ? formatPercent(summary.winRate) : '—'}
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              Historical performance
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Signals Executed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {formatNumber(summary?.totalSignals ?? 0)}
            </div>
            <div className="flex gap-2 text-xs font-mono mt-1">
              <span className="text-green-600">B: {summary?.buySignals ?? 0}</span>
              <span className="text-red-600">S: {summary?.sellSignals ?? 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ticker Grid */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>Market Data</CardTitle>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border-t border-border">
              {prices?.map((ticker) => {
                const isPositive = (ticker.change24h ?? 0) >= 0;
                return (
                  <div key={ticker.symbol} className="p-4 border-b border-r border-border hover:bg-muted/30 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold tracking-widest text-sm uppercase">{ticker.symbol}</span>
                      <span className={`flex items-center text-xs font-mono ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        {isPositive ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                        {formatPercent(ticker.change24h ?? 0)}
                      </span>
                    </div>
                    <div className="text-xl font-mono">
                      {formatNumber(ticker.price)}
                    </div>
                    <div className="flex justify-between text-[10px] font-mono text-muted-foreground mt-2 uppercase">
                      <span>L: {ticker.low24h ? formatNumber(ticker.low24h) : '—'}</span>
                      <span>H: {ticker.high24h ? formatNumber(ticker.high24h) : '—'}</span>
                    </div>
                  </div>
                );
              })}
              {(!prices || prices.length === 0) && (
                <div className="p-8 text-center text-muted-foreground font-mono text-sm col-span-full">
                  Waiting for market data...
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Signals */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Recent Signals</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y border-t">
              {signals?.map(signal => (
                <div key={signal.id} className="p-3 flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Badge variant={signal.type === 'BUY' ? 'success' : 'destructive'} className="text-[10px]">
                        {signal.type}
                      </Badge>
                      <span className="font-bold text-sm tracking-widest">{signal.symbol}</span>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">
                      {new Date(signal.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span>@ {formatNumber(signal.price)}</span>
                    <span className="text-muted-foreground">RSI: {signal.rsi.toFixed(1)}</span>
                  </div>
                </div>
              ))}
              {(!signals || signals.length === 0) && (
                <div className="p-8 text-center text-muted-foreground font-mono text-sm">
                  No signals generated yet.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
