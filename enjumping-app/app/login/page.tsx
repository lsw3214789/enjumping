"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    });

    if (authError) {
      setError(authError.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl font-bold">Enjumping</CardTitle>
          <p className="text-sm text-zinc-500 mt-1">用 Email 登入，無需密碼</p>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-5 text-center dark:bg-green-950 dark:border-green-800">
              <p className="text-green-800 dark:text-green-200 font-medium text-sm">
                登入連結已寄出！
              </p>
              <p className="text-green-600 dark:text-green-400 text-xs mt-1">
                請去 {email} 收信，點擊信中連結即可登入
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Google 登入按鈕 */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                使用 Google 登入
              </button>

              {/* 分隔線 */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
                <span className="text-xs text-zinc-400">或</span>
                <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
              </div>

              {/* Email Magic Link 表單（原本不變） */}
              <form onSubmit={handleSubmit} className="space-y-3">
                <Input
                  type="email"
                  placeholder="你的 Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                />
                {error && (
                  <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
                )}
                <Button type="submit" className="w-full" disabled={loading || !email.trim()}>
                  {loading ? "寄送中..." : "寄送登入連結"}
                </Button>
              </form>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
