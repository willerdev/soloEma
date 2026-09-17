"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/lib/api";
import { Loader2 } from "lucide-react";

export function NowpaymentsPayoutLoginCard() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [masked, setMasked] = useState<string | null>(null);
  const [passwordSet, setPasswordSet] = useState(false);
  const [apiKeySet, setApiKeySet] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void api.wallet
      .nowpaymentsPayoutLogin()
      .then((s) => {
        setApiKeySet(s.apiKeySet);
        setMasked(s.payoutEmailMasked);
        setPasswordSet(s.payoutPasswordSet);
        setReady(s.payoutConfigured);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const s = await api.wallet.saveNowpaymentsPayoutLogin({
        email: email.trim(),
        password: password.trim(),
      });
      setMasked(s.payoutEmailMasked);
      setPasswordSet(s.payoutPasswordSet);
      setReady(s.payoutConfigured);
      setApiKeySet(s.apiKeySet);
      setPassword("");
      setNotice("Saved. Both of you will use this NOWPayments login for payouts.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>NOWPayments payout login</CardTitle>
        <CardDescription>
          Username (email) and password for the NOWPayments payout account.
          Either of you can enter them; they are shared for every withdrawal.
          The API key stays on the server.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted" />
        ) : (
          <form onSubmit={(e) => void save(e)} className="space-y-3">
            <p className="text-xs text-muted">
              API key {apiKeySet ? "is set" : "is missing on solo-api"} · login{" "}
              {ready ? "ready" : "not saved yet"}
              {masked ? ` (${masked})` : ""}
              {passwordSet ? " · password saved" : ""}
            </p>
            <div className="space-y-1">
              <Label htmlFor="np-email">Payout email / username</Label>
              <Input
                id="np-email"
                type="email"
                autoComplete="off"
                placeholder="NOWPayments account email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="np-password">Payout password</Label>
              <Input
                id="np-password"
                type="password"
                autoComplete="new-password"
                placeholder="NOWPayments account password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            {notice && <p className="text-sm text-success">{notice}</p>}
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save for both users"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
