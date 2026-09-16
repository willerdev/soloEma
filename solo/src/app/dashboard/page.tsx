"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type InvestorStatus, type WalletSummary } from "@/lib/api";
import { AuthLoadingScreen, useRequireAuth } from "@/hooks/use-require-auth";
import { useAuthStore, syncApiAuthToken } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";
import { InvestmentHome } from "@/components/dashboard/investment-home";

export default function DashboardPage() {
  const { ready } = useRequireAuth();
  const user = useAuthStore((s) => s.user);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [invest, setInvest] = useState<InvestorStatus | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    const token = syncApiAuthToken();
    if (!token) return;

    let cancelled = false;
    setLoading(true);
    Promise.all([api.wallet.summary(), api.investor.status()])
      .then(([w, i]) => {
        if (cancelled) return;
        setWallet(w);
        setInvest(i);
        setError("");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load dashboard");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ready]);

  if (!ready) return <AuthLoadingScreen />;

  if (loading && !wallet) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error && !wallet) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <p className="text-base font-semibold text-white">Could not load dashboard</p>
        <p className="mt-2 text-sm text-gray-400">{error}</p>
        <Button size="sm" className="mt-5" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-4 sm:px-6 sm:py-6">
      <InvestmentHome displayName={user?.displayName ?? undefined} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Wallet</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-white">
              {formatMoney(wallet?.availableBalance ?? 0)}
            </p>
            <Link href="/wallet" className="mt-2 inline-block text-sm text-primary">
              Deposit or withdraw
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Smart Invest</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-white">
              {formatMoney(invest?.investmentBalance ?? 0)}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Lifetime yield {formatMoney(invest?.walletEarnings ?? 0)}
            </p>
            <Link href="/invest" className="mt-2 inline-block text-sm text-primary">
              Manage allocation
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Income</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-white">
              {formatMoney(wallet?.totalEarned ?? 0)}
            </p>
            <p className="mt-1 text-xs text-gray-500">Wallet earnings credited</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
