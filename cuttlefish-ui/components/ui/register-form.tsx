"use client";

import type { FormEvent, JSX } from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Key, Loader2, Lock, Mail, User } from "lucide-react";

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 48 48">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039L38.802 8.841C34.553 4.806 29.613 2.5 24 2.5C11.983 2.5 2.5 11.983 2.5 24s9.483 21.5 21.5 21.5S45.5 36.017 45.5 24c0-1.538-.135-3.022-.389-4.417z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12.5 24 12.5c3.059 0 5.842 1.154 7.961 3.039l5.839-5.841C34.553 4.806 29.613 2.5 24 2.5C16.318 2.5 9.642 6.723 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 45.5c5.613 0 10.553-2.306 14.802-6.341l-5.839-5.841C30.842 35.846 27.059 38 24 38c-5.039 0-9.345-2.608-11.124-6.481l-6.571 4.819C9.642 41.277 16.318 45.5 24 45.5z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l5.839 5.841C44.196 35.123 45.5 29.837 45.5 24c0-1.538-.135-3.022-.389-4.417z"
      />
    </svg>
  );
}

export function RegisterForm(): JSX.Element {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passphrase, setPassphrase] = useState("");
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
    } catch {
      setErrorMessage("Network error. Is the backend running?");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[430px] space-y-6 rounded-2xl border border-white/20 bg-white/10 px-9 py-8 shadow-2xl backdrop-blur-lg">
      <div className="text-center">
        <h2 className="text-4xl font-bold leading-tight text-white">Create Account</h2>
        <p className="mt-2 text-lg text-gray-200">Register new user</p>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {errorMessage}
        </div>
      )}

      <form className="space-y-5" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-1.5 flex items-center gap-3 text-base text-gray-200">
            <User aria-hidden="true" size={18} strokeWidth={1.7} />
            Username
          </span>
          <input
            autoComplete="username"
            className="block h-9 w-full appearance-none border-0 border-b-2 border-gray-300 bg-transparent px-0 text-base text-white shadow-none outline-none [color-scheme:dark] placeholder:text-white/30 focus:border-blue-500 focus:bg-transparent focus:ring-0"
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Username"
            required
            type="text"
            value={username}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 flex items-center gap-3 text-base text-gray-200">
            <Mail aria-hidden="true" size={18} strokeWidth={1.7} />
            Email Address
          </span>
          <input
            autoComplete="email"
            className="block h-9 w-full appearance-none border-0 border-b-2 border-gray-300 bg-transparent px-0 text-base text-white shadow-none outline-none [color-scheme:dark] placeholder:text-white/30 focus:border-blue-500 focus:bg-transparent focus:ring-0"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email Address"
            required
            type="email"
            value={email}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 flex items-center gap-3 text-base text-gray-200">
            <Lock aria-hidden="true" size={18} strokeWidth={1.7} />
            Password
          </span>
          <input
            autoComplete="new-password"
            className="block h-9 w-full appearance-none border-0 border-b-2 border-gray-300 bg-transparent px-0 text-base text-white shadow-none outline-none [color-scheme:dark] placeholder:text-white/30 focus:border-blue-500 focus:bg-transparent focus:ring-0"
            minLength={6}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            required
            type="password"
            value={password}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 flex items-center gap-3 text-base text-gray-200">
            <Key aria-hidden="true" size={18} strokeWidth={1.7} />
            Passphrase
          </span>
          <input
            autoComplete="off"
            className="block h-9 w-full appearance-none border-0 border-b-2 border-gray-300 bg-transparent px-0 text-base text-white shadow-none outline-none [color-scheme:dark] placeholder:text-white/30 focus:border-blue-500 focus:bg-transparent focus:ring-0"
            onChange={(event) => setPassphrase(event.target.value)}
            placeholder="Passphrase"
            required
            type="password"
            value={passphrase}
          />
        </label>

        <button
          className="group flex h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-lg font-semibold text-white transition-all duration-300 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:cursor-wait disabled:opacity-75"
          disabled={loading}
          type="submit"
        >
          {loading ? (
            <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
          ) : (
            <>
              Sign Up
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </button>

        <div className="relative flex items-center py-1">
          <div className="flex-grow border-t border-gray-400/30" />
          <span className="mx-4 flex-shrink text-xs text-gray-400">
            OR CONTINUE WITH
          </span>
          <div className="flex-grow border-t border-gray-400/30" />
        </div>

        <button
          className="flex h-11 w-full items-center justify-center rounded-xl bg-white/90 px-4 font-semibold text-gray-700 transition-all duration-300 hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
          type="button"
        >
          <span className="mr-2">
            <GoogleIcon />
          </span>
          Sign up with Google
        </button>
      </form>

      <p className="text-center text-xs text-gray-400">
        Already have an account?{" "}
        <Link
          className="font-semibold text-blue-400 transition hover:text-blue-300"
          href="/auth/login"
        >
          Sign In
        </Link>
      </p>
    </div>
  );
}
