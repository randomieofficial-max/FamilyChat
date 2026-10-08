"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  MessageCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event: FormEvent) {
    event.preventDefault();

    setLoading(true);
    setError("");

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.replace("/chat");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#07090d] px-6 py-10 text-white">
      <div className="mx-auto flex min-h-[90vh] max-w-md items-center justify-center">
        <div className="w-full">

          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white"
          >
            <ArrowLeft size={16} />
            Back
          </Link>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl">

            <div className="mb-7 flex items-center gap-3">

              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-black">
                <MessageCircle />
              </div>

              <div>
                <h1 className="text-xl font-bold">
                  Welcome back
                </h1>

                <p className="text-sm text-gray-400">
                  Sign in to FamilyChat.
                </p>
              </div>

            </div>

            <form
              onSubmit={handleLogin}
              className="space-y-4"
            >

              <div>
                <label className="mb-2 block text-sm text-gray-300">
                  Email
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3.5 outline-none transition focus:border-emerald-500"
                  placeholder="you@example.com"
                />
              </div>

              <div>

                <div className="mb-2 flex justify-between">

                  <label className="text-sm text-gray-300">
                    Password
                  </label>

                  <Link
                    href="/forgot-password"
                    className="text-xs text-emerald-400 hover:text-emerald-300"
                  >
                    Forgot password?
                  </Link>

                </div>

                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3.5 outline-none transition focus:border-emerald-500"
                  placeholder="Your password"
                />

              </div>

              {error && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3.5 font-bold text-black transition hover:bg-emerald-400 disabled:opacity-60"
              >

                {loading && (
                  <Loader2
                    className="animate-spin"
                    size={18}
                  />
                )}

                {loading
                  ? "Signing in..."
                  : "Sign in"}

              </button>

            </form>

            <p className="mt-6 text-center text-sm text-gray-400">
              Don't have an account?{" "}

              <Link
                href="/signup"
                className="font-semibold text-emerald-400"
              >
                Create one
              </Link>
            </p>

          </div>

        </div>
      </div>
    </main>
  );
}