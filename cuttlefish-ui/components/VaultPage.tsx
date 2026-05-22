"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, Maximize2, Trash2, UploadCloud, X, RefreshCw } from "lucide-react";
import { WarpShaderBackground } from "@/components/ui/wrap-shader";
import SecretVaultOverlay from "./SecretVaultOverlay";

/* ─── Types ─────────────────────────────────────────────────────── */
interface Photo {
  id: string;
  src: string;
  name: string;
  size: string;
  uploadedAt: string;
  width: number;
  height: number;
}

interface UploadState {
  status: "idle" | "dragging" | "uploading" | "success" | "error";
  progress: number;
  message: string;
}

interface MemoryApiPhoto extends Photo {
  src: string;
}

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_SIZE_MB = 20;

const getStoredUsername = () => {
  if (typeof window === "undefined") return "user";
  try {
    const userStr = localStorage.getItem("cuttlefish_user");
    if (!userStr) return "user";
    const user = JSON.parse(userStr) as { username?: string };
    return user.username || "user";
  } catch {
    return "user";
  }
};

/* ─── Lightbox ──────────────────────────────────────────────────── */
function Lightbox({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        id="lightbox-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 300,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.92)", backdropFilter: "blur(8px)",
          cursor: "zoom-out",
        }}
      >
        <motion.div
          initial={{ scale: 0.93, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.93, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "relative", maxHeight: "90vh", maxWidth: "90vw",
            borderRadius: "16px", overflow: "hidden",
            boxShadow: "0 0 60px rgba(0,255,255,0.2)",
            cursor: "default",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.src} alt={photo.name}
            style={{ display: "block", maxHeight: "85vh", maxWidth: "90vw", objectFit: "contain", background: "#111" }} />
          <div style={{
            position: "absolute", inset: "auto 0 0 0",
            background: "linear-gradient(to top, rgba(0,0,0,0.9), transparent)",
            padding: "1.5rem 1.5rem 1rem",
          }}>
            <p style={{ fontFamily: "monospace", fontSize: "0.85rem", color: "#00FFFF", marginBottom: "0.25rem" }}>{photo.name}</p>
            <p style={{ fontSize: "0.75rem", color: "#AAAAAA" }}>{photo.size} · {photo.uploadedAt}</p>
          </div>
          <button onClick={onClose} aria-label="Close lightbox"
            style={{
              position: "absolute", top: "1rem", right: "1rem",
              background: "rgba(0,0,0,0.6)", border: "none",
              borderRadius: "50%", width: "36px", height: "36px",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", cursor: "pointer",
            }}>
            <X size={18} />
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ─── Delete confirm modal ──────────────────────────────────────── */
function DeleteConfirmModal({ photo, onConfirm, onCancel }: {
  photo: Photo; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{
          position: "fixed", inset: 0, zIndex: 350,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)",
        }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          style={{
            width: "min(400px, 90vw)", background: "#111111",
            borderRadius: "20px", padding: "2rem",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
          }}
        >
          <p style={{ fontSize: "1.1rem", fontWeight: 600, color: "#fff", marginBottom: "0.75rem" }}>Delete Memory?</p>
          <p style={{ fontSize: "0.875rem", color: "#AAAAAA", marginBottom: "1.75rem", lineHeight: 1.6 }}>
            Permanently remove <span style={{ color: "#00FFFF" }}>{photo.name}</span>? This cannot be undone.
          </p>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button id="delete-cancel-btn" onClick={onCancel} style={{
              flex: 1, padding: "0.65rem", borderRadius: "10px",
              background: "transparent", border: "1px solid rgba(255,255,255,0.15)",
              color: "#fff", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer",
            }}>Cancel</button>
            <button id="delete-confirm-btn" onClick={onConfirm} style={{
              flex: 1, padding: "0.65rem", borderRadius: "10px",
              background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
              color: "#f87171", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer",
            }}>Delete</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ─── Photo card ────────────────────────────────────────────────── */
function PhotoCard({ photo, index, onView, onDelete }: {
  photo: Photo; index: number; onView: () => void; onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.45, delay: index * 0.06 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        width: "256px",
        height: "256px",
        flexShrink: 0,
        borderRadius: "14px",
        overflow: "hidden",
        background: "rgba(10,10,20,0.55)",
        backdropFilter: "blur(4px)",
        cursor: "pointer",
        border: hovered ? "1px solid rgba(0,255,255,0.5)" : "1px solid rgba(255,255,255,0.12)",
        boxShadow: hovered ? "0 0 28px rgba(0,255,255,0.25), 0 8px 32px rgba(0,0,0,0.3)" : "0 4px 20px rgba(0,0,0,0.3)",
        transform: hovered ? "scale(1.04)" : "scale(1)",
        transition: "transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.src}
        alt={photo.name}
        onClick={onView}
        style={{
          width: "100%", height: "100%",
          objectFit: "cover", display: "block",
          opacity: hovered ? 0.7 : 1,
          transition: "opacity 0.3s ease",
        }}
      />

      {/* Gradient overlay */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to top, rgba(5,5,20,0.9) 0%, transparent 50%)",
        opacity: hovered ? 1 : 0,
        transition: "opacity 0.3s ease",
      }} />

      {/* File info */}
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0,
        padding: "0.75rem 1rem",
        opacity: hovered ? 1 : 0,
        transform: hovered ? "translateY(0)" : "translateY(8px)",
        transition: "opacity 0.25s ease, transform 0.25s ease",
        pointerEvents: "none",
      }}>
        <p style={{ fontSize: "0.78rem", fontWeight: 500, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{photo.name}</p>
        <p style={{ fontSize: "0.68rem", color: "#00FFFF", marginTop: "0.15rem" }}>{photo.size}</p>
      </div>

      {/* Action buttons */}
      <div style={{
        position: "absolute", top: "0.6rem", right: "0.6rem",
        display: "flex", gap: "0.4rem",
        opacity: hovered ? 1 : 0,
        transition: "opacity 0.25s ease",
      }}>
        <button
          id={`view-btn-${photo.id}`}
          onClick={(e) => { e.stopPropagation(); onView(); }}
          aria-label={`View ${photo.name}`}
          style={{
            width: "32px", height: "32px", borderRadius: "50%",
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
            border: "1px solid rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", cursor: "pointer",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#00FFFF"; (e.currentTarget as HTMLButtonElement).style.color = "#000"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.6)"; (e.currentTarget as HTMLButtonElement).style.color = "#fff"; }}
        >
          <Maximize2 size={13} />
        </button>
        <button
          id={`delete-btn-${photo.id}`}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          aria-label={`Delete ${photo.name}`}
          style={{
            width: "32px", height: "32px", borderRadius: "50%",
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
            border: "1px solid rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", cursor: "pointer",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#ef4444"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.6)"; }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </motion.div>
  );
}

/* ─── Upload Zone ───────────────────────────────────────────────── */
function UploadZone({ onUpload }: { onUpload: (photos: Photo[]) => void }) {
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle", progress: 0, message: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const performUpload = useCallback(async (files: File[]) => {
    const invalid = files.filter((f) => !ACCEPTED_IMAGE_TYPES.includes(f.type));
    const tooBig = files.filter((f) => f.size > MAX_IMAGE_SIZE_MB * 1024 * 1024);

    if (invalid.length > 0) {
      setUploadState({ status: "error", progress: 0, message: "Unsupported format" });
      setTimeout(() => setUploadState({ status: "idle", progress: 0, message: "" }), 3500);
      return;
    }
    if (tooBig.length > 0) {
      setUploadState({ status: "error", progress: 0, message: `File exceeds ${MAX_IMAGE_SIZE_MB}MB` });
      setTimeout(() => setUploadState({ status: "idle", progress: 0, message: "" }), 3500);
      return;
    }

    setUploadState({ status: "uploading", progress: 20, message: "Embedding memory…" });
    const token = localStorage.getItem("cuttlefish_token");
    const newPhotos: Photo[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch("http://localhost:8000/api/v1/shatter", {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` },
          body: formData,
        });
        if (!res.ok) throw new Error("Upload failed");
        const data = await res.json();
        newPhotos.push({
          id: data.ghost_map_id,
          src: URL.createObjectURL(file),
          name: data.file_name,
          size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
          uploadedAt: new Date().toISOString().split("T")[0],
          width: 600, height: 400,
        });
        setUploadState(s => ({ ...s, progress: 20 + Math.round(((i + 1) / files.length) * 80) }));
      } catch {
        setUploadState({ status: "error", progress: 0, message: `Failed to upload ${file.name}` });
        setTimeout(() => setUploadState({ status: "idle", progress: 0, message: "" }), 3500);
        return;
      }
    }

    onUpload(newPhotos);
    setUploadState({ status: "success", progress: 100, message: "Memory securely embedded." });
    setTimeout(() => setUploadState({ status: "idle", progress: 0, message: "" }), 3000);
  }, [onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setUploadState((s) => ({ ...s, status: "idle" }));
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    if (files.length) performUpload(files);
  }, [performUpload]);

  const isDragging = uploadState.status === "dragging";
  const isUploading = uploadState.status === "uploading";
  const isSuccess = uploadState.status === "success";
  const isError = uploadState.status === "error";

  return (
    <div style={{ marginTop: "3rem" }}>
      <div
        id="upload-drop-zone"
        onDragOver={(e) => { e.preventDefault(); setUploadState((s) => ({ ...s, status: "dragging" })); }}
        onDragLeave={() => setUploadState((s) => ({ ...s, status: "idle" }))}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "4rem 2rem",
          borderRadius: "20px",
          border: isDragging ? "2px dashed #00FFFF" : isSuccess ? "2px dashed rgba(52,211,153,0.6)" : isError ? "2px dashed rgba(239,68,68,0.6)" : "2px dashed rgba(255,255,255,0.12)",
          background: isDragging ? "rgba(0,255,255,0.04)" : "rgba(255,255,255,0.02)",
          cursor: isUploading ? "wait" : "pointer",
          transition: "border-color 0.25s, background 0.25s",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Progress bar */}
        {isUploading && (
          <div style={{
            position: "absolute", bottom: 0, left: 0,
            height: "2px", background: "#00FFFF",
            boxShadow: "0 0 12px rgba(0,255,255,0.6)",
            width: `${uploadState.progress}%`,
            transition: "width 0.3s ease",
          }} />
        )}

        {/* Upload icon */}
        <div style={{
          width: "60px", height: "60px", borderRadius: "50%",
          background: isDragging ? "rgba(0,255,255,0.15)" : "rgba(0,255,255,0.07)",
          border: "1px solid rgba(0,255,255,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#00FFFF", marginBottom: "1.25rem",
          transition: "background 0.2s",
        }}>
          {isSuccess
            ? <span style={{ fontSize: "1.5rem" }}>✓</span>
            : isError
            ? <span style={{ fontSize: "1.5rem" }}>!</span>
            : <UploadCloud size={26} />}
        </div>

        <p style={{
          fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.22em",
          textTransform: "uppercase", color: isSuccess ? "#34d399" : isError ? "#f87171" : "#fff",
          marginBottom: "0.5rem",
        }}>
          {isUploading ? uploadState.message : isSuccess ? uploadState.message : isError ? uploadState.message : isDragging ? "Release to upload" : "Drop Images Here"}
        </p>

        {!isUploading && !isSuccess && !isError && (
          <p style={{ fontSize: "0.82rem", color: "#AAAAAA" }}>
            or click to browse your files
          </p>
        )}

        {!isUploading && !isSuccess && !isError && (
          <p style={{ marginTop: "1rem", fontSize: "0.72rem", color: "rgba(170,170,170,0.4)" }}>
            .jpg, .png, .webp, .gif — max {MAX_IMAGE_SIZE_MB} MB
          </p>
        )}

        {isUploading && (
          <p style={{ marginTop: "0.75rem", fontFamily: "monospace", fontSize: "0.72rem", color: "rgba(0,255,255,0.5)" }}>
            {uploadState.progress}%
          </p>
        )}
      </div>

      <input
        ref={fileInputRef}
        id="file-upload-input"
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) performUpload(files);
          e.target.value = "";
        }}
        style={{ display: "none" }}
        aria-label="Upload image files"
      />
    </div>
  );
}

/* ─── Header ─────────────────────────────────────────────────────── */
function VaultHeader({ onRefresh, isRefreshing }: { onRefresh: () => void; isRefreshing: boolean }) {
  const [username, setUsername] = useState("user");

  useEffect(() => {
    setUsername(getStoredUsername());
  }, []);

  return (
    <header style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      height: "64px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 2rem",
      background: "rgba(5,5,5,0.7)",
      backdropFilter: "blur(12px)",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
    }}>
      <Link href="/" style={{
        fontFamily: "monospace", fontSize: "0.85rem", fontWeight: 700,
        letterSpacing: "0.3em", textTransform: "uppercase",
        color: "#fff", textDecoration: "none",
      }}>
        Cuttlefish
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        {/* Refresh button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Sync from server"
          style={{
            display: "flex", alignItems: "center", gap: "0.4rem",
            padding: "0.35rem 0.75rem", borderRadius: "8px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: isRefreshing ? "rgba(0,255,255,0.5)" : "rgba(255,255,255,0.45)",
            fontSize: "0.78rem", cursor: isRefreshing ? "wait" : "pointer",
          }}
        >
          <RefreshCw size={13} style={{ animation: isRefreshing ? "spin 0.9s linear infinite" : "none" }} />
          {isRefreshing ? "Syncing…" : "Refresh"}
        </button>

        <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.12)" }} />

        <div style={{
          width: "36px", height: "36px", borderRadius: "50%",
          background: "#00FFFF",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "0.85rem", fontWeight: 700, color: "#050505",
        }}>
          {username.charAt(0).toUpperCase()}
        </div>

        <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.12)" }} />

        <a href="/auth/login" style={{
          display: "flex", alignItems: "center", gap: "0.5rem",
          fontSize: "0.85rem", color: "#AAAAAA", textDecoration: "none",
        }}>
          <LogOut size={15} />
          <span>Logout</span>
        </a>
      </div>
    </header>
  );
}

/* ─── Main VaultPage component ──────────────────────────────────── */
export default function VaultPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Photo | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("cuttlefish_token");
    if (!token) {
      window.location.href = "/auth/login";
      return;
    }

    async function fetchMemories() {
      try {
        const res = await fetch("http://localhost:8000/api/v1/vault/memories", {
          headers: { "Authorization": `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to fetch memories");
        const data = (await res.json()) as MemoryApiPhoto[];

        const photosWithBlobs = await Promise.all(data.map(async (p) => {
          try {
            const imgRes = await fetch(`http://localhost:8000${p.src}`, {
              headers: { "Authorization": `Bearer ${token}` },
            });
            if (!imgRes.ok) throw new Error();
            const blob = await imgRes.blob();
            return { ...p, src: URL.createObjectURL(blob) };
          } catch {
            return p;
          }
        }));

        setPhotos(photosWithBlobs);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchMemories();
  }, []);

  /* Keyboard shortcut: Shift + Esc + G → secret overlay */
  useEffect(() => {
    const pressed = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      pressed.add(key);
      if (e.shiftKey && pressed.has("escape") && key === "g") {
        e.preventDefault();
        setShowOverlay(true);
        pressed.clear();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => pressed.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const handleUpload = useCallback((newPhotos: Photo[]) => {
    setPhotos((prev) => [...newPhotos, ...prev]);
  }, []);

  // Re-fetch all memories from the server (always reflects true DB state)
  const refreshMemories = useCallback(async () => {
    const token = localStorage.getItem("cuttlefish_token");
    if (!token) return;
    setIsRefreshing(true);
    try {
      const res = await fetch("http://localhost:8000/api/v1/vault/memories", {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as MemoryApiPhoto[];
      const photosWithBlobs = await Promise.all(data.map(async (p) => {
        try {
          const imgRes = await fetch(`http://localhost:8000${p.src}`, {
            headers: { "Authorization": `Bearer ${token}` },
          });
          if (!imgRes.ok) throw new Error();
          const blob = await imgRes.blob();
          return { ...p, src: URL.createObjectURL(blob) };
        } catch {
          return p;
        }
      }));
      setPhotos(photosWithBlobs);
    } catch (err) {
      console.error("Refresh failed:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Delete: call API first, then re-fetch from server to confirm
  const handleDelete = useCallback(async (photo: Photo) => {
    const token = localStorage.getItem("cuttlefish_token");
    setDeleteTarget(null);
    try {
      const res = await fetch(
        `http://localhost:8000/api/v1/vault/memories/${photo.id}`,
        {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${token}` },
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("Delete failed:", res.status, err);
        alert(`Failed to delete: ${res.status}`);
      }
    } catch (err) {
      console.error("Delete network error:", err);
      alert("Network error while deleting.");
    } finally {
      // Always re-fetch so the UI reflects true DB state
      await refreshMemories();
    }
  }, [refreshMemories]);

  return (
    <>
      {/* Global page styles */}
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #050505; }
        .smokey-bg-wrapper { position: fixed; inset: 0; z-index: 0; }
        .vault-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 1.25rem;
        }
        .vault-grid > * {
          flex: 0 0 256px;
        }
        @media (max-width: 600px) {
          .vault-grid > * { flex: 0 0 calc(50% - 0.625rem); }
        }
        @media (max-width: 380px) {
          .vault-grid > * { flex: 0 0 100%; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#050505", color: "#fff", position: "relative" }}>
        {/* Animated warp shader background — same as hero page */}
        <div className="smokey-bg-wrapper">
          <WarpShaderBackground />
          {/* Lighter overlay — just enough to keep text readable */}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to bottom, rgba(5,5,15,0.30) 0%, rgba(5,5,15,0.45) 100%)",
          }} />
        </div>

        <VaultHeader onRefresh={refreshMemories} isRefreshing={isRefreshing} />

        <main style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "104px 2rem 6rem",
          position: "relative",
          zIndex: 10,
        }}>

          {/* Page title */}
          <div style={{ marginBottom: "2.5rem" }}>
            <h1 style={{
              fontSize: "clamp(2.25rem, 5vw, 3rem)",
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              marginBottom: "0.5rem",
            }}>
              Memory Vault
            </h1>
            <p style={{ fontSize: "0.9rem", color: "#AAAAAA" }}>
              Your private image collection
            </p>
          </div>

          {/* Stats bar */}
          {!isLoading && photos.length > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: "1rem",
              marginBottom: "1.75rem",
            }}>
              <span style={{
                fontSize: "0.75rem", fontFamily: "monospace",
                letterSpacing: "0.18em", textTransform: "uppercase",
                color: "#AAAAAA",
              }}>
                {photos.length} {photos.length === 1 ? "memory" : "memories"} stored
              </span>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.06)" }} />
            </div>
          )}

          {/* Gallery */}
          {!isLoading && photos.length === 0 ? (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              height: "240px", borderRadius: "20px",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              backdropFilter: "blur(8px)",
            }}>
              <p style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>◫</p>
              <p style={{ fontSize: "0.875rem", color: "#AAAAAA" }}>No memories stored yet</p>
              <p style={{ fontSize: "0.78rem", color: "rgba(170,170,170,0.5)", marginTop: "0.35rem" }}>Upload your first image below</p>
            </div>
          ) : (
            <div className="vault-grid">
              <AnimatePresence>
                {photos.map((photo, index) => (
                  <PhotoCard
                    key={photo.id}
                    photo={photo}
                    index={index}
                    onView={() => setLightboxPhoto(photo)}
                    onDelete={() => setDeleteTarget(photo)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Upload zone */}
          <UploadZone onUpload={handleUpload} />

        </main>

        {lightboxPhoto && (
          <Lightbox photo={lightboxPhoto} onClose={() => setLightboxPhoto(null)} />
        )}

        {deleteTarget && (
          <DeleteConfirmModal
            photo={deleteTarget}
            onConfirm={() => handleDelete(deleteTarget)}
            onCancel={() => setDeleteTarget(null)}
          />
        )}

        <SecretVaultOverlay
          isOpen={showOverlay}
          onClose={() => setShowOverlay(false)}
        />
      </div>
    </>
  );
}
