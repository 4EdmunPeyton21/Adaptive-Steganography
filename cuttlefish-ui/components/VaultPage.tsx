"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

/* ─── Removed mock photos ────────────────────────────────────────── */

/* ─── Lightbox ──────────────────────────────────────────────────── */
function Lightbox({
  photo,
  onClose,
}: {
  photo: Photo;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
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
        transition={{ duration: 0.25 }}
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 200,
          background: "rgba(5,5,5,0.92)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "zoom-out",
          backdropFilter: "blur(12px)",
        }}
      >
        <motion.div
          initial={{ scale: 0.88, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.88, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "relative",
            maxWidth: "88vw",
            maxHeight: "88vh",
            borderRadius: "1rem",
            overflow: "hidden",
            boxShadow: "0 0 80px rgba(0,255,255,0.18), 0 0 0 1px rgba(0,255,255,0.12)",
            cursor: "default",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.src}
            alt={photo.name}
            style={{ display: "block", maxWidth: "88vw", maxHeight: "80vh", objectFit: "contain" }}
          />
          {/* Meta strip */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              padding: "0.75rem 1rem",
              background: "linear-gradient(to top, rgba(5,5,5,0.9), transparent)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "rgba(0,255,255,0.7)" }}>
              {photo.name}
            </span>
            <span style={{ fontFamily: "monospace", fontSize: "0.7rem", color: "rgba(255,255,255,0.4)" }}>
              {photo.size} · {photo.uploadedAt}
            </span>
          </div>
          {/* Close button */}
          <button
            id="lightbox-close-btn"
            onClick={onClose}
            aria-label="Close lightbox"
            style={{
              position: "absolute",
              top: "0.75rem",
              right: "0.75rem",
              width: "2rem",
              height: "2rem",
              borderRadius: "50%",
              border: "1px solid rgba(0,255,255,0.3)",
              background: "rgba(5,5,5,0.7)",
              color: "#00ffff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1rem",
              lineHeight: 1,
              backdropFilter: "blur(8px)",
            }}
          >
            ×
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ─── Delete confirm modal ──────────────────────────────────────── */
function DeleteConfirmModal({
  photo,
  onConfirm,
  onCancel,
}: {
  photo: Photo;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 250,
          background: "rgba(5,5,5,0.85)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backdropFilter: "blur(8px)",
        }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          style={{
            background: "#0a0a0a",
            border: "1px solid rgba(0,255,255,0.15)",
            borderRadius: "1rem",
            padding: "2rem",
            width: "min(420px, 90vw)",
            boxShadow: "0 0 60px rgba(0,255,255,0.08)",
          }}
        >
          <p style={{ fontSize: "0.7rem", fontFamily: "monospace", color: "rgba(0,255,255,0.5)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "0.75rem" }}>
            Confirm Deletion
          </p>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "1rem", marginBottom: "0.5rem" }}>
            Permanently remove this memory?
          </p>
          <p style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "rgba(0,255,255,0.6)", marginBottom: "1.75rem" }}>
            {photo.name}
          </p>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              id="delete-cancel-btn"
              onClick={onCancel}
              className="vault-btn-ghost"
              style={{ flex: 1 }}
            >
              Cancel
            </button>
            <button
              id="delete-confirm-btn"
              onClick={onConfirm}
              className="vault-btn-danger"
              style={{ flex: 1 }}
            >
              Delete
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ─── Photo card ────────────────────────────────────────────────── */
function PhotoCard({
  photo,
  onView,
  onDelete,
}: {
  photo: Photo;
  onView: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        borderRadius: "0.75rem",
        overflow: "hidden",
        cursor: "pointer",
        border: hovered ? "1px solid rgba(0,255,255,0.35)" : "1px solid rgba(255,255,255,0.05)",
        transition: "border-color 0.25s ease, box-shadow 0.25s ease",
        boxShadow: hovered ? "0 0 32px rgba(0,255,255,0.12)" : "none",
        breakInside: "avoid",
        marginBottom: "1rem",
        display: "block",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.src}
        alt={photo.name}
        onClick={onView}
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          filter: hovered ? "brightness(0.7)" : "brightness(1)",
          transition: "filter 0.25s ease",
        }}
      />

      {/* Hover overlay */}
      <motion.div
        initial={false}
        animate={{ opacity: hovered ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(to top, rgba(0,10,10,0.85) 0%, transparent 55%)",
          pointerEvents: "none",
        }}
      />

      {/* Photo meta */}
      <motion.div
        initial={false}
        animate={{ opacity: hovered ? 1 : 0, y: hovered ? 0 : 8 }}
        transition={{ duration: 0.22 }}
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "0.65rem 0.75rem",
          pointerEvents: "none",
        }}
      >
        <p style={{ fontFamily: "monospace", fontSize: "0.7rem", color: "rgba(0,255,255,0.85)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {photo.name}
        </p>
        <p style={{ fontFamily: "monospace", fontSize: "0.62rem", color: "rgba(255,255,255,0.35)", marginTop: "0.1rem" }}>
          {photo.size}
        </p>
      </motion.div>

      {/* View + delete buttons */}
      <motion.div
        initial={false}
        animate={{ opacity: hovered ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        style={{
          position: "absolute",
          top: "0.6rem",
          right: "0.6rem",
          display: "flex",
          gap: "0.4rem",
        }}
      >
        <button
          id={`view-btn-${photo.id}`}
          onClick={(e) => { e.stopPropagation(); onView(); }}
          aria-label={`View ${photo.name}`}
          className="vault-icon-btn"
        >
          ⤢
        </button>
        <button
          id={`delete-btn-${photo.id}`}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          aria-label={`Delete ${photo.name}`}
          className="vault-icon-btn vault-icon-btn-danger"
        >
          ✕
        </button>
      </motion.div>
    </motion.div>
  );
}

/* ─── Upload Zone ───────────────────────────────────────────────── */
function UploadZone({ onUpload }: { onUpload: (photos: Photo[]) => void }) {
  const [uploadState, setUploadState] = useState<UploadState>({
    status: "idle",
    progress: 0,
    message: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const MAX_SIZE_MB = 20;

  const performUpload = useCallback(
    async (files: File[]) => {
      const invalid = files.filter((f) => !ACCEPTED.includes(f.type));
      const tooBig = files.filter((f) => f.size > MAX_SIZE_MB * 1024 * 1024);

      if (invalid.length > 0) {
        setUploadState({ status: "error", progress: 0, message: `Unsupported format: ${invalid.map((f) => f.name).join(", ")}` });
        setTimeout(() => setUploadState({ status: "idle", progress: 0, message: "" }), 3500);
        return;
      }
      if (tooBig.length > 0) {
        setUploadState({ status: "error", progress: 0, message: `File exceeds ${MAX_SIZE_MB} MB: ${tooBig.map((f) => f.name).join(", ")}` });
        setTimeout(() => setUploadState({ status: "idle", progress: 0, message: "" }), 3500);
        return;
      }

      setUploadState({ status: "uploading", progress: 20, message: "Embedding via neural steganography…" });

      const token = localStorage.getItem("cuttlefish_token");
      const newPhotos: Photo[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("file", file);
        
        try {
          const res = await fetch("http://localhost:8000/api/v1/shatter", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`
            },
            body: formData
          });
          
          if (!res.ok) throw new Error("Upload failed");
          
          const data = await res.json();
          // Mock successful upload metadata for UI immediate feedback
          newPhotos.push({
            id: data.ghost_map_id,
            src: URL.createObjectURL(file), // use local object URL temporarily
            name: data.file_name,
            size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
            uploadedAt: new Date().toISOString().split("T")[0],
            width: 600,
            height: 400,
          });
          
          setUploadState(s => ({ ...s, progress: 20 + Math.round(((i + 1) / files.length) * 80) }));
        } catch (err) {
          setUploadState({ status: "error", progress: 0, message: `Failed to upload ${file.name}` });
          setTimeout(() => setUploadState({ status: "idle", progress: 0, message: "" }), 3500);
          return;
        }
      }

      onUpload(newPhotos);
      setUploadState({ status: "success", progress: 100, message: `${files.length} memory${files.length > 1 ? "s" : ""} hidden successfully.` });
      setTimeout(() => setUploadState({ status: "idle", progress: 0, message: "" }), 3000);
    },
    [onUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setUploadState((s) => ({ ...s, status: "idle" }));
      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
      if (files.length) performUpload(files);
    },
    [performUpload]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) performUpload(files);
    e.target.value = "";
  };

  const isDragging = uploadState.status === "dragging";
  const isUploading = uploadState.status === "uploading";
  const isSuccess = uploadState.status === "success";
  const isError = uploadState.status === "error";

  return (
    <div style={{ marginBottom: "4rem" }}>
      {/* Zone */}
      <motion.div
        id="upload-drop-zone"
        onDragOver={(e) => { e.preventDefault(); setUploadState((s) => ({ ...s, status: "dragging" })); }}
        onDragLeave={() => setUploadState((s) => ({ ...s, status: "idle" }))}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        animate={{
          borderColor: isDragging ? "#0ea5e9" : isSuccess ? "#10b981" : isError ? "#ef4444" : "#475569",
          background: isDragging ? "rgba(14,165,233,0.05)" : "#1e293b",
          boxShadow: isDragging ? "0 0 0 4px rgba(14,165,233,0.1)" : "none",
        }}
        transition={{ duration: 0.25 }}
        style={{
          border: "1px dashed #475569",
          borderRadius: "0.75rem",
          padding: "3rem 2rem",
          textAlign: "center",
          cursor: isUploading ? "default" : "pointer",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Upload progress bar */}
        {isUploading && (
          <motion.div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              height: "2px",
              background: "linear-gradient(to right, #00ffff, #00e5ff)",
              boxShadow: "0 0 12px rgba(0,255,255,0.6)",
            }}
            initial={{ width: "0%" }}
            animate={{ width: `${uploadState.progress}%` }}
            transition={{ duration: 0.15 }}
          />
        )}

        {/* Icon */}
        <motion.div
          animate={{ scale: isDragging ? 1.2 : 1 }}
          transition={{ duration: 0.2 }}
          style={{ fontSize: "2.5rem", marginBottom: "1rem", display: "block" }}
        >
          {isSuccess ? "✓" : isError ? "⚠" : isUploading ? "⋯" : "⊕"}
        </motion.div>

        {/* State text */}
        <p style={{
          fontFamily: "monospace",
          fontSize: "0.72rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: isSuccess ? "rgba(0,255,180,0.8)" : isError ? "rgba(255,100,100,0.8)" : isUploading ? "rgba(0,255,255,0.6)" : "rgba(0,255,255,0.45)",
          marginBottom: "0.5rem",
        }}>
          {isUploading
            ? uploadState.message
            : isSuccess
            ? uploadState.message
            : isError
            ? uploadState.message
            : isDragging
            ? "Release to embed"
            : "Drop images here or click to browse"}
        </p>

        {!isUploading && !isSuccess && !isError && (
          <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.22)", marginTop: "0.4rem" }}>
            Supports .jpg, .png, .webp, .gif — max {MAX_SIZE_MB} MB per file
          </p>
        )}

        {isUploading && (
          <p style={{ fontFamily: "monospace", fontSize: "0.65rem", color: "rgba(0,255,255,0.4)", marginTop: "0.5rem" }}>
            {uploadState.progress}%
          </p>
        )}
      </motion.div>

      <input
        ref={fileInputRef}
        id="file-upload-input"
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileChange}
        style={{ display: "none" }}
        aria-label="Upload image files"
      />
    </div>
  );
}

/* ─── Header ────────────────────────────────────────────────────── */
function VaultHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [username, setUsername] = useState("user");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll, { passive: true });
    
    try {
      const userStr = localStorage.getItem("cuttlefish_user");
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user.username) setUsername(user.username);
      }
    } catch(e) {}
    
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      id="vault-header"
      animate={{
        background: scrolled ? "rgba(15, 23, 42, 0.9)" : "transparent",
        backdropFilter: scrolled ? "blur(10px)" : "none",
        borderBottom: scrolled ? "1px solid #1e293b" : "1px solid transparent",
      }}
      transition={{ duration: 0.3 }}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "1.1rem 2rem",
      }}
    >
      {/* Brand */}
      <span style={{ fontFamily: "inherit", fontSize: "1rem", fontWeight: 700, color: "#f8fafc" }}>
        Cuttlefish Vault
      </span>

      {/* Right side */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        {/* User profile pill */}
        <div
          id="vault-user-profile"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            padding: "0.4rem 0.9rem",
            borderRadius: "9999px",
            border: "1px solid #334155",
            background: "#1e293b",
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: "1.6rem",
              height: "1.6rem",
              borderRadius: "50%",
              background: "#0ea5e9",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.7rem",
              fontWeight: 700,
              color: "#ffffff",
            }}
          >
            {username.charAt(0).toUpperCase()}
          </div>
          <span style={{ fontSize: "0.75rem", color: "#cbd5e1" }}>
            vault://{username}
          </span>
        </div>

        {/* Logout */}
        <a
          id="vault-logout-btn"
          href="/auth/login"
          className="vault-btn-ghost"
          style={{ padding: "0.4rem 0.9rem", borderRadius: "9999px", textDecoration: "none", fontSize: "0.875rem" }}
        >
          Logout
        </a>
      </div>
    </motion.header>
  );
}

/* ─── Gallery grid ──────────────────────────────────────────────── */
function GalleryGrid({
  photos,
  onView,
  onDelete,
}: {
  photos: Photo[];
  onView: (p: Photo) => void;
  onDelete: (p: Photo) => void;
}) {
  if (photos.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "5rem 0" }}>
        <p style={{ fontSize: "2rem", marginBottom: "1rem" }}>◫</p>
        <p style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "rgba(0,255,255,0.35)", letterSpacing: "0.15em", textTransform: "uppercase" }}>
          No memories stored
        </p>
        <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.25)", marginTop: "0.5rem" }}>
          Upload an image to begin embedding
        </p>
      </div>
    );
  }

  return (
    <div
      id="photo-gallery-grid"
      style={{
        columns: "var(--gallery-cols, 3)",
        gap: "1rem",
        columnGap: "1rem",
      }}
    >
      <AnimatePresence>
        {photos.map((photo) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            onView={() => onView(photo)}
            onDelete={() => onDelete(photo)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ScrollGradientBackground() {
  return (
    <div
      id="vault-gradient-bg"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        background: "#0f172a",
        backgroundAttachment: "fixed",
        pointerEvents: "none",
      }}
    />
  );
}

/* ─── Main VaultPage component ──────────────────────────────────── */
export default function VaultPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Photo | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);

  // Fetch actual photos from API
  useEffect(() => {
    const token = localStorage.getItem("cuttlefish_token");
    if (!token) {
      window.location.href = "/auth/login";
      return;
    }

    async function fetchMemories() {
      try {
        const res = await fetch("http://localhost:8000/api/v1/vault/memories", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Failed to fetch memories");
        const data = await res.json();
        
        // Fetch secure image blobs for each photo
        const photosWithBlobs = await Promise.all(data.map(async (p: any) => {
          try {
            const imgRes = await fetch(`http://localhost:8000${p.src}`, {
              headers: { "Authorization": `Bearer ${token}` }
            });
            if (!imgRes.ok) throw new Error();
            const blob = await imgRes.blob();
            return { ...p, src: URL.createObjectURL(blob) };
          } catch(e) {
            return p;
          }
        }));
        
        setPhotos(photosWithBlobs);
      } catch (err) {
        console.error(err);
      }
    }
    
    fetchMemories();
  }, []);

  /* Lenis smooth scroll */
  const lenisRef = useRef<{ destroy: () => void; raf: (t: number) => void } | null>(null);

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

  /* Keyboard shortcut: Shift + Esc + G → secret overlay */
  useEffect(() => {
    const pressed = new Set<string>();

    const onKeyDown = (e: KeyboardEvent) => {
      // When Shift is held, 'g' becomes 'G'. Convert to lowercase for consistent tracking.
      const key = e.key.toLowerCase();
      pressed.add(key);

      // We use e.shiftKey directly, and check if 'escape' and 'g' are in the pressed set
      if (e.shiftKey && pressed.has("escape") && key === "g") {
        e.preventDefault();
        setShowOverlay(true);
        pressed.clear();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      pressed.delete(e.key.toLowerCase());
    };

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

  const handleDelete = useCallback((photo: Photo) => {
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    setDeleteTarget(null);
  }, []);

  return (
    <>
      <ScrollGradientBackground />
      <VaultHeader />

      {/* Main scrollable content */}
      <main
        id="vault-main"
        style={{
          position: "relative",
          zIndex: 10,
          paddingTop: "6rem",
          minHeight: "100dvh",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "0 2rem 6rem",
          }}
        >
          {/* Page heading */}
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            style={{ marginBottom: "3rem" }}
          >
            <h1 style={{
              fontSize: "clamp(2rem, 6vw, 3.5rem)",
              fontWeight: 800,
              lineHeight: 1.2,
              color: "#f8fafc",
              marginBottom: "1rem",
            }}>
              Memory Vault
            </h1>
            <p style={{
              fontSize: "clamp(1rem, 2vw, 1.125rem)",
              color: "#94a3b8",
              maxWidth: "600px",
              lineHeight: 1.6,
            }}>
              A secure, encrypted repository for memories concealed within the noise of ordinary images.
            </p>
          </motion.div>

          {/* Upload zone */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35, ease: "easeOut" }}
          >
            <SectionLabel label="Embed New Memory" id="upload-section-label" />
            <UploadZone onUpload={handleUpload} />
          </motion.div>

          {/* Gallery section */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5, ease: "easeOut" }}
          >
            <SectionLabel label={`Stored Memories · ${photos.length}`} id="gallery-section-label" />
            <GalleryGrid
              photos={photos}
              onView={(p) => setLightboxPhoto(p)}
              onDelete={(p) => setDeleteTarget(p)}
            />
          </motion.div>
        </div>
      </main>

      {/* Lightbox */}
      {lightboxPhoto && (
        <Lightbox photo={lightboxPhoto} onClose={() => setLightboxPhoto(null)} />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <DeleteConfirmModal
          photo={deleteTarget}
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Secret vault overlay */}
      <SecretVaultOverlay
        isOpen={showOverlay}
        onClose={() => setShowOverlay(false)}
      />
    </>
  );
}

/* ─── Helper: section label ─────────────────────────────────────── */
function SectionLabel({ label, id }: { label: string; id: string }) {
  return (
    <div
      id={id}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        marginBottom: "1.5rem",
      }}
    >
      <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#f8fafc", margin: 0 }}>
        {label}
      </h2>
      <div style={{ flex: 1, height: "1px", background: "linear-gradient(to right, #334155, transparent)" }} />
    </div>
  );
}
