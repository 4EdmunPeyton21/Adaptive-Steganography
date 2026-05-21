"use client";

import React, { useEffect, useRef } from "react";

/* ─── Sticky Nav ─────────────────────────────────────────────── */
function Nav() {
  return (
    <nav
      id="hero-nav"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "1.25rem 2rem",
        background: "rgba(15, 23, 42, 0.9)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid #1e293b",
      }}
    >
      {/* Brand */}
      <span style={{
        fontFamily: "inherit",
        fontSize: "1rem",
        fontWeight: 700,
        color: "#f8fafc",
      }}>
        Cuttlefish Vault
      </span>

      {/* Start CTA */}
      <a
        id="nav-start-btn"
        href="/auth/login"
        style={{
          padding: "0.5rem 1.5rem",
          borderRadius: "0.375rem",
          background: "#0ea5e9",
          color: "#ffffff",
          fontWeight: 600,
          fontSize: "0.875rem",
          textDecoration: "none",
          transition: "background 0.2s ease",
          display: "inline-block",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.background = "#0284c7";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.background = "#0ea5e9";
        }}
      >
        Open Vault →
      </a>
    </nav>
  );
}

/* ─── Main HeroPage ──────────────────────────────────────────── */
export default function HeroPage() {
  const lenisRef = useRef<{ destroy: () => void; raf: (t: number) => void } | null>(null);

  /* Lenis smooth scroll */
  useEffect(() => {
    let rafId: number;

    import("lenis").then(({ default: Lenis }) => {
      const lenis = new Lenis({
        duration: 1.4,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: "vertical" as const,
        smoothWheel: true,
      });
      lenisRef.current = lenis;

      function raf(time: number) {
        lenis.raf(time);
        rafId = requestAnimationFrame(raf);
      }
      rafId = requestAnimationFrame(raf);
    });

    return () => {
      cancelAnimationFrame(rafId);
      lenisRef.current?.destroy();
    };
  }, []);

  return (
    <>
      <Nav />
      
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <h1 style={{
          fontSize: "clamp(2.5rem, 8vw, 4.5rem)",
          fontWeight: 800,
          color: "#f8fafc",
          marginBottom: "1.5rem",
          lineHeight: 1.1,
          maxWidth: "800px"
        }}>
          Adaptive Steganography
        </h1>
        
        <p style={{
          fontSize: "clamp(1rem, 2vw, 1.25rem)",
          color: "#94a3b8",
          maxWidth: "600px",
          lineHeight: 1.6,
          marginBottom: "3rem"
        }}>
          Securely distribute and hide your sensitive files within images using Shamir's Secret Sharing and Neural Embedding.
        </p>
        
        <a
          href="/auth/login"
          style={{
            padding: "1rem 2rem",
            borderRadius: "0.5rem",
            background: "#0ea5e9",
            color: "#ffffff",
            fontWeight: 600,
            fontSize: "1.125rem",
            textDecoration: "none",
            transition: "all 0.2s ease",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem"
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = "#0284c7";
            (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-2px)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = "#0ea5e9";
            (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(0)";
          }}
        >
          Enter the Vault
        </a>
      </div>
    </>
  );
}
