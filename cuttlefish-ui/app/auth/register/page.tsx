import Link from "next/link";
import { RegisterForm } from "@/components/ui/register-form";

export default function RegisterPage() {
  return (
    <main className="relative min-h-dvh w-screen overflow-hidden bg-slate-900">
      <Link
        className="absolute left-5 top-5 z-20 font-sans text-sm font-semibold text-slate-400 transition-colors hover:text-white sm:left-6 sm:top-6"
        href="/"
      >
        ← Back to Vault
      </Link>

      <div className="relative z-10 flex min-h-dvh w-full items-center justify-center px-4 py-24 sm:px-6">
        <RegisterForm />
      </div>
    </main>
  );
}
