"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type UserMt5HistoryItem } from "@/lib/api";
import {
  readMt5HistoryCache,
  writeMt5HistoryCache,
} from "@/lib/mt5-history-cache";

export function useMt5History(
  userId: string | undefined,
  linked: boolean,
  active: boolean,
) {
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
    if (!active || !linked || !userId) return;
    void load({ fresh: false });
  }, [active, linked, userId, load]);

  return { items, loading, error, load };
}
