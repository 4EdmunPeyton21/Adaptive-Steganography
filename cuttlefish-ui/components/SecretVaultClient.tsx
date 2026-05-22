"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { LogOut, RefreshCw, Shield, Upload, Download, CheckCircle } from "lucide-react";
import { WarpShaderBackground } from "@/components/ui/wrap-shader";

/* ════════════════════════════════════════════════════════════════════
   TYPES
   ════════════════════════════════════════════════════════════════════ */
interface FileGroup {
  fileId: string;
  fileName: string;
  color: string;
  glowColor: string;
  totalShards: number;
  threshold: number;
}

interface VaultImage {
  id: string;
  src: string;
  fileId: string;
  shardIndex: number;
  name: string;
}

// A plain memory vault photo (for the preview grid)
interface MemoryPhoto {
  id: string;
  blobSrc: string;
  name: string;
}

type UploadStatus = "idle" | "uploading" | "success" | "error";
type RecoveryStatus = "idle" | "animating" | "downloading" | "done" | "error";

/* ════════════════════════════════════════════════════════════════════
   CONSTANTS
   ════════════════════════════════════════════════════════════════════ */
const FILE_COLORS: { color: string; glowColor: string }[] = [
  { color: "#00FFFF", glowColor: "rgba(0,255,255,0.22)" },
  { color: "#8b5cf6", glowColor: "rgba(139,92,246,0.22)" },
  { color: "#f59e0b", glowColor: "rgba(245,158,11,0.22)" },
  { color: "#10b981", glowColor: "rgba(16,185,129,0.22)" },
  { color: "#ef4444", glowColor: "rgba(239,68,68,0.22)" },
];

/* ════════════════════════════════════════════════════════════════════
   API HELPERS
   ════════════════════════════════════════════════════════════════════ */
