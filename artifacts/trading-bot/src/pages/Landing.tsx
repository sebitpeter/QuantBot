import { Link } from "wouter";
import { Show } from "@clerk/react";

export default function Landing() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border h-16 flex items-center px-8 justify-between">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs uppercase tracking-tighter">
            Q
          </div>
          <span className="font-bold text-sm tracking-widest uppercase font-mono">QuantBot</span>
        </div>
        <Show when="signed-out">
          <div className="flex items-center gap-3">
            <Link href="/sign-in">
              <button className="text-xs uppercase tracking-widest font-mono font-semibold text-muted-foreground hover:text-foreground transition-colors px-3 py-2">
                Sign In
              </button>
            </Link>
            <Link href="/sign-up">
              <button className="text-xs uppercase tracking-widest font-mono font-semibold bg-primary text-primary-foreground px-4 py-2 hover:opacity-90 transition-opacity">
                Get Started
              </button>
            </Link>
          </div>
        </Show>
        <Show when="signed-in">
          <Link href="/dashboard">
            <button className="text-xs uppercase tracking-widest font-mono font-semibold bg-primary text-primary-foreground px-4 py-2 hover:opacity-90 transition-opacity">
              Go to Dashboard
            </button>
          </Link>
        </Show>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-8 text-center max-w-2xl mx-auto w-full gap-8">
        <div className="space-y-2">
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-muted-foreground">
            Algorithmic Trading
          </p>
          <h1 className="text-5xl font-bold tracking-tighter font-mono leading-none">
            QUANTBOT
          </h1>
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
            EMA · RSI · Paper Trading Engine
          </p>
        </div>

        <div className="w-full border border-border p-6 text-left space-y-3 font-mono text-sm bg-muted/20">
          <div className="flex items-center gap-3 text-muted-foreground text-xs uppercase tracking-widest">
            <span className="text-green-500">●</span> SYSTEM ONLINE
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="text-muted-foreground">Strategy</div>
            <div>EMA(5/20) + RSI(14)</div>
            <div className="text-muted-foreground">Risk per trade</div>
            <div>2.00%</div>
            <div className="text-muted-foreground">Mode</div>
            <div>Paper Trading</div>
            <div className="text-muted-foreground">Markets</div>
            <div>BTC · ETH · BNB</div>
          </div>
        </div>

        <Show when="signed-out">
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
            <Link href="/sign-up" className="flex-1">
              <button className="w-full bg-primary text-primary-foreground text-xs font-mono font-semibold uppercase tracking-widest py-3 hover:opacity-90 transition-opacity">
                Create Account
              </button>
            </Link>
            <Link href="/sign-in" className="flex-1">
              <button className="w-full border border-border text-xs font-mono font-semibold uppercase tracking-widest py-3 hover:bg-muted/50 transition-colors">
                Sign In
              </button>
            </Link>
          </div>
        </Show>
        <Show when="signed-in">
          <Link href="/dashboard">
            <button className="bg-primary text-primary-foreground text-xs font-mono font-semibold uppercase tracking-widest py-3 px-8 hover:opacity-90 transition-opacity">
              Open Dashboard →
            </button>
          </Link>
        </Show>
      </main>

      <footer className="border-t border-border p-4 text-center text-xs font-mono text-muted-foreground">
        Paper trading only — not financial advice
      </footer>
    </div>
  );
}
