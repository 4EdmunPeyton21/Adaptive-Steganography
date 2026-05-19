import Link from "next/link";
import { LockKeyhole, ShieldCheck } from "lucide-react";

export default function VaultPage() {
  return (
    <main className="min-h-dvh bg-[#050505] px-5 py-8 text-white sm:px-8">
      <Link
        className="font-mono text-xs uppercase tracking-[0.28em] text-cyan-200/55 transition hover:text-cyan-100"
        href="/"
      >
        Cuttlefish
      </Link>

      <section className="mx-auto flex min-h-[calc(100dvh-6rem)] max-w-3xl flex-col items-center justify-center text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-300/10 text-cyan-200">
          <LockKeyhole aria-hidden="true" size={30} />
        </div>
        <p className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-[0.2em] text-cyan-200/70">
          <ShieldCheck aria-hidden="true" size={16} />
          Vault unlocked
        </p>
        <h1 className="text-4xl font-semibold tracking-normal sm:text-6xl">
          Your hidden workspace is ready.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
          This placeholder keeps the login flow complete while the real vault
          tools are being connected.
        </p>
      </section>
    </main>
  );
}
