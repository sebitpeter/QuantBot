import { Link, useLocation } from "wouter";
import { Activity, BarChart3, Settings, ScrollText, Play, Square, LogOut, User } from "lucide-react";
import { useGetBotStatus, useStartBot, useStopBot } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { getGetBotStatusQueryKey } from "@workspace/api-client-react";
import { useClerk, useUser } from "@clerk/react";

export function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const { signOut } = useClerk();
  const { user } = useUser();

  const { data: status } = useGetBotStatus({
    query: { refetchInterval: 5000, queryKey: getGetBotStatusQueryKey() }
  });

  const startBot = useStartBot();
  const stopBot = useStopBot();

  const handleToggle = () => {
    if (status?.running) {
      stopBot.mutate(undefined, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetBotStatusQueryKey() })
      });
    } else {
      startBot.mutate(undefined, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetBotStatusQueryKey() })
      });
    }
  };

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: Activity },
    { href: "/positions", label: "Positions", icon: BarChart3 },
    { href: "/signals", label: "Signals", icon: Play },
    { href: "/settings", label: "Settings", icon: Settings },
    { href: "/logs", label: "Logs", icon: ScrollText },
  ];

  return (
    <div className="flex h-[100dvh] flex-col md:flex-row bg-background">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-r border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs uppercase tracking-tighter">
              Q
            </div>
            <span className="font-bold text-sm tracking-widest uppercase">QuantBot</span>
          </div>

          <Badge variant={status?.running ? "success" : "secondary"} className="md:hidden">
            {status?.running ? "ON" : "OFF"}
          </Badge>
        </div>

        <div className="p-4 border-b border-border bg-muted/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Engine Status</span>
            <div className={`h-2 w-2 rounded-full ${status?.running ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'bg-red-500'}`} />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-muted-foreground">Mode</span>
              <span className="uppercase">{status?.mode || "—"}</span>
            </div>
            <div className="flex justify-between text-xs font-mono">
              <span className="text-muted-foreground">Cycle</span>
              <span>{status?.currentCycle || 0}</span>
            </div>

            <Button
              size="sm"
              variant={status?.running ? "destructive" : "default"}
              className="w-full mt-2"
              onClick={handleToggle}
              disabled={startBot.isPending || stopBot.isPending}
            >
              {status?.running ? (
                <><Square className="w-3 h-3 mr-2 fill-current" /> STOP BOT</>
              ) : (
                <><Play className="w-3 h-3 mr-2 fill-current" /> START BOT</>
              )}
            </Button>
          </div>
        </div>

        <nav className="flex-1 overflow-auto p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href} className="block">
                <div className={`flex items-center gap-3 px-3 py-2 text-sm transition-colors border ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "text-muted-foreground border-transparent hover:bg-muted/50 hover:text-foreground hover:border-border"
                }`}>
                  <Icon className="w-4 h-4" />
                  <span className="uppercase tracking-wider font-semibold text-xs">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User profile + sign out */}
        <div className="border-t border-border">
          <div className="flex items-center gap-3 p-4">
            <div className="h-7 w-7 bg-muted border border-border flex items-center justify-center flex-shrink-0">
              <User className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-mono font-semibold truncate leading-tight">
                {user?.fullName ?? user?.username ?? user?.primaryEmailAddress?.emailAddress?.split("@")[0] ?? "User"}
              </p>
              <p className="text-xs font-mono text-muted-foreground truncate leading-tight">
                {user?.primaryEmailAddress?.emailAddress ?? ""}
              </p>
            </div>
            <button
              onClick={() => signOut({ redirectUrl: "/" })}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
