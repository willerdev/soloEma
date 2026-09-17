"use client";

import { useCallback, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { api, type UserMt5Trade } from "@/lib/api";
import { AuthLoadingScreen, useRequireAuth } from "@/hooks/use-require-auth";
import { useAuthStore } from "@/stores/auth";
import { useMt5Terminal } from "@/hooks/use-mt5-terminal";
import { Mt5ChartTerminal } from "@/components/mt5/mt5-chart-terminal";
import { Mt5LiveSyncCard } from "@/components/mt5/mt5-live-sync-card";
import { pickDefaultChartSymbol } from "@/lib/chart-market-status";

export default function SoloMt5Page() {
  const { ready, hasHydrated } = useRequireAuth();
  const userId = useAuthStore((s) => s.user?.id);
  const [selectedChartSymbol, setSelectedChartSymbol] = useState<string | null>(
    null,
  );

  const {
    data,
    runningTrades,
    quotes,
    loading,
    error,
    setError,
    load,
    loadRunning,
  } = useMt5Terminal(userId, ready, hasHydrated, "chart", ready);

  const limitTrades = useMemo(
    () => (data?.trades ?? []).filter((t) => t.kind === "limit"),
    [data?.trades],
  );
  const displayRunningTrades = useMemo(() => {
    const merged = new Map<string, UserMt5Trade>();
    const keyFor = (t: UserMt5Trade) =>
      t.positionId ?? t.orderId ?? `${t.symbol}-${t.openPrice ?? ""}`;
    for (const trade of data?.trades ?? []) {
      if (trade.kind !== "running") continue;
      merged.set(keyFor(trade), trade);
    }
    for (const trade of runningTrades) {
      merged.set(keyFor(trade), trade);
    }
    return [...merged.values()];
  }, [data?.trades, runningTrades]);

  const chartSymbol = useMemo(
    () =>
      selectedChartSymbol ??
      pickDefaultChartSymbol([
        displayRunningTrades[0]?.symbol,
        quotes[0]?.symbol,
      ]),
    [selectedChartSymbol, displayRunningTrades, quotes],
  );

  const linked = Boolean(data?.account);
  const needsConnect = Boolean(data?.message) && !linked && !loading;

  const handleCloseTrade = useCallback(
    async (trade: UserMt5Trade) => {
      const id = trade.positionId ?? trade.orderId;
      if (!id) return;
      setError(null);
      try {
        await api.signals.closeMt5Position(id);
        await load({ background: true });
        await loadRunning();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not close trade");
      }
    },
    [load, loadRunning, setError],
  );

  if (!ready) return <AuthLoadingScreen />;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-[var(--color-border)] px-4 py-3">
        <h1 className="text-xl font-bold text-white">Charts</h1>
        <p className="mt-0.5 text-sm text-muted">
          Live MetaAPI candles. Open MT5 trades pin as entry, stop, and take-profit
          lines.
        </p>
      </div>

      {error && (
        <p className="px-4 py-2 text-sm text-danger">{error}</p>
      )}

      {(needsConnect || !linked) && (
        <div className="px-4 py-3">
          <Mt5LiveSyncCard
            tradingActive
            linkedAccountId={null}
            onAccountLinked={() => {
              void load({ background: false });
            }}
          />
        </div>
      )}

      {loading && !data ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : (
        <div className="min-h-[70vh] flex-1">
          <Mt5ChartTerminal
            quotes={quotes}
            runningTrades={displayRunningTrades}
            limitTrades={limitTrades}
            setups={[]}
            account={data?.account}
            accountSource={data?.accountSource}
            selectedSymbol={chartSymbol}
            onSelectSymbol={setSelectedChartSymbol}
            onOpenSetup={() => undefined}
            onCloseTrade={(trade) => void handleCloseTrade(trade)}
            onStopsUpdated={() => {
              void load({ background: true });
              void loadRunning();
            }}
            onTradePlaced={() => {
              void load({ background: true });
              void loadRunning();
            }}
            showOrdersPanel
          />
        </div>
      )}
    </div>
  );
}
