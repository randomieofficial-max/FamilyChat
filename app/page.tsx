import Link from "next/link";
import { MessageCircle, ShieldCheck, Zap } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6">
        <header className="flex items-center justify-between py-6">
          <Link
            href="/"
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500 text-black">
              <MessageCircle size={21} />
            </div>

            <span className="text-xl font-black">
              FamilyChat
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-xl px-4 py-2 text-sm text-gray-300 transition hover:bg-white/5 hover:text-white"
            >
              Sign in
            </Link>

            <Link
              href="/signup"
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-black transition hover:bg-emerald-400"
            >
              Create account
            </Link>
          </div>
        </header>

        <section className="flex flex-1 items-center py-16">
          <div className="grid w-full gap-14 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Private family messaging
              </div>

              <h1 className="max-w-3xl text-5xl font-black leading-[1.05] tracking-tight sm:text-6xl">
                Stay connected with the people who matter.
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-8 text-gray-400">
                FamilyChat gives your family a simple,
                private place to message each other in
                real time.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/signup"
                  className="rounded-2xl bg-emerald-500 px-6 py-3.5 font-bold text-black transition hover:bg-emerald-400"
                >
                  Get started
                </Link>

                <Link
                  href="/login"
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-3.5 font-semibold transition hover:bg-white/[0.08]"
                >
                  Sign in
                </Link>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <MessageCircle
                    size={20}
                    className="text-emerald-400"
                  />
                  <p className="mt-3 font-semibold">
                    Private chats
                  </p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    One-to-one conversations.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <Zap
                    size={20}
                    className="text-emerald-400"
                  />
                  <p className="mt-3 font-semibold">
                    Real time
                  </p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    Messages update instantly.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <ShieldCheck
                    size={20}
                    className="text-emerald-400"
                  />
                  <p className="mt-3 font-semibold">
                    Protected
                  </p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    Database access is secured.
                  </p>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 rounded-[40px] bg-emerald-500/10 blur-3xl" />

              <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#0d1118] shadow-2xl">
                <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 font-bold text-black">
                    M
                  </div>

                  <div>
                    <p className="font-semibold">
                      Mom
                    </p>
                    <p className="text-xs text-emerald-400">
                      FamilyChat
                    </p>
                  </div>
                </div>

                <div className="space-y-4 p-6">
                  <div className="max-w-[75%] rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.05] px-4 py-3">
                    <p className="text-sm">
                      Are you home?
                    </p>
                    <p className="mt-1 text-right text-[10px] text-gray-500">
                      10:32 AM
                    </p>
                  </div>

                  <div className="ml-auto max-w-[75%] rounded-2xl rounded-br-md bg-emerald-500 px-4 py-3 text-black">
                    <p className="text-sm">
                      Yes! I'm home.
                    </p>
                    <p className="mt-1 text-right text-[10px] text-black/60">
                      10:33 AM ✓
                    </p>
                  </div>

                  <div className="max-w-[75%] rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.05] px-4 py-3">
                    <p className="text-sm">
                      Great ❤️
                    </p>
                    <p className="mt-1 text-right text-[10px] text-gray-500">
                      10:33 AM
                    </p>
                  </div>
                </div>

                <div className="border-t border-white/10 p-4">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-gray-500">
                    Type a message...
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="border-t border-white/10 py-6 text-center text-xs text-gray-600">
          FamilyChat • Private messaging for families
        </footer>
      </div>
    </main>
  );
}