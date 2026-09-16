"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Moon, Sun } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth";
import { AuthLoadingScreen, useRequireAuth } from "@/hooks/use-require-auth";
import { useThemeStore } from "@/stores/theme";

export default function SettingsPage() {
  const { ready } = useRequireAuth();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  if (!ready) return <AuthLoadingScreen />;

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-sm text-gray-400">Account and password</p>
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
