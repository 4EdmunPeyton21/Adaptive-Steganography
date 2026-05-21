"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

/* ─── Types ─────────────────────────────────────────────────────── */
interface SecretVaultOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

/* ─── The secret vault password (client-side placeholder) ────────── */
const SECRET_PASSWORD = "stego";

/* ─── Clandestine grid dots (seeded, deterministic) ─────────────── */
function seededValue(seed: number): number {
  const v = Math.sin(seed * 12.9898) * 43758.5453;
  return v - Math.floor(v);
}

const GRID_DOTS = Array.from({ length: 25 }, (_, i) => ({
  id: i,
  top: seededValue(i + 201) * 100,
  left: seededValue(i + 231) * 100,
  size: 1 + seededValue(i + 261) * 2,
  opacity: seededValue(i + 291) > 0.5 ? 0.08 + seededValue(i + 321) * 0.1 : 0,
}));

/* ─── Overlay backdrop ──────────────────────────────────────────── */
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.25 } },
};

const panelVariants = {
  hidden: { scale: 0.88, opacity: 0, y: 16 },
  visible: {
    scale: 1,
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
  exit: {
    scale: 0.9,
    opacity: 0,
    y: 8,
    transition: { duration: 0.22, ease: "easeIn" as const },
  },
};

/* ─── Main component ────────────────────────────────────────────── */
export default function SecretVaultOverlay({ isOpen, onClose }: SecretVaultOverlayProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "error" | "success">("idle");
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Focus input when overlay opens */
  useEffect(() => {
    if (isOpen) {
      setPassword("");
      setStatus("idle");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  /* Escape → close (only if no active sequence) */
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let expectedPassphrase = "stego";
    try {
      const userStr = localStorage.getItem("cuttlefish_user");
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user.passphrase) {
          expectedPassphrase = user.passphrase;
        }
      }
    } catch (err) {}

    if (password === expectedPassphrase) {
      setStatus("success");
      setTimeout(() => {
        onClose();
        router.push("/vault/secret");
      }, 900);
    } else {
      setStatus("error");
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="secret-vault-overlay"
          key="secret-overlay"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(3,3,3,0.82)",
            backdropFilter: "blur(20px)",
          }}
        >
          {/* Ambient grid */}
          <svg
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern id="secret-grid" width="48" height="48" patternUnits="userSpaceOnUse">
                <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#00ffff" strokeWidth="0.3" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#secret-grid)" opacity="0.04" />
          </svg>

          {/* Floating grid dots */}
          {GRID_DOTS.map((d) => (
            <div
              key={d.id}
              style={{
                position: "absolute",
                top: `${d.top}%`,
                left: `${d.left}%`,
                width: d.size,
                height: d.size,
                background: "#00ffff",
                opacity: d.opacity,
                pointerEvents: "none",
              }}
            />
          ))}

          {/* Corner glow */}
          <div style={{
            position: "absolute",
            bottom: "-15%", left: "-5%",
            width: "50vw", height: "50vw",
            background: "radial-gradient(circle, rgba(0,255,255,0.04) 0%, transparent 70%)",
            filter: "blur(40px)",
            pointerEvents: "none",
          }} />
          <div style={{
            position: "absolute",
            top: "-10%", right: "5%",
            width: "40vw", height: "40vw",
            background: "radial-gradient(circle, rgba(120,0,255,0.06) 0%, transparent 70%)",
            filter: "blur(50px)",
            pointerEvents: "none",
          }} />

          {/* Panel */}
          <motion.div
            id="secret-vault-panel"
            key="panel"
            variants={panelVariants}
            initial="hidden"
            animate={shake ? { x: [-8, 8, -6, 6, -3, 3, 0] } : "visible"}
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              width: "min(440px, 92vw)",
              background: "rgba(6,6,10,0.92)",
              border: status === "success"
                ? "1px solid rgba(0,255,160,0.45)"
                : status === "error"
                ? "1px solid rgba(255,80,80,0.35)"
                : "1px solid rgba(0,255,255,0.18)",
              borderRadius: "1.25rem",
              padding: "2.5rem 2rem",
              boxShadow: status === "success"
                ? "0 0 80px rgba(0,255,160,0.12), 0 0 0 1px rgba(0,255,160,0.08)"
                : "0 0 80px rgba(0,255,255,0.1), 0 0 0 1px rgba(0,255,255,0.06)",
              overflow: "hidden",
            }}
          >
            {/* Cyan top border glow */}
            <div style={{
              position: "absolute",
              top: 0, left: "10%", right: "10%",
              height: "1px",
              background: status === "success"
                ? "linear-gradient(to right, transparent, rgba(0,255,160,0.6), transparent)"
                : "linear-gradient(to right, transparent, rgba(0,255,255,0.5), transparent)",
              filter: "blur(1px)",
            }} />

            {/* Header */}
            <div style={{ marginBottom: "2rem" }}>
              <p style={{
                fontFamily: "monospace",
                fontSize: "0.6rem",
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                color: "rgba(0,255,255,0.4)",
                marginBottom: "0.6rem",
              }}>
                ◈ Restricted Access
              </p>
              <h2 style={{
                fontSize: "1.6rem",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: "#ffffff",
                lineHeight: 1.1,
                marginBottom: "0.5rem",
              }}>
                Secret Vault
              </h2>
              <p style={{
                fontSize: "0.82rem",
                color: "rgba(255,255,255,0.35)",
                lineHeight: 1.6,
                fontStyle: "italic",
              }}>
                Enter the passphrase to access clandestine protocols.
              </p>
            </div>

            {/* Form */}
            <form id="secret-vault-form" onSubmit={handleSubmit} noValidate>
              <label
                htmlFor="secret-password-input"
                style={{
                  display: "block",
                  fontFamily: "monospace",
                  fontSize: "0.62rem",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "rgba(0,255,255,0.45)",
                  marginBottom: "0.5rem",
                }}
              >
                Passphrase
              </label>

              <div style={{ position: "relative", marginBottom: "1rem" }}>
                <input
                  ref={inputRef}
                  id="secret-password-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter passphrase…"
                  autoComplete="off"
                  aria-label="Secret vault passphrase"
                  style={{
                    width: "100%",
                    background: "rgba(0,255,255,0.04)",
                    border: status === "error"
                      ? "1px solid rgba(255,80,80,0.5)"
                      : "1px solid rgba(0,255,255,0.18)",
                    borderRadius: "0.65rem",
                    padding: "0.85rem 1rem",
                    fontFamily: "monospace",
                    fontSize: "0.92rem",
                    color: "#ffffff",
                    outline: "none",
                    letterSpacing: "0.12em",
                    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                    boxShadow: status === "error" ? "0 0 20px rgba(255,80,80,0.08)" : "none",
                  }}
                  onFocus={(e) => {
                    if (status !== "error") {
                      e.currentTarget.style.borderColor = "rgba(0,255,255,0.45)";
                      e.currentTarget.style.boxShadow = "0 0 24px rgba(0,255,255,0.1)";
                    }
                  }}
                  onBlur={(e) => {
                    if (status !== "error") {
                      e.currentTarget.style.borderColor = "rgba(0,255,255,0.18)";
                      e.currentTarget.style.boxShadow = "none";
                    }
                  }}
                />
              </div>

              {/* Error / success message */}
              <AnimatePresence>
                {status === "error" && (
                  <motion.p
                    key="error-msg"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    role="alert"
                    style={{
                      fontFamily: "monospace",
                      fontSize: "0.72rem",
                      color: "rgba(255,100,100,0.9)",
                      letterSpacing: "0.08em",
                      marginBottom: "1rem",
                    }}
                  >
                    ✕ Access denied. Incorrect passphrase.
                  </motion.p>
                )}
                {status === "success" && (
                  <motion.p
                    key="success-msg"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    role="status"
                    style={{
                      fontFamily: "monospace",
                      fontSize: "0.72rem",
                      color: "rgba(0,255,160,0.9)",
                      letterSpacing: "0.08em",
                      marginBottom: "1rem",
                    }}
                  >
                    ✓ Identity confirmed. Entering clandestine protocols…
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Buttons */}
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  id="secret-vault-cancel-btn"
                  type="button"
                  onClick={onClose}
                  className="vault-btn-ghost"
                  style={{ flex: 1 }}
                >
                  Abort
                </button>
                <button
                  id="secret-vault-submit-btn"
                  type="submit"
                  className="vault-btn-primary"
                  style={{ flex: 2 }}
                  disabled={status === "success" || password.length === 0}
                >
                  {status === "success" ? "Authenticated" : "Access Vault →"}
                </button>
              </div>

              {/* Hint */}
              <p style={{
                marginTop: "1.5rem",
                textAlign: "center",
                fontFamily: "monospace",
                fontSize: "0.6rem",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.15)",
              }}>
                Shift + Esc + G · Esc to close
              </p>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
