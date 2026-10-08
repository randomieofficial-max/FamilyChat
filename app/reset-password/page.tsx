"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setReady(true);
      } else {
        setError(
          "This password reset link is invalid or has expired."
        );
      }
    });
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");

    const supabase = createClient();

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setMessage("Password updated successfully.");

    setTimeout(() => {
      router.replace("/chat");
    }, 1000);
  }

  return (
    <main className="min-h-screen bg-[#07090d] px-6 py-10 text-white">
      <div className="mx-auto flex min-h-[90vh] max-w-md items-center justify-center">
        <div className="w-full rounded-3xl border border-white/10 bg-white/[0.04] p-7">
          <h1 className="text-3xl font-black">
            Create a new password
          </h1>

          <p className="mt-3 text-sm text-gray-400">
            Choose a new password for your FamilyChat account.
          </p>

          {!ready && !error && (
            <div className="mt-7 text-sm text-gray-400">
              Checking reset link...
            </div>
          )}

          {ready && (
            <form onSubmit={handleSubmit} className="mt-7 space-y-4">
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3.5 outline-none focus:border-emerald-500"
              />

              {error && (
                <div className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-300">
                  {error}
                </div>
              )}

              {message && (
                <div className="rounded-2xl bg-emerald-500/10 p-4 text-sm text-emerald-300">
                  {message}
                </div>
              )}

              <button
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3.5 font-bold text-black"
              >
                {loading && <Loader2 size={18} className="animate-spin" />}
                {loading ? "Updating..." : "Update password"}
              </button>
            </form>
          )}

          {error && (
            <button
              onClick={() => router.push("/login")}
              className="mt-5 rounded-xl border border-white/10 px-4 py-3 text-sm"
            >
              Return to login
            </button>
          )}
        </div>
      </div>
    </main>
  );
}