"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type UserMt5HistoryItem } from "@/lib/api";
import {
  readMt5HistoryCache,
  writeMt5HistoryCache,
} from "@/lib/mt5-history-cache";
import { useMetaApiLive } from "@/hooks/use-metaapi-live";

const POLL_MS = 45_000;

function startOfLocalDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function useMt5History(userId: string | undefined, linked: boolean) {
  const { live } = useMetaApiLive();
  const [items, setItems] = useState<UserMt5HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const cached = readMt5HistoryCache(userId);
    if (cached) setItems(cached.items);
  }, [userId]);

  const load = useCallback(
    async (opts?: { fresh?: boolean }) => {
      if (!userId || !linked) return;
      setLoading(true);
      setError(null);
      try {
        const res = await api.signals.mt5History(opts?.fresh);
        if (res.message && res.items.length === 0) {
          setError(res.message);
          return;
        }
        setItems(res.items);
        writeMt5HistoryCache(userId, res.items);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not load trade history",
        );
      } finally {
        setLoading(false);
      }
    },
    [userId, linked],
  );

  useEffect(() => {
    if (!linked || !userId || !live) return;
    void load({ fresh: false });
    const id = window.setInterval(() => void load({ fresh: false }), POLL_MS);
    return () => window.clearInterval(id);
  }, [linked, userId, live, load]);

  const dayPnl = useMemo(() => {
    const start = startOfLocalDay();
    return items.reduce((sum, row) => {
      const closed = new Date(row.closedAt).getTime();
      if (!Number.isFinite(closed) || closed < start) return sum;
      return sum + (row.pnl ?? 0);
    }, 0);
  }, [items]);

  return { items, loading, error, load, dayPnl };
}
