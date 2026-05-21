import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cuttlefish — Ephemeral. Spectral. Clandestine.",
  description:
    "A neural steganography vault. Your secrets, hidden in plain sight.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
