"use client";

import type { FormEvent, JSX } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  ShieldCheck,
  User,
  Key
} from "lucide-react";

export function RegisterForm(): JSX.Element {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("http://localhost:8000/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password, passphrase }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setErrorMessage(data.detail || "Registration failed");
        setLoading(false);
        return;
      }
      
      localStorage.setItem("cuttlefish_token", data.token);
      localStorage.setItem("cuttlefish_user", JSON.stringify(data));
      router.push("/vault");
    } catch (error) {
      setErrorMessage("Network error. Is the backend running?");
      setLoading(false);
    }
  };

  return (
    <section className="w-full max-w-[440px] rounded-3xl border border-slate-700/60 bg-slate-800/80 p-8 shadow-2xl backdrop-blur-xl sm:p-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-500">
          <ShieldCheck aria-hidden="true" size={28} />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-white">
          Create Account
        </h1>
        <p className="mt-2.5 text-base text-slate-400">
          Join Cuttlefish and set up your vault.
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        {errorMessage && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {errorMessage}
          </div>
        )}
        
        <label className="block">
          <span className="mb-2.5 flex items-center gap-2.5 text-sm font-medium text-slate-300">
            <User aria-hidden="true" size={18} />
            Username
          </span>
          <input
            autoComplete="username"
            className="h-12 w-full rounded-xl border border-slate-600/60 bg-slate-700/30 px-5 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-sky-500 focus:bg-slate-700/50 focus:ring-4 focus:ring-sky-500/20"
            onChange={(event) => setUsername(event.target.value)}
            placeholder="johndoe"
            required
            type="text"
            value={username}
          />
        </label>

        <label className="block">
          <span className="mb-2.5 flex items-center gap-2.5 text-sm font-medium text-slate-300">
            <User aria-hidden="true" size={18} />
            Email address
          </span>
          <input
            autoComplete="email"
            className="h-12 w-full rounded-xl border border-slate-600/60 bg-slate-700/30 px-5 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-sky-500 focus:bg-slate-700/50 focus:ring-4 focus:ring-sky-500/20"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            type="email"
            value={email}
          />
        </label>

        <label className="block">
          <span className="mb-2.5 flex items-center gap-2.5 text-sm font-medium text-slate-300">
            <Lock aria-hidden="true" size={18} />
            Password
          </span>
          <span className="relative block">
            <input
              autoComplete="new-password"
              className="h-12 w-full rounded-xl border border-slate-600/60 bg-slate-700/30 px-5 pr-12 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-sky-500 focus:bg-slate-700/50 focus:ring-4 focus:ring-sky-500/20"
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Create a password"
              required
              type={showPassword ? "text" : "password"}
              value={password}
            />
            <button
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              onClick={() => setShowPassword((value) => !value)}
              type="button"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>
        
        <label className="block">
          <span className="mb-2.5 flex items-center gap-2.5 text-sm font-medium text-slate-300">
            <Key aria-hidden="true" size={18} />
            Passphrase
          </span>
          <span className="relative block">
            <input
              className="h-12 w-full rounded-xl border border-slate-600/60 bg-slate-700/30 px-5 pr-12 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-sky-500 focus:bg-slate-700/50 focus:ring-4 focus:ring-sky-500/20"
              onChange={(event) => setPassphrase(event.target.value)}
              placeholder="Your unique steganography passphrase"
              required
              type={showPassphrase ? "text" : "password"}
              value={passphrase}
            />
            <button
              aria-label={showPassphrase ? "Hide passphrase" : "Show passphrase"}
              className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              onClick={() => setShowPassphrase((value) => !value)}
              type="button"
            >
              {showPassphrase ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>

        <button
          className="group mt-8 flex h-12 w-full items-center justify-center rounded-xl bg-sky-500 px-4 text-base font-semibold text-white transition hover:bg-sky-400 focus:outline-none focus:ring-4 focus:ring-sky-500/25 disabled:cursor-wait disabled:opacity-70"
          disabled={loading}
          id="register-submit-btn"
          type="submit"
        >
          {loading ? (
            <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
          ) : (
            <>
              Sign up
              <ArrowRight
                aria-hidden="true"
                className="ml-2 h-5 w-5 transition group-hover:translate-x-1"
              />
            </>
          )}
        </button>
      </form>

      <div className="my-8 flex items-center gap-4">
        <div className="h-px flex-1 bg-slate-700/60" />
      </div>

      <p className="text-center text-base text-slate-400">
        Already have an account?{" "}
        <Link className="font-semibold text-sky-400 transition hover:text-sky-300" href="/auth/login">
          Sign in
        </Link>
      </p>
    </section>
  );
}
