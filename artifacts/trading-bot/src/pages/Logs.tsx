import { useGetBotLogs, getGetBotLogsQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";

export default function Logs() {
  const { data: logs } = useGetBotLogs(
    { limit: 200 },
    { query: { refetchInterval: 2000, queryKey: getGetBotLogsQueryKey({ limit: 200 }) } }
  );

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex flex-col gap-2 shrink-0">
        <h1 className="text-2xl font-bold tracking-tight uppercase">System Logs</h1>
        <p className="text-muted-foreground font-mono text-xs">Raw execution output</p>
      </div>

      <div className="flex-1 overflow-auto bg-card border border-border p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap">
        {logs?.map((log) => (
          <div key={log.id} className="flex gap-4 py-1 border-b border-border/20 last:border-0 hover:bg-muted/30">
            <span className="text-muted-foreground shrink-0 w-[180px]">
              {new Date(log.timestamp).toISOString().replace('T', ' ').slice(0, 23)}
            </span>
            <span className="shrink-0 w-20">
              <Badge variant={
                log.level === 'ERROR' ? 'destructive' :
                log.level === 'WARN' ? 'warning' :
                'info'
              } className="text-[10px] w-full justify-center">
                {log.level}
              </Badge>
            </span>
            {log.symbol && (
              <span className="shrink-0 w-20 font-bold">
                {log.symbol}
              </span>
            )}
            <span className={`flex-1 ${log.level === 'ERROR' ? 'text-red-600 dark:text-red-400 font-bold' : ''}`}>
              {log.message}
            </span>
          </div>
        ))}
        {(!logs || logs.length === 0) && (
          <div className="text-center text-muted-foreground py-8">
            Awaiting log entries...
          </div>
        )}
      </div>
    </div>
  );
}
