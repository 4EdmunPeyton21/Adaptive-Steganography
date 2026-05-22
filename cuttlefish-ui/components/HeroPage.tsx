"use client";

import Link from "next/link";
import WarpShaderHero from "@/components/ui/wrap-shader";

function Nav() {
  return (
    <nav
      id="hero-nav"
      className="fixed inset-x-0 top-0 z-50 flex min-h-16 items-center justify-between gap-4 border-b border-white/10 bg-black/20 px-5 py-3 backdrop-blur-md sm:px-8"
    >
      <span className="min-w-0 truncate font-mono text-sm font-semibold uppercase tracking-[0.28em] text-cyan-100/80 sm:text-base">
        Cuttlefish
      </span>

      <Link
        id="nav-start-btn"
        className="inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-cyan-100/20 bg-cyan-300 px-5 text-sm font-bold leading-none text-slate-950 shadow-[0_0_28px_rgba(0,255,238,0.22)] transition hover:bg-white hover:shadow-[0_0_42px_rgba(0,255,238,0.34)] focus:outline-none focus:ring-4 focus:ring-cyan-300/25"
        href="/auth/login"
      >
        Open Vault
      </Link>
    </nav>
  );
}

export default function HeroPage() {
  return (
    <>
      <Nav />

      <WarpShaderHero>
        <section className="mx-auto flex w-full max-w-5xl flex-col items-center pt-16 text-center">
          <p className="mb-5 font-mono text-xs uppercase tracking-[0.32em] text-cyan-100/65 sm:text-sm">
            Neural steganography vault
          </p>

          <h1 className="max-w-4xl text-balance text-5xl font-semibold leading-[0.98] tracking-normal text-white sm:text-6xl md:text-7xl">
            Adaptive Steganography
          </h1>

          <p className="mt-7 max-w-2xl text-base leading-8 text-white/78 sm:text-lg md:text-xl">
            Securely distribute and hide sensitive files within images using
            Shamir&apos;s Secret Sharing and neural embedding.
          </p>

          <div className="mt-10 flex w-full flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              className="inline-flex h-14 w-full max-w-[220px] items-center justify-center whitespace-nowrap rounded-full bg-cyan-300 px-8 text-base font-bold leading-none text-slate-950 shadow-[0_0_30px_rgba(0,255,238,0.24)] transition hover:scale-105 hover:bg-white"
              href="/auth/login"
            >
              Enter the Vault
            </Link>
            <Link
              className="inline-flex h-14 w-full max-w-[240px] items-center justify-center whitespace-nowrap rounded-full border border-white/25 bg-white/10 px-8 text-base font-semibold leading-none text-white backdrop-blur-sm transition hover:scale-105 hover:bg-white/20"
              href="/auth/register"
            >
              Register New User
            </Link>
          </div>
        </section>
      </WarpShaderHero>
    </>
  );
}
