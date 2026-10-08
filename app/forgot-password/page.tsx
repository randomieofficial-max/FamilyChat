"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");

    const supabase = createClient();

    const redirectTo = `${window.location.origin}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      {
        redirectTo,
      }
    );

    if (error) {
      setError(error.message);
    } else {
      setMessage(
        "If an account exists for this email, a password reset email has been sent."
      );
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-[#07090d] px-6 py-10 text-white">
      <div className="mx-auto flex min-h-[90vh] max-w-md items-center justify-center">
        <div className="w-full rounded-3xl border border-white/10 bg-white/[0.04] p-7">
          <Link
            href="/login"
            className="mb-7 inline-flex items-center gap-2 text-sm text-gray-400"
          >
            <ArrowLeft size={16} />
            Back to login
          </Link>

          <h1 className="text-3xl font-black">
            Reset your password
          </h1>

          <p className="mt-3 text-sm leading-6 text-gray-400">
            Enter your email and we'll send you a password reset link.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
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
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}