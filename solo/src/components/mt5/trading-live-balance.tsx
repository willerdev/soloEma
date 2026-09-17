"use client";

import { Radio } from "lucide-react";
import { fmtMt5Price } from "@/components/mt5/mt5-ui";
import { cn } from "@/lib/utils";

type Props = {
  equity: number;
  balance: number;
  currency: string;
  live: boolean;
  linked: boolean;
};

export function TradingLiveBalance({
  equity,
  balance,
  currency,
  live,
  linked,
}: Props) {
  if (!linked) return null;

  return (
    <div className="flex min-w-0 flex-1 items-baseline gap-3 sm:justify-center">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
          Equity
        </p>
        <p className="truncate text-2xl font-bold tabular-nums leading-none text-foreground sm:text-3xl">
          {fmtMt5Price(equity)}
          <span className="ml-1.5 text-sm font-semibold text-muted">
            {currency}
          </span>
        </p>
        <p className="mt-1 text-[11px] text-muted">
          Balance {fmtMt5Price(balance)}
        </p>
      </div>
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
          live
            ? "bg-success/15 text-success"
            : "past-data-label bg-amber-500/15 text-amber-300",
        )}
      >
        {live ? (
          <>
            <span className="live-status-dot text-success" aria-hidden />
            Live
          </>
        ) : (
          <>
            <Radio className="h-3 w-3" />
            Past data
          </>
        )}
      </span>
    </div>
  );
}
