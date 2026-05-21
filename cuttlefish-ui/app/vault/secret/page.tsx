import type { Metadata } from "next";
import SecretVaultClient from "@/components/SecretVaultClient";

export const metadata: Metadata = {
  title: "Clandestine Protocols · Cuttlefish",
  description: "Restricted access — clandestine steganographic protocols.",
};

export default function SecretVaultPage() {
  return <SecretVaultClient />;
}