async function fetchStegoFiles(): Promise<{ files: FileGroup[]; images: VaultImage[] }> {
  const token = localStorage.getItem("cuttlefish_token");
  if (!token) throw new Error("No token");
  const res = await fetch("http://localhost:8000/api/v1/stego/files", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch stego files");
  const data = await res.json();

  const files: FileGroup[] = [];
  const images: VaultImage[] = [];

  data.forEach((f: any, i: number) => {
    const colorPair = FILE_COLORS[i % FILE_COLORS.length];
    files.push({
      fileId: f.fileId,
      fileName: f.fileName,
      color: colorPair.color,
      glowColor: colorPair.glowColor,
      totalShards: f.totalShards,
      threshold: f.threshold,
    });
    f.images.forEach((img: any) => {
      images.push({
        id: img.id,
        src: `http://localhost:8000${img.src}?token=${token}`,
        fileId: img.fileId,
        shardIndex: img.shardIndex,
        name: img.name,
      });
    });
  });

  return { files, images };
}

/** Fetch memory vault images to show as carrier previews */
async function fetchMemoryVaultPhotos(): Promise<MemoryPhoto[]> {
  const token = localStorage.getItem("cuttlefish_token");
  if (!token) return [];
  try {
    const res = await fetch("http://localhost:8000/api/v1/vault/memories", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    // Fetch each image as a blob (Bearer token required)
    const photos = await Promise.all(
      data.map(async (p: any) => {
        try {
          const imgRes = await fetch(`http://localhost:8000${p.src}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!imgRes.ok) throw new Error();
          const blob = await imgRes.blob();
          return { id: p.id, blobSrc: URL.createObjectURL(blob), name: p.name };
        } catch {
          return { id: p.id, blobSrc: "", name: p.name };
        }
      })
    );
    return photos.filter((p) => p.blobSrc !== "");
  } catch {
    return [];
  }
}

async function uploadStegoFile(file: File): Promise<{ fileId: string; fileName: string; images: VaultImage[] }> {
  const token = localStorage.getItem("cuttlefish_token");
  if (!token) throw new Error("No token");
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("http://localhost:8000/api/v1/stego/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) {
    let msg = "Upload failed";
    try {
      const err = await res.json();
      if (err.detail) msg = err.detail;
    } catch {}
    throw new Error(msg);
  }
  const data = await res.json();
  const images: VaultImage[] = data.images.map((img: any) => ({
    id: img.id,
    src: `http://localhost:8000${img.src}?token=${token}`,
    fileId: img.fileId ?? data.fileId,
    shardIndex: img.shardIndex,
    name: img.name,
  }));
  return { fileId: data.fileId, fileName: data.fileName, images };
}

async function recoverStegoFile(imageIds: string[]): Promise<{ downloadUrl: string; fileName: string }> {
  const token = localStorage.getItem("cuttlefish_token");
  if (!token) throw new Error("No token");
  const res = await fetch("http://localhost:8000/api/v1/stego/recover", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ shard_ids: imageIds }),
  });
  if (!res.ok) throw new Error("Recovery failed");
  const blob = await res.blob();
  const disp = res.headers.get("Content-Disposition");
  let fileName = "recovered_file";
  if (disp?.includes("filename=")) fileName = disp.split("filename=")[1].replace(/"/g, "");
  return { downloadUrl: URL.createObjectURL(blob), fileName };
}

/* ════════════════════════════════════════════════════════════════════
   RECOVERY ANIMATION
   ════════════════════════════════════════════════════════════════════ */
function RecoveryAnimation({ selectedImages, group, onComplete }: {
  selectedImages: VaultImage[]; group: FileGroup; onComplete: () => void;
}) {
  const [phase, setPhase] = useState<"gather" | "merge" | "reveal">("gather");
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("merge"), 900);
    const t2 = setTimeout(() => setPhase("reveal"), 1900);
    const t3 = setTimeout(() => onComplete(), 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 400,
        background: "rgba(2,2,8,0.93)", backdropFilter: "blur(24px)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: "2rem",
      }}
    >
      <motion.p
        key={phase}
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        style={{ fontFamily: "monospace", fontSize: "0.65rem", letterSpacing: "0.3em", textTransform: "uppercase", color: group.color }}
      >
        {phase === "gather" && "Extracting steganographic shards…"}
        {phase === "merge" && "Reconstructing via Shamir's algorithm…"}
        {phase === "reveal" && "Decrypting with AES-256-GCM…"}
      </motion.p>
      <div style={{ position: "relative", width: "280px", height: "200px" }}>
        {selectedImages.map((img, i) => {
          const angle = ((i - 1) * 120) * (Math.PI / 180);
          const radius = phase === "gather" ? 110 : phase === "merge" ? 30 : 0;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          const scale = phase === "reveal" ? 0 : phase === "merge" ? 0.6 : 0.5;
          return (
            <motion.div
              key={img.id}
              animate={{ x, y, scale, opacity: phase === "reveal" ? 0 : 1 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: "absolute", top: "50%", left: "50%",
                width: "90px", height: "70px", marginLeft: "-45px", marginTop: "-35px",
                borderRadius: "0.5rem", overflow: "hidden",
                border: `2px solid ${group.color}`, boxShadow: `0 0 20px ${group.glowColor}`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.src} alt={img.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </motion.div>
          );
        })}
        <motion.div
          animate={{ scale: phase === "merge" ? [1, 1.4, 1] : phase === "reveal" ? 2 : 0, opacity: phase === "gather" ? 0 : phase === "merge" ? 0.6 : 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          style={{
            position: "absolute", top: "50%", left: "50%", width: "80px", height: "80px",
            marginLeft: "-40px", marginTop: "-40px", borderRadius: "50%",
            background: `radial-gradient(circle, ${group.color} 0%, transparent 70%)`, filter: "blur(12px)",
          }}
        />
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        {["gather", "merge", "reveal"].map((p, i) => (
          <motion.div
            key={p}
            animate={{ background: ["gather", "merge", "reveal"].indexOf(phase) >= i ? group.color : "rgba(255,255,255,0.15)" }}
            transition={{ duration: 0.3 }}
            style={{ width: "6px", height: "6px", borderRadius: "50%" }}
          />
        ))}
      </div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   SHARD CARD  (shown after embedding — user clicks to select)
   ════════════════════════════════════════════════════════════════════ */
function ShardCard({ image, group, isSelected, isAnimating, onClick, onDelete }: {
  image: VaultImage; group: FileGroup; isSelected: boolean;
  isAnimating: boolean; onClick: () => void; onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        position: "relative",
        width: "180px", height: "180px",
        flexShrink: 0,
        borderRadius: "14px",
        overflow: "hidden",
        cursor: isAnimating ? "default" : "pointer",
        border: isSelected
          ? `2px solid ${group.color}`
          : hovered ? `1px solid ${group.color}80` : "1px solid rgba(255,255,255,0.1)",
        boxShadow: isSelected
          ? `0 0 28px ${group.glowColor}, 0 0 0 4px ${group.color}20`
          : hovered ? `0 0 16px ${group.glowColor}55` : "0 4px 16px rgba(0,0,0,0.3)",
        transform: isSelected ? "scale(1.04)" : hovered ? "scale(1.02)" : "scale(1)",
        transition: "transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease",
        background: "#0a0a14",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.src}
        alt={`Shard ${image.shardIndex}`}
        style={{
          width: "100%", height: "100%", objectFit: "cover",
          opacity: isSelected ? 0.65 : hovered ? 0.8 : 1,
          transition: "opacity 0.22s ease",
        }}
        onError={(e) => {
          // Show a placeholder if image fails to load
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />

      {/* Dark gradient overlay */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to top, rgba(5,5,20,0.95) 0%, transparent 55%)",
      }} />

      {/* Selected check */}
      {isSelected && (
        <div style={{
          position: "absolute", top: "8px", left: "8px", zIndex: 5,
          width: "26px", height: "26px", borderRadius: "50%",
          background: group.color, display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 0 14px ${group.glowColor}`,
        }}>
          <span style={{ fontSize: "0.8rem", color: "#050505", fontWeight: 800, lineHeight: 1 }}>✓</span>
        </div>
      )}

      {/* Delete button on hover */}
      {hovered && !isSelected && !isAnimating && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          style={{
            position: "absolute", top: "8px", right: "8px", zIndex: 10,
            width: "26px", height: "26px", borderRadius: "50%",
            background: "rgba(220,38,38,0.85)", border: "1px solid rgba(255,255,255,0.2)",
            color: "white", display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      )}

      {/* Bottom: shard info */}
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0, padding: "0.5rem 0.65rem",
      }}>
        <div style={{
          display: "inline-block",
          fontFamily: "monospace", fontSize: "0.58rem", letterSpacing: "0.12em",
          textTransform: "uppercase", padding: "0.12rem 0.38rem",
          borderRadius: "4px", background: `${group.color}22`,
          border: `1px solid ${group.color}44`, color: group.color,
          marginBottom: "0.25rem",
        }}>
          Shard {image.shardIndex} / {group.totalShards}
        </div>
        <p style={{
          fontFamily: "monospace", fontSize: "0.6rem",
          color: "rgba(255,255,255,0.45)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {group.fileName}
        </p>
      </div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   MEMORY VAULT PREVIEW (shown before any embedding)
   ════════════════════════════════════════════════════════════════════ */
function MemoryVaultPreview({ photos }: { photos: MemoryPhoto[] }) {
  if (photos.length === 0) return null;
  return (
    <div style={{ marginBottom: "2.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.6rem" }}>
        <h2 style={{ fontSize: "0.9rem", fontWeight: 600, color: "#fff", margin: 0 }}>
          Available Carrier Images
        </h2>
        <span style={{
          fontSize: "0.7rem", color: "#AAAAAA",
          border: "1px solid rgba(255,255,255,0.1)", padding: "0.15rem 0.5rem", borderRadius: "9999px",
        }}>
          {photos.length} from Memory Vault
        </span>
        <div style={{ flex: 1, height: "1px", background: "linear-gradient(to right, rgba(255,255,255,0.08), transparent)" }} />
      </div>
      <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.35)", marginBottom: "1rem" }}>
        When you embed a file, it will be hidden inside random images from your vault.
      </p>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        {photos.slice(0, 10).map((p) => (
          <div
            key={p.id}
            style={{
              width: "80px", height: "80px", borderRadius: "10px", overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.1)", flexShrink: 0,
              background: "#0a0a14",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.blobSrc} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        ))}
        {photos.length > 10 && (
          <div style={{
            width: "80px", height: "80px", borderRadius: "10px",
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "rgba(255,255,255,0.4)", fontSize: "0.78rem", fontWeight: 600,
            flexShrink: 0,
          }}>
            +{photos.length - 10}
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   EMBED SECTION
   ════════════════════════════════════════════════════════════════════ */
function EmbedSection({ onUploadComplete, nextColorIndex }: {
  onUploadComplete: (group: FileGroup, images: VaultImage[]) => void;
  nextColorIndex: number;
}) {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => { setSelectedFile(file); setStatus("idle"); setMessage(""); };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setStatus("uploading"); setProgress(0);
    const stages = [
      { pct: 20, msg: "Encrypting with AES-256-GCM…" },
      { pct: 45, msg: "Splitting via Shamir's Secret Sharing…" },
      { pct: 72, msg: "Selecting random carrier images from vault…" },
      { pct: 92, msg: "Embedding shards (SteganoGAN)…" },
    ];
    for (const s of stages) {
      await new Promise((r) => setTimeout(r, 550));
      setProgress(s.pct); setMessage(s.msg);
    }
    const colorPair = FILE_COLORS[nextColorIndex % FILE_COLORS.length];
    try {
      const result = await uploadStegoFile(selectedFile);
      setProgress(100);
      const group: FileGroup = {
        fileId: result.fileId, fileName: result.fileName,
        color: colorPair.color, glowColor: colorPair.glowColor,
        totalShards: 5, threshold: 3,
      };
      onUploadComplete(group, result.images);
      setStatus("success");
      setMessage(`Hidden across 5 images — select any 3 shards below to recover.`);
    } catch (err: any) {
      setStatus("error");
      setMessage(err?.message ?? "Upload failed — check backend is running.");
    }
    setSelectedFile(null);
    setTimeout(() => { setStatus("idle"); setMessage(""); setProgress(0); }, 7000);
  };

  const isUploading = status === "uploading";
  const isSuccess = status === "success";
  const isError = status === "error";

  return (
    <div style={{ marginBottom: "2.5rem" }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.6rem" }}>
        <Upload size={16} color="#00FFFF" />
        <h2 style={{ fontSize: "0.95rem", fontWeight: 600, color: "#fff", margin: 0 }}>Embed Secret File</h2>
        <span style={{ fontSize: "0.7rem", color: "#00FFFF", border: "1px solid rgba(0,255,255,0.25)", padding: "0.15rem 0.5rem", borderRadius: "9999px" }}>
          AES-256 · k=3,n=5
        </span>
        <div style={{ flex: 1, height: "1px", background: "linear-gradient(to right, rgba(0,255,255,0.15), transparent)" }} />
      </div>

      {/* Drop zone */}
      <motion.div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        animate={{
          borderColor: isDragging ? "#00FFFF" : isSuccess ? "#10b981" : isError ? "#ef4444" : "rgba(255,255,255,0.12)",
          background: isDragging ? "rgba(0,255,255,0.04)" : "rgba(5,5,20,0.5)",
        }}
        transition={{ duration: 0.2 }}
        style={{
          border: "1px dashed rgba(255,255,255,0.12)",
          borderRadius: "14px", padding: "2rem",
          textAlign: "center", cursor: isUploading ? "default" : "pointer",
          position: "relative", overflow: "hidden", backdropFilter: "blur(6px)",
        }}
      >
        {isUploading && (
          <div style={{
            position: "absolute", bottom: 0, left: 0,
            height: "2px", background: "#00FFFF",
            boxShadow: "0 0 12px rgba(0,255,255,0.6)",
            width: `${progress}%`, transition: "width 0.4s ease",
          }} />
        )}
        <div style={{ fontSize: "1.75rem", marginBottom: "0.6rem", color: isSuccess ? "#10b981" : isError ? "#ef4444" : isUploading ? "#00FFFF" : "rgba(255,255,255,0.3)" }}>
          {isSuccess ? "✓" : isError ? "⚠" : isUploading ? "⋯" : "⊕"}
        </div>
        {selectedFile && status === "idle" && (
          <p style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "#00FFFF", marginBottom: "0.3rem" }}>
            {selectedFile.name}
          </p>
        )}
        <p style={{
          fontFamily: "monospace", fontSize: "0.68rem", letterSpacing: "0.15em", textTransform: "uppercase",
          color: isSuccess ? "rgba(16,185,129,0.9)" : isError ? "rgba(239,68,68,0.9)" : isUploading ? "rgba(0,255,255,0.7)" : "rgba(255,255,255,0.3)",
        }}>
          {isUploading ? message : isSuccess ? message : isError ? message : isDragging ? "Release to embed" : selectedFile ? "File ready — click Embed" : "Drop any file here · or click to browse"}
        </p>
        {isUploading && <p style={{ fontFamily: "monospace", fontSize: "0.58rem", color: "rgba(0,255,255,0.4)", marginTop: "0.3rem" }}>{progress}%</p>}
      </motion.div>

      <input ref={fileInputRef} type="file"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        style={{ display: "none" }}
      />

      {selectedFile && status === "idle" && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: "0.75rem", display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={handleUpload}
            style={{
              padding: "0.6rem 1.5rem", borderRadius: "10px",
              background: "#00FFFF", color: "#050505",
              fontSize: "0.85rem", fontWeight: 700, cursor: "pointer",
              border: "none", boxShadow: "0 0 20px rgba(0,255,255,0.3)",
            }}
          >
            Embed File →
          </button>
        </motion.div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   HEADER
   ════════════════════════════════════════════════════════════════════ */
function SecretHeader({ onExit, username }: { onExit: () => void; username: string }) {
  return (
    <header style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 2rem",
      background: "rgba(5,5,15,0.72)", backdropFilter: "blur(12px)",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
    }}>
      {/* Brand only — no extra tags */}
      <span style={{
        fontFamily: "monospace", fontSize: "0.85rem", fontWeight: 700,
        letterSpacing: "0.3em", textTransform: "uppercase", color: "#fff",
      }}>
        Cuttlefish
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <div style={{
          width: "32px", height: "32px", borderRadius: "50%",
          background: "#00FFFF", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "0.8rem", fontWeight: 700, color: "#050505",
        }}>
          {username.charAt(0).toUpperCase()}
        </div>
        <div style={{ width: "1px", height: "18px", background: "rgba(255,255,255,0.12)" }} />
        <button onClick={onExit} style={{
          display: "flex", alignItems: "center", gap: "0.5rem",
          fontSize: "0.82rem", color: "#AAAAAA",
          background: "none", border: "none", cursor: "pointer", padding: 0,
        }}>
          <LogOut size={14} />
          <span>Back to Vault</span>
        </button>
      </div>
    </header>
  );
}

/* ════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════ */
export default function SecretVaultClient() {
  const router = useRouter();
  const [vaultImages, setVaultImages] = useState<VaultImage[]>([]);
  const [fileGroups, setFileGroups] = useState<FileGroup[]>([]);
  const [memoryPhotos, setMemoryPhotos] = useState<MemoryPhoto[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [recoveryStatus, setRecoveryStatus] = useState<RecoveryStatus>("idle");
  const [downloadInfo, setDownloadInfo] = useState<{ url: string; fileName: string } | null>(null);
  const [showRecoveryAnim, setShowRecoveryAnim] = useState(false);
  const [filterFileId, setFilterFileId] = useState<string | "all">("all");
  const [username, setUsername] = useState("user");
  const [isRefreshing, setIsRefreshing] = useState(false);

  /* ── Central refresh ─────────────────────────────────────────── */
  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const data = await fetchStegoFiles();
      setFileGroups(data.files);
      setVaultImages(data.images);
    } catch (e) { console.error(e); }
    finally { setIsRefreshing(false); }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("cuttlefish_token");
    if (!token) { router.push("/auth/login"); return; }
    try {
      const u = JSON.parse(localStorage.getItem("cuttlefish_user") ?? "{}");
      if (u.username) setUsername(u.username);
    } catch {}
    // Load both stego files and memory vault photos in parallel
    Promise.all([refreshData(), fetchMemoryVaultPhotos().then(setMemoryPhotos)]);
  }, [router, refreshData]);

  /* ── Keyboard shortcuts ──────────────────────────────────────── */
  const exitToVault = useCallback(() => router.push("/vault"), [router]);
  useEffect(() => {
    const pressed = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      pressed.add(key);
      if (key === "escape" && !e.shiftKey && !pressed.has("g")) exitToVault();
    };
    const onKeyUp = (e: KeyboardEvent) => pressed.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); };
  }, [exitToVault]);

  /* ── Selection ───────────────────────────────────────────────── */
  const toggleSelect = useCallback((id: string) => {
    if (recoveryStatus !== "idle") return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setDownloadInfo(null);
    setRecoveryStatus("idle");
  }, [recoveryStatus]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set()); setDownloadInfo(null); setRecoveryStatus("idle");
  }, []);

  /* ── Upload complete ─────────────────────────────────────────── */
  const handleUploadComplete = useCallback((group: FileGroup, images: VaultImage[]) => {
    setFileGroups((prev) => [...prev, group]);
    setVaultImages((prev) => [...prev, ...images]);
    // Auto-set filter to show the newly uploaded file's shards
    setFilterFileId(group.fileId);
  }, []);

  /* ── Recovery ────────────────────────────────────────────────── */
  const handleRecover = useCallback(async () => {
    const selImgs = vaultImages.filter((img) => selectedIds.has(img.id));
    const fileIds = new Set(selImgs.map((img) => img.fileId));
    if (fileIds.size > 1) return;
    const group = fileGroups.find((g) => g.fileId === [...fileIds][0]);
    if (!group) return;
    setRecoveryStatus("animating");
    setShowRecoveryAnim(true);
  }, [vaultImages, selectedIds, fileGroups]);

  const onAnimationComplete = useCallback(async () => {
    setShowRecoveryAnim(false);
    setRecoveryStatus("downloading");
    try {
      const { downloadUrl, fileName } = await recoverStegoFile(Array.from(selectedIds));
      setRecoveryStatus("done");
      setDownloadInfo({ url: downloadUrl, fileName });
      const a = document.createElement("a");
      a.href = downloadUrl; a.download = fileName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch { setRecoveryStatus("error"); }
  }, [selectedIds]);

  /* ── Delete ──────────────────────────────────────────────────── */
  const handleDeleteFile = useCallback(async (fileId: string) => {
    if (!confirm("Delete this file and all its shards? This cannot be undone.")) return;
    try {
      const token = localStorage.getItem("cuttlefish_token");
      const res = await fetch(`http://localhost:8000/api/v1/stego/files/${fileId}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
      if (filterFileId === fileId) setFilterFileId("all");
      await refreshData();
    } catch (e) { console.error(e); alert("Failed to delete."); await refreshData(); }
  }, [filterFileId, refreshData]);

  const handleDeleteShard = useCallback(async (shardId: string) => {
    if (!confirm("Delete this shard?")) return;
    try {
      const token = localStorage.getItem("cuttlefish_token");
      const res = await fetch(`http://localhost:8000/api/v1/stego/shards/${shardId}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Delete shard failed: ${res.status}`);
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(shardId); return n; });
      await refreshData();
    } catch (e) { console.error(e); alert("Failed to delete shard."); await refreshData(); }
  }, [refreshData]);

  /* ── Derived state ───────────────────────────────────────────── */
  const filteredImages = useMemo(() =>
    filterFileId === "all" ? vaultImages : vaultImages.filter((img) => img.fileId === filterFileId),
    [vaultImages, filterFileId]
  );

  const selectedImages = vaultImages.filter((img) => selectedIds.has(img.id));
  const selectedFileIds = new Set(selectedImages.map((img) => img.fileId));
  const isMixed = selectedFileIds.size > 1;
  const selectedGroup = fileGroups.find((g) => g.fileId === [...selectedFileIds][0]);
  const threshold = selectedGroup?.threshold ?? 3;
  const canRecover = selectedIds.size >= threshold && !isMixed && recoveryStatus === "idle";

  const noShardsYet = vaultImages.length === 0;

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #050505; }
        .sv-bg { position: fixed; inset: 0; z-index: 0; }
        .shard-grid { display: flex; flex-wrap: wrap; gap: 1rem; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#050505", color: "#fff", position: "relative" }}>
        {/* Warp shader background */}
        <div className="sv-bg">
          <WarpShaderBackground />
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to bottom, rgba(5,5,15,0.38) 0%, rgba(5,5,15,0.52) 100%)",
          }} />
        </div>

        <SecretHeader onExit={exitToVault} username={username} />

        <main style={{ position: "relative", zIndex: 10, paddingTop: "104px", minHeight: "100dvh" }}>
          <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 2rem 6rem" }}>

            {/* ── Page heading ─────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
              style={{ marginBottom: "2.5rem" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.6rem" }}>
                <Shield size={18} color="#00FFFF" />
                <h1 style={{ fontSize: "clamp(1.75rem, 5vw, 2.75rem)", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
                  Steganographic Vault
                </h1>
              </div>
              <p style={{ fontSize: "0.88rem", color: "#AAAAAA", maxWidth: "560px", lineHeight: 1.7 }}>
                Embed files inside your vault images using GAN steganography. Any 3-of-5 image shards can reconstruct the original.
              </p>
              <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.2)", marginTop: "0.6rem", fontFamily: "monospace" }}>
                Esc → exit · Shift+Esc+G → re-enter
              </p>
            </motion.div>

            <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", marginBottom: "2.5rem" }} />

            {/* ── Two-column layout on wide screens ──────── */}
            <div style={{ display: "flex", gap: "2.5rem", alignItems: "flex-start", flexWrap: "wrap" }}>

              {/* LEFT: embed section */}
              <div style={{ flex: "1 1 320px", minWidth: 0 }}>
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.1 }}>
                  <EmbedSection onUploadComplete={handleUploadComplete} nextColorIndex={fileGroups.length} />
                </motion.div>

                {/* Memory vault preview */}
                {noShardsYet && (
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
                    <MemoryVaultPreview photos={memoryPhotos} />
                  </motion.div>
                )}

                {/* Recovery panel */}
                {!noShardsYet && (
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
                    <div style={{
                      padding: "1.25rem 1.5rem", borderRadius: "14px",
                      background: "rgba(10,10,20,0.55)", backdropFilter: "blur(8px)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
                        <Download size={15} color="#00FFFF" />
                        <h2 style={{ fontSize: "0.9rem", fontWeight: 600, color: "#fff", margin: 0 }}>Recover File</h2>
                      </div>

                      {/* Selection status */}
                      <p style={{ fontSize: "0.82rem", color: "#fff", fontWeight: 500, marginBottom: "0.4rem" }}>
                        {selectedIds.size === 0
                          ? "No shards selected"
                          : `${selectedIds.size} shard${selectedIds.size > 1 ? "s" : ""} selected`}
                        {selectedGroup && (
                          <span style={{ marginLeft: "0.5rem", fontFamily: "monospace", fontSize: "0.68rem", color: selectedGroup.color }}>
                            · {selectedGroup.fileName}
                          </span>
                        )}
                      </p>
                      {isMixed && <p style={{ fontFamily: "monospace", fontSize: "0.65rem", color: "rgba(255,100,100,0.85)", marginBottom: "0.5rem" }}>✕ Shards must be from the same file</p>}
                      {!isMixed && selectedIds.size > 0 && selectedIds.size < threshold && (
                        <p style={{ fontFamily: "monospace", fontSize: "0.63rem", color: "rgba(255,255,255,0.3)", marginBottom: "0.5rem" }}>
                          {threshold - selectedIds.size} more shard{threshold - selectedIds.size > 1 ? "s" : ""} needed
                        </p>
                      )}

                      {/* Thumb preview */}
                      {selectedImages.length > 0 && (
                        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "1rem" }}>
                          {selectedImages.map((img) => {
                            const g = fileGroups.find((fg) => fg.fileId === img.fileId)!;
                            return (
                              <div key={img.id} style={{ width: "44px", height: "38px", borderRadius: "6px", overflow: "hidden", border: `1px solid ${g?.color ?? "#fff"}60` }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={img.src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div style={{ display: "flex", gap: "0.6rem" }}>
                        {selectedIds.size > 0 && (
                          <button onClick={clearSelection} style={{
                            padding: "0.55rem 0.9rem", borderRadius: "9px",
                            background: "transparent", border: "1px solid rgba(255,255,255,0.14)",
                            color: "rgba(255,255,255,0.55)", fontSize: "0.8rem", cursor: "pointer",
                          }}>Clear</button>
                        )}
                        <button
                          onClick={handleRecover}
                          disabled={!canRecover}
                          style={{
                            flex: 1, padding: "0.55rem 1rem", borderRadius: "9px",
                            background: canRecover ? "#00FFFF" : "rgba(255,255,255,0.07)",
                            color: canRecover ? "#050505" : "rgba(255,255,255,0.25)",
                            fontSize: "0.85rem", fontWeight: 700, cursor: canRecover ? "pointer" : "not-allowed",
                            border: "none", transition: "all 0.2s",
                            boxShadow: canRecover ? "0 0 18px rgba(0,255,255,0.28)" : "none",
                          }}
                        >
                          {recoveryStatus === "animating" || recoveryStatus === "downloading" ? "Recovering…" : "Recover File →"}
                        </button>
                      </div>

                      <AnimatePresence>
                        {recoveryStatus === "done" && downloadInfo && (
                          <motion.div
                            key="dl"
                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            style={{
                              marginTop: "1rem", padding: "0.9rem 1rem", borderRadius: "10px",
                              background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.28)",
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                            }}
                          >
                            <div>
                              <p style={{ fontFamily: "monospace", fontSize: "0.58rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(16,185,129,0.65)", marginBottom: "0.2rem" }}>✓ Recovery complete</p>
                              <p style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "rgba(16,185,129,0.9)" }}>{downloadInfo.fileName}</p>
                            </div>
                            <a href={downloadInfo.url} download={downloadInfo.fileName} style={{
                              padding: "0.5rem 1rem", borderRadius: "8px",
                              background: "#00FFFF", color: "#050505",
                              fontSize: "0.8rem", fontWeight: 700, textDecoration: "none",
                            }}>↓ Download</a>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      {recoveryStatus === "error" && (
                        <p style={{ fontFamily: "monospace", fontSize: "0.68rem", color: "rgba(255,100,100,0.8)", marginTop: "0.75rem" }}>
                          ✕ Recovery failed — try selecting different shards.
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* RIGHT: shard catalog */}
              <div style={{ flex: "2 1 440px", minWidth: 0 }}>
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.15 }}>

                  {/* Section header */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
                    <h2 style={{ fontSize: "0.95rem", fontWeight: 600, color: "#fff", margin: 0 }}>
                      Shard Images
                    </h2>
                    {vaultImages.length > 0 && (
                      <span style={{ fontSize: "0.7rem", color: "#00FFFF", border: "1px solid rgba(0,255,255,0.25)", padding: "0.15rem 0.5rem", borderRadius: "9999px" }}>
                        {vaultImages.length} shards
                      </span>
                    )}
                    {selectedIds.size > 0 && (
                      <span style={{ fontSize: "0.7rem", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)", padding: "0.15rem 0.5rem", borderRadius: "9999px" }}>
                        {selectedIds.size} selected
                      </span>
                    )}
                    <div style={{ flex: 1, height: "1px", background: "linear-gradient(to right, rgba(255,255,255,0.08), transparent)" }} />
                    <button
                      onClick={refreshData} disabled={isRefreshing}
                      style={{
                        display: "flex", alignItems: "center", gap: "0.35rem",
                        padding: "0.28rem 0.65rem", borderRadius: "7px",
                        background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                        color: isRefreshing ? "rgba(0,255,255,0.5)" : "rgba(255,255,255,0.45)",
                        fontSize: "0.72rem", cursor: isRefreshing ? "wait" : "pointer",
                      }}
                    >
                      <RefreshCw size={11} style={{ animation: isRefreshing ? "spin 0.9s linear infinite" : "none" }} />
                      Refresh
                    </button>
                  </div>

                  {noShardsYet ? (
                    /* Empty state */
                    <div style={{
                      textAlign: "center", padding: "3.5rem 2rem",
                      borderRadius: "14px", border: "1px dashed rgba(255,255,255,0.08)",
                      background: "rgba(10,10,20,0.35)", backdropFilter: "blur(6px)",
                    }}>
                      <div style={{ fontSize: "2rem", marginBottom: "0.75rem", color: "rgba(0,255,255,0.3)" }}>⊘</div>
                      <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em", marginBottom: "0.4rem" }}>
                        No shards yet
                      </p>
                      <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.2)", lineHeight: 1.6 }}>
                        Embed a file on the left — the resulting shard images will appear here. Select any 3 to recover your file later.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Instruction */}
                      <p style={{ fontFamily: "monospace", fontSize: "0.62rem", color: "rgba(255,255,255,0.25)", marginBottom: "0.9rem", letterSpacing: "0.08em" }}>
                        Click images to select · need {selectedGroup?.threshold ?? 3} from same file to recover
                      </p>

                      {/* File filter tabs */}
                      {fileGroups.length > 1 && (
                        <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1rem", flexWrap: "wrap" }}>
                          <button
                            onClick={() => setFilterFileId("all")}
                            style={{
                              padding: "0.3rem 0.75rem", borderRadius: "9999px", fontSize: "0.75rem",
                              border: `1px solid ${filterFileId === "all" ? "#00FFFF" : "rgba(255,255,255,0.1)"}`,
                              background: filterFileId === "all" ? "rgba(0,255,255,0.1)" : "transparent",
                              color: filterFileId === "all" ? "#00FFFF" : "rgba(255,255,255,0.4)",
                              cursor: "pointer",
                            }}
                          >All</button>
                          {fileGroups.map((g) => (
                            <button
                              key={g.fileId}
                              onClick={() => setFilterFileId(g.fileId === filterFileId ? "all" : g.fileId)}
                              style={{
                                padding: "0.3rem 0.75rem", borderRadius: "9999px", fontSize: "0.75rem",
                                border: `1px solid ${filterFileId === g.fileId ? `${g.color}80` : "rgba(255,255,255,0.1)"}`,
                                background: filterFileId === g.fileId ? `${g.color}12` : "transparent",
                                color: filterFileId === g.fileId ? g.color : "rgba(255,255,255,0.4)",
                                cursor: "pointer", display: "flex", alignItems: "center", gap: "0.35rem",
                              }}
                            >
                              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: g.color, display: "inline-block" }} />
                              {g.fileName}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Shard grid */}
                      <div className="shard-grid">
                        <AnimatePresence>
                          {filteredImages.map((image) => {
                            const group = fileGroups.find((g) => g.fileId === image.fileId)!;
                            return (
                              <ShardCard
                                key={image.id}
                                image={image}
                                group={group}
                                isSelected={selectedIds.has(image.id)}
                                isAnimating={recoveryStatus === "animating"}
                                onClick={() => toggleSelect(image.id)}
                                onDelete={() => handleDeleteShard(image.id)}
                              />
                            );
                          })}
                        </AnimatePresence>
                      </div>

                      {/* File legend */}
                      {fileGroups.length > 0 && (
                        <div style={{
                          marginTop: "2rem", padding: "1rem 1.25rem", borderRadius: "12px",
                          background: "rgba(10,10,20,0.5)", backdropFilter: "blur(8px)",
                          border: "1px solid rgba(255,255,255,0.07)",
                        }}>
                          <p style={{ fontSize: "0.72rem", fontWeight: 600, color: "#AAAAAA", marginBottom: "0.75rem" }}>Embedded Files</p>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                            {fileGroups.map((g) => (
                              <div key={g.fileId} style={{ display: "flex", alignItems: "center", gap: "0.75rem", justifyContent: "space-between" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", minWidth: 0 }}>
                                  <div style={{ width: "9px", height: "9px", borderRadius: "2px", background: g.color, boxShadow: `0 0 8px ${g.glowColor}`, flexShrink: 0 }} />
                                  <span style={{ fontSize: "0.82rem", color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.fileName}</span>
                                  <span style={{ fontSize: "0.68rem", color: "#AAAAAA", flexShrink: 0 }}>
                                    k={g.threshold} of {g.totalShards}
                                  </span>
                                </div>
                                <button
                                  onClick={() => handleDeleteFile(g.fileId)}
                                  style={{
                                    padding: "0.25rem 0.55rem", borderRadius: "7px",
                                    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
                                    color: "#f87171", fontSize: "0.72rem", cursor: "pointer", flexShrink: 0,
                                  }}
                                >Delete</button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              </div>

            </div>
          </div>
        </main>

        {/* Recovery animation */}
        <AnimatePresence>
          {showRecoveryAnim && selectedGroup && (
            <RecoveryAnimation
              key="recovery-anim"
              selectedImages={selectedImages}
              group={selectedGroup}
              onComplete={onAnimationComplete}
            />
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
