import Link from "next/link";
import { LoginForm, SmokeyBackground } from "@/components/ui/login-form";

export default function LoginPage() {
  return (
    <main className="relative min-h-dvh w-screen overflow-hidden bg-[#050505]">
      <SmokeyBackground
        backdropBlurAmount="sm"
        className="absolute inset-0"
        color="#0a4070"
      />

      <Link
        className="absolute left-5 top-5 z-20 font-mono text-xs uppercase tracking-[0.28em] text-white/40 transition-colors hover:text-white sm:left-6 sm:top-6"
        href="/"
      >
        Back to Cuttlefish
      </Link>

      <div className="relative z-10 flex min-h-dvh w-full items-center justify-center px-4 py-24 sm:px-6">
        <LoginForm />
      </div>
    </main>
  );
}
