"use client";

import React, { useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";

/* ─── Types ──────────────────────────────────────────────────── */
interface SectionData {
  id: string;
  word: string;
  pos: string;          // part of speech
  phonetic: string;
  definition: string;
  example: string;
  wordColor: string;
  accentColor: string;
  overlay?: React.ReactNode;
}

/* ─── Section content ────────────────────────────────────────── */
const SECTIONS: SectionData[] = [
  {
    id: "ephemeral",
    word: "Ephemeral",
    pos: "adjective",
    phonetic: "/ɪˈfem(ə)r(ə)l/",
    definition:
      "Lasting or existing for a very short time; transitory; characterised by rapid change or decay. (of living organisms) having a very short life cycle.",
    example: "Fashion is ephemeral — here today, gone tomorrow.",
    wordColor: "#00ffe0",
    accentColor: "#00ffe0",
    overlay: <EphemeralOverlay />,
  },
  {
    id: "spectral",
    word: "Spectral",
    pos: "adjective",
    phonetic: "/ˈspektr(ə)l/",
    definition:
      "Of or relating to a spectrum or the spectra of substances; of or relating to ghosts or phantoms; ghostly in appearance or nature.",
    example:
      "A spectral light drifted through the fog, neither real nor imagined.",
    wordColor: "#22e8ff",
    accentColor: "#a855f7",
    overlay: <SpectralOverlay />,
  },
  {
    id: "clandestine",
    word: "Clandestine",
    pos: "adjective",
    phonetic: "/klanˈdestɪn/",
    definition:
      "Kept secret or done secretively, especially because it is forbidden or disreputable; operating in a stealthy or surreptitious manner.",
    example:
      "They arranged clandestine meetings in the basement, away from prying eyes.",
    wordColor: "#ffffff",
    accentColor: "#00ffff",
    overlay: <ClandestineOverlay />,
  },
];

const seededValue = (seed: number) => {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
};

/* ─── Ephemeral overlay — soft drifting particles ────────────── */
function EphemeralOverlay() {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    size:  2 + seededValue(i + 1) * 3,
    left:  5 + seededValue(i + 21) * 90,
    bottom: seededValue(i + 41) * 70,
    duration: 5 + seededValue(i + 61) * 7,
    delay: seededValue(i + 81) * 6,
    opacity: 0.35 + seededValue(i + 101) * 0.55,
    color: `rgba(0,${180 + Math.floor(seededValue(i + 121) * 75)},${200 + Math.floor(seededValue(i + 141) * 55)}, 1)`,
  }));

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {particles.map((p) => (
        <span
          key={p.id}
          className="particle"
          style={{
            width:  p.size,
            height: p.size,
            left:   `${p.left}%`,
            bottom: `${p.bottom}%`,
            background: p.color,
            opacity: p.opacity,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ─── Spectral overlay — pulsing glowing orbs ───────────────── */
function SpectralOverlay() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {/* Large purple orb */}
      <div className="orb" style={{
        position: "absolute", top: "10%", left: "15%",
        width: "42vw", height: "42vw", maxWidth: 520, maxHeight: 520,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(120,0,255,0.25) 0%, transparent 70%)",
        filter: "blur(40px)",
        animationDuration: "7s", animationDelay: "0s",
      }} />
      {/* Teal orb */}
      <div className="orb" style={{
        position: "absolute", bottom: "5%", right: "8%",
        width: "35vw", height: "35vw", maxWidth: 440, maxHeight: 440,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(0,200,200,0.2) 0%, transparent 70%)",
        filter: "blur(50px)",
        animationDuration: "9s", animationDelay: "2.5s",
      }} />
      {/* Small violet top-right */}
      <div className="orb" style={{
        position: "absolute", top: "-8%", right: "20%",
        width: "25vw", height: "25vw", maxWidth: 300, maxHeight: 300,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(80,0,180,0.2) 0%, transparent 70%)",
        filter: "blur(60px)",
        animationDuration: "11s", animationDelay: "4s",
      }} />
    </div>
  );
}

