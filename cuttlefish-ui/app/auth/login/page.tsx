import { LoginForm } from "@/components/ui/login-form";
import { SmokeyBackground } from "@/components/ui/smokey-background";

export default function LoginPage() {
  return (
    <main className="relative min-h-dvh w-screen overflow-hidden bg-black">
      <SmokeyBackground className="absolute inset-0" />
      <div className="relative z-10 flex min-h-dvh w-full items-center justify-center px-4 py-10">
        <LoginForm />
      </div>
    </main>
  );
}
