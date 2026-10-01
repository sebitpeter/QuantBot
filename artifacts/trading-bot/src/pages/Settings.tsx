import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useGetBotConfig, useUpdateBotConfig } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getGetBotConfigQueryKey } from "@workspace/api-client-react";

const configSchema = z.object({
  symbols: z.string(), // We'll convert to array on submit
  timeframe: z.string(),
  emaFast: z.coerce.number().int().min(1),
  emaSlow: z.coerce.number().int().min(2),
  rsiPeriod: z.coerce.number().int().min(2),
  rsiOversold: z.coerce.number().min(1).max(100),
  rsiOverbought: z.coerce.number().min(1).max(100),
  riskPerTrade: z.coerce.number().min(0.1).max(100),
  stopLossPct: z.coerce.number().min(0.1).max(100),
  takeProfitPct: z.coerce.number().min(0.1).max(100),
  maxOpenPositions: z.coerce.number().int().min(1),
  pollIntervalSeconds: z.coerce.number().int().min(1),
  orderType: z.string(),
  mode: z.string(),
});

type ConfigFormValues = z.infer<typeof configSchema>;

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: config, isLoading } = useGetBotConfig({
    query: { queryKey: getGetBotConfigQueryKey() }
  });
  const updateConfig = useUpdateBotConfig();

  const form = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      symbols: "",
      timeframe: "1m",
      emaFast: 9,
      emaSlow: 21,
      rsiPeriod: 14,
      rsiOversold: 30,
      rsiOverbought: 70,
      riskPerTrade: 2.0,
      stopLossPct: 1.5,
      takeProfitPct: 3.0,
      maxOpenPositions: 3,
      pollIntervalSeconds: 10,
      orderType: "MARKET",
      mode: "PAPER",
    }
  });

  const configInitialized = useRef(false);
  useEffect(() => {
    if (config && !configInitialized.current) {
      configInitialized.current = true;
      form.reset({
        ...config,
        symbols: config.symbols.join(", ")
      });
    }
  }, [config, form]);

  const onSubmit = (data: ConfigFormValues) => {
    const payload = {
      ...data,
      symbols: data.symbols.split(",").map(s => s.trim()).filter(Boolean)
    };

    updateConfig.mutate({ data: payload }, {
      onSuccess: () => {
        toast({ title: "Configuration Updated", description: "Bot settings have been saved successfully." });
        queryClient.invalidateQueries({ queryKey: getGetBotConfigQueryKey() });
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Update Failed", description: "Failed to save configuration." });
      }
    });
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground font-mono">Loading configuration...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight uppercase">Bot Parameters</h1>
        <p className="text-muted-foreground font-mono text-xs">Algorithm tunables and risk management</p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Strategy Parameters</CardTitle>
              <CardDescription>Core indicators defining entry/exit conditions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Timeframe</Label>
                <Input {...form.register("timeframe")} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>EMA Fast Period</Label>
                  <Input type="number" {...form.register("emaFast")} />
                </div>
                <div className="space-y-2">
                  <Label>EMA Slow Period</Label>
                  <Input type="number" {...form.register("emaSlow")} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>RSI Period</Label>
                  <Input type="number" {...form.register("rsiPeriod")} />
                </div>
                <div className="space-y-2">
                  <Label>RSI Oversold</Label>
                  <Input type="number" {...form.register("rsiOversold")} />
                </div>
                <div className="space-y-2">
                  <Label>RSI Overbought</Label>
                  <Input type="number" {...form.register("rsiOverbought")} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Risk Management</CardTitle>
              <CardDescription>Capital protection constraints</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Risk Per Trade (%)</Label>
                  <Input type="number" step="0.1" {...form.register("riskPerTrade")} />
                </div>
                <div className="space-y-2">
                  <Label>Max Open Positions</Label>
                  <Input type="number" {...form.register("maxOpenPositions")} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Stop Loss (%)</Label>
                  <Input type="number" step="0.1" {...form.register("stopLossPct")} />
                </div>
                <div className="space-y-2">
                  <Label>Take Profit (%)</Label>
                  <Input type="number" step="0.1" {...form.register("takeProfitPct")} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Execution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Trading Pairs (comma separated)</Label>
                <Input {...form.register("symbols")} placeholder="BTC/USDT, ETH/USDT" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Poll Interval (sec)</Label>
                  <Input type="number" {...form.register("pollIntervalSeconds")} />
                </div>
                <div className="space-y-2">
                  <Label>Order Type</Label>
                  <Input {...form.register("orderType")} />
                </div>
                <div className="space-y-2">
                  <Label>Operating Mode</Label>
                  <Input {...form.register("mode")} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={updateConfig.isPending} className="w-full md:w-auto uppercase tracking-widest font-bold">
            {updateConfig.isPending ? "Saving..." : "Apply Configuration"}
          </Button>
        </div>
      </form>
    </div>
  );
}