/* ─── Clandestine overlay — flickering digital grid ─────────── */
function ClandestineOverlay() {
  const dots = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    top:  seededValue(i + 201) * 100,
    left: seededValue(i + 231) * 100,
    size: 1 + seededValue(i + 261) * 2,
    opacity: seededValue(i + 291) > 0.5 ? 0.15 + seededValue(i + 321) * 0.2 : 0,
  }));

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {/* SVG grid */}
      <svg
        className="clandestine-grid"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="cland-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#00ffff" strokeWidth="0.4" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#cland-grid)" />
      </svg>

      {/* Artifact dots */}
      {dots.map((d) => (
        <div key={d.id} style={{
          position: "absolute",
          top:  `${d.top}%`,
          left: `${d.left}%`,
          width:  d.size,
          height: d.size,
          background: "#00ffff",
          opacity: d.opacity,
        }} />
      ))}

      {/* Dim corner glow */}
      <div style={{
        position: "absolute", bottom: "-15%", left: "-5%",
        width: "55vw", height: "55vw",
        background: "radial-gradient(circle, rgba(0,255,255,0.05) 0%, transparent 65%)",
        filter: "blur(40px)",
      }} />
    </div>
  );
}

/* ─── Zoom animation variants ────────────────────────────────── */
const WORD_ANIM = {
  initial:   { scale: 0,   opacity: 0 },
  animate:   { scale: 1,   opacity: 1,
    transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

const DEF_ANIM = {
  initial:   { opacity: 0, y: 24 },
  animate:   { opacity: 1, y: 0,
    transition: { duration: 0.7, delay: 0.5, ease: "easeOut" as const },
  },
};

const EXAMPLE_ANIM = {
  initial:   { opacity: 0 },
  animate:   { opacity: 1,
    transition: { duration: 0.6, delay: 0.85, ease: "easeOut" as const },
  },
};

/* ─── Single section ─────────────────────────────────────────── */
function Section({ section }: { section: SectionData }) {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { amount: 0.5, once: false });

  const { id, word, pos, phonetic, definition, example,
          wordColor, accentColor, overlay } = section;

  return (
    <section
      id={id}
      ref={ref}
      style={{
        position: "relative",
        width: "100%",
        height: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
      aria-label={`${word} section`}
    >
      {/* Section-specific decorative overlay */}
      {overlay}

      {/* Content */}
      <div style={{
        position: "relative",
        zIndex: 10,
        textAlign: "center",
        padding: "2rem",
        maxWidth: "800px",
        width: "100%",
      }}>
        {/* Oxford-style phonetic + POS */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.75rem",
            marginBottom: "1rem",
          }}
        >
          <span style={{
            fontFamily: "monospace",
            fontSize: "clamp(0.8rem, 2vw, 1rem)",
            color: `${accentColor}88`,
            letterSpacing: "0.05em",
          }}>
            {phonetic}
          </span>
          <span style={{
            fontFamily: "monospace",
            fontSize: "0.7rem",
            color: "rgba(255,255,255,0.25)",
            textTransform: "uppercase",
            letterSpacing: "0.2em",
            fontStyle: "italic",
          }}>
            {pos}
          </span>
        </motion.div>

        {/* ── WORD — zoom in ── */}
        <motion.h2
          initial={WORD_ANIM.initial}
          animate={isInView ? WORD_ANIM.animate : WORD_ANIM.initial}
          style={{
            fontSize: "clamp(3.5rem, 13vw, 9.5rem)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1,
            color: wordColor,
            textShadow: `0 0 60px ${wordColor}44, 0 0 140px ${wordColor}18`,
            margin: 0,
            willChange: "transform, opacity",
          }}
        >
          {word}
        </motion.h2>

        {/* ── Definition ── */}
        <motion.p
          initial={DEF_ANIM.initial}
          animate={isInView ? DEF_ANIM.animate : DEF_ANIM.initial}
          style={{
            marginTop: "1.75rem",
            fontSize: "clamp(0.95rem, 2vw, 1.2rem)",
            color: "rgba(255,255,255,0.65)",
            maxWidth: "580px",
            margin: "1.75rem auto 0",
            lineHeight: 1.7,
            fontStyle: "italic",
          }}
        >
          {definition}
        </motion.p>

        {/* ── Example usage ── */}
        <motion.p
          initial={EXAMPLE_ANIM.initial}
          animate={isInView ? EXAMPLE_ANIM.animate : EXAMPLE_ANIM.initial}
          style={{
            marginTop: "1.25rem",
            fontSize: "clamp(0.8rem, 1.5vw, 0.95rem)",
            color: `${accentColor}55`,
            fontFamily: "monospace",
            letterSpacing: "0.04em",
          }}
        >
          &ldquo;{example}&rdquo;
        </motion.p>

        {/* Scroll hint on first section */}
        {id === "ephemeral" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ delay: 1.4, duration: 0.8 }}
            style={{
              marginTop: "3rem",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.35rem",
              color: "rgba(255,255,255,0.2)",
              fontSize: "0.65rem",
              letterSpacing: "0.3em",
              textTransform: "uppercase",
            }}
          >
            <span>Scroll</span>
            <motion.span
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              style={{ fontSize: "1rem" }}
            >
              ↓
            </motion.span>
          </motion.div>
        )}
      </div>
    </section>
  );
}

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
        background: "rgba(5,5,5,0)",
        backdropFilter: "blur(0px)",
      }}
    >
      {/* Brand */}
      <span style={{
        fontFamily: "monospace",
        fontSize: "0.8rem",
        letterSpacing: "0.35em",
        textTransform: "uppercase",
        color: "rgba(0,255,238,0.45)",
      }}>
        Cuttlefish
      </span>

      {/* Start CTA */}
      <a
        id="nav-start-btn"
        href="/auth/login"
        style={{
          padding: "0.5rem 1.5rem",
          borderRadius: "9999px",
          background: "#00ffee",
          color: "#050505",
          fontWeight: 700,
          fontSize: "0.8rem",
          letterSpacing: "0.06em",
          textDecoration: "none",
          boxShadow: "0 0 22px rgba(0,255,238,0.35)",
          transition: "box-shadow 0.2s ease, transform 0.2s ease",
          display: "inline-block",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 0 40px rgba(0,255,238,0.6)";
          (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-1px)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 0 22px rgba(0,255,238,0.35)";
          (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(0)";
        }}
      >
        Start →
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

      {/*
       * CONTINUOUS GRADIENT CONTAINER
       * One tall div (300dvh) whose gradient flows across all 3 sections.
       * Sections sit transparently on top — the gradient is the background.
       *
       * Gradient stops:
       *   0%   — deep navy          (Ephemeral start)
       *   28%  — cyan-navy          (Ephemeral → Spectral transition)
       *   38%  — dark purple        (Spectral start)
       *   62%  — dark teal          (Spectral end)
       *   70%  — charcoal           (Clandestine start)
       *  100%  — near black         (Clandestine end)
       */}
      <div
        id="hero-gradient-container"
        style={{
          minHeight: "300dvh",
          background: `linear-gradient(
            to bottom,
            #020b18   0%,
            #041c30  15%,
            #063d50  28%,
            #0a001e  38%,
            #120030  46%,
            #001a1a  56%,
            #001f1f  62%,
            #080808  70%,
            #050505  82%,
            #030303 100%
          )`,
          position: "relative",
        }}
      >
        {SECTIONS.map((section) => (
          <Section key={section.id} section={section} />
        ))}
      </div>
    </>
  );
}
