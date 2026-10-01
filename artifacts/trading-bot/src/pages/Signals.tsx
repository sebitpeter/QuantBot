import { useGetSignals, getGetSignalsQueryKey } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/formatters";

export default function Signals() {
  const { data: signals } = useGetSignals(
    { limit: 100 },
    { query: { refetchInterval: 10000, queryKey: getGetSignalsQueryKey({ limit: 100 }) } }
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight uppercase">Signal History</h1>
        <p className="text-muted-foreground font-mono text-xs">Algorithmic entry triggers and indicators</p>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Symbol</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">EMA (F/S)</TableHead>
              <TableHead className="text-right">RSI</TableHead>
              <TableHead>Action Taken</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {signals?.map((signal) => (
              <TableRow key={signal.id}>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {new Date(signal.timestamp).toLocaleString()}
                </TableCell>
                <TableCell className="font-bold tracking-widest">{signal.symbol}</TableCell>
                <TableCell>
                  <Badge variant={signal.type === 'BUY' ? 'success' : 'destructive'}>
                    {signal.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-bold">{formatNumber(signal.price)}</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatNumber(signal.emaFast, 2)} / {formatNumber(signal.emaSlow, 2)}
                </TableCell>
                <TableCell className="text-right">
                  <span className={signal.rsi > 70 ? 'text-red-500' : signal.rsi < 30 ? 'text-green-500' : ''}>
                    {signal.rsi.toFixed(2)}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={signal.action === 'EXECUTED' ? 'default' : 'outline'} className="text-[10px]">
                    {signal.action}
                  </Badge>
                  {signal.reason && (
                    <div className="text-[10px] text-muted-foreground mt-1 max-w-[200px] truncate" title={signal.reason}>
                      {signal.reason}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(!signals || signals.length === 0) && (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  No signals recorded yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
