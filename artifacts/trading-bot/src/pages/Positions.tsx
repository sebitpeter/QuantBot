import { useGetPositions, useClosePosition } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import { useQueryClient } from "@tanstack/react-query";
import { getGetPositionsQueryKey, getGetPortfolioSummaryQueryKey } from "@workspace/api-client-react";

export default function Positions() {
  const queryClient = useQueryClient();
  const { data: positions } = useGetPositions({
    query: { refetchInterval: 5000, queryKey: getGetPositionsQueryKey() }
  });
  
  const closePosition = useClosePosition();

  const handleClose = (symbol: string) => {
    closePosition.mutate({ symbol }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPositionsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetPortfolioSummaryQueryKey() });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight uppercase">Open Positions</h1>
        <p className="text-muted-foreground font-mono text-xs">Live trade management</p>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Symbol</TableHead>
              <TableHead>Side</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Entry</TableHead>
              <TableHead className="text-right">Current</TableHead>
              <TableHead className="text-right">SL / TP</TableHead>
              <TableHead className="text-right">Unrealised P&L</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions?.map((pos) => {
              const isProfit = pos.unrealisedPnl >= 0;
              return (
                <TableRow key={pos.symbol}>
                  <TableCell className="font-bold tracking-widest">{pos.symbol}</TableCell>
                  <TableCell>
                    <Badge variant={pos.side === 'LONG' ? 'success' : 'destructive'}>
                      {pos.side}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(pos.quantity, 6)}</TableCell>
                  <TableCell className="text-right">{formatNumber(pos.entryPrice)}</TableCell>
                  <TableCell className="text-right font-bold">{formatNumber(pos.currentPrice)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    <div className="text-red-500/80">{formatNumber(pos.stopLoss)}</div>
                    <div className="text-green-500/80">{formatNumber(pos.takeProfit)}</div>
                  </TableCell>
                  <TableCell className={`text-right font-bold ${isProfit ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                    {isProfit ? '+' : ''}{formatCurrency(pos.unrealisedPnl)}
                    <div className="text-[10px] font-normal opacity-80">
                      {isProfit ? '+' : ''}{formatPercent(pos.pnlPct)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={closePosition.isPending}
                      onClick={() => handleClose(pos.symbol)}
                    >
                      Close
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {(!positions || positions.length === 0) && (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                  No open positions.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
