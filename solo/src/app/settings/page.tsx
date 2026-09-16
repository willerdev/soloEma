"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Moon, Sun } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth";
import { AuthLoadingScreen, useRequireAuth } from "@/hooks/use-require-auth";
import { useThemeStore } from "@/stores/theme";
import { api } from "@/lib/api";

export default function SettingsPage() {
  const { ready } = useRequireAuth();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const [token, setToken] = useState("");
  const [connected, setConnected] = useState(false);
  const [masked, setMasked] = useState<string | null>(null);
  const [derivMsg, setDerivMsg] = useState("");
  const [derivErr, setDerivErr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!ready) return;
    void api.deriv
      .status()
      .then((s) => {
        setConnected(s.connected);
        setMasked(s.tokenMasked);
      })
      .catch(() => undefined);
  }, [ready]);

  async function saveToken(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setDerivErr("");
    setDerivMsg("");
    try {
      const res = await api.deriv.saveToken(token.trim());
      setConnected(true);
      setMasked(res.tokenMasked);
      setToken("");
      setDerivMsg("Token saved. Open Deriv to see MT5 balances.");
    } catch (err) {
      setDerivErr(err instanceof Error ? err.message : "Could not save token");
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    setSaving(true);
    setDerivErr("");
    try {
      await api.deriv.disconnect();
      setConnected(false);
      setMasked(null);
      setDerivMsg("Disconnected.");
    } catch (err) {
      setDerivErr(err instanceof Error ? err.message : "Could not disconnect");
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return <AuthLoadingScreen />;

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-sm text-gray-400">Account and Deriv token</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>{user?.email ?? "Signed in"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-300">
          <p>
            Display name:{" "}
            <span className="text-white">{user?.displayName ?? "—"}</span>
          </p>
          <Button
            variant="secondary"
            className="gap-2"
            onClick={() => toggleTheme()}
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deriv / MT5</CardTitle>
          <CardDescription>
            On developers.deriv.com create a Native PAT app, put that App ID
            on solo-api as DERIV_APP_ID, then paste a PAT with Trade, Payments,
            and Account management. We never show the full token again after
            save.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {connected && (
            <p className="text-sm text-success">
              Connected {masked ? `(${masked})` : ""}
            </p>
          )}
          <form onSubmit={saveToken} className="space-y-2">
            <Label htmlFor="deriv-token">API token</Label>
            <Input
              id="deriv-token"
              type="password"
              autoComplete="off"
              placeholder="Paste token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
            />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save token"}
              </Button>
              {connected && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => void disconnect()}
                >
                  Disconnect
                </Button>
              )}
              <Link href="/deriv">
                <Button type="button" variant="ghost">
                  Open Deriv
                </Button>
              </Link>
            </div>
          </form>
          {derivMsg && <p className="text-sm text-success">{derivMsg}</p>}
          {derivErr && <p className="text-sm text-danger">{derivErr}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            We email a reset link. No KYC is required on Solo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/forgot-password">
            <Button variant="secondary">Reset password</Button>
          </Link>
        </CardContent>
      </Card>

      <Button
        variant="danger"
        className="gap-2"
        onClick={() => {
          logout();
          router.replace("/login");
        }}
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </Button>
    </div>
  );
}
