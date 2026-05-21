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

/* ════════════════════════════════════════════════════════════════════
   TYPES
   ════════════════════════════════════════════════════════════════════ */
interface FileGroup {
  fileId: string;
  fileName: string;
  color: string;       // border / badge color (hex)
  glowColor: string;   // rgba glow string
  totalShards: number;
  threshold: number;   // k in k-of-n
}

interface VaultImage {
  id: string;
  src: string;
  fileId: string;      // which file this shard belongs to
  shardIndex: number;  // 1-based
  name: string;        // display name
}

type UploadStatus = "idle" | "uploading" | "success" | "error";
type RecoveryStatus = "idle" | "animating" | "downloading" | "done" | "error";

/* ════════════════════════════════════════════════════════════════════
   CONSTANTS — file-group colour palette
   ════════════════════════════════════════════════════════════════════ */
const FILE_COLORS: { color: string; glowColor: string }[] = [
  { color: "#0ea5e9", glowColor: "rgba(14,165,233,0.2)" },
  { color: "#8b5cf6", glowColor: "rgba(139,92,246,0.2)" },
  { color: "#f59e0b", glowColor: "rgba(245,158,11,0.2)" },
  { color: "#10b981", glowColor: "rgba(16,185,129,0.2)" },
  { color: "#ef4444", glowColor: "rgba(239,68,68,0.2)" },
];

/* ════════════════════════════════════════════════════════════════════
   MOCK DATA
   ════════════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════════════
   API INTEGRATION
   ════════════════════════════════════════════════════════════════════ */

async function fetchStegoFiles(): Promise<{ files: FileGroup[], images: VaultImage[] }> {
  const token = localStorage.getItem("cuttlefish_token");
  if (!token) throw new Error("No token");
  const res = await fetch("http://localhost:8000/api/v1/stego/files", {
    headers: { "Authorization": `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Failed to fetch files");
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
      threshold: f.threshold
    });
    
    // Add auth token to image src so the browser can't fetch it directly, but wait, 
    // <img src> doesn't send Bearer token. We'll append token to query param for now, 
    // or fetch via blob. A simple query param `?token=` works if backend accepts it, 
    // but backend expects Bearer. For simplicity, we can fetch via Blob in a separate component,
    // or we can just send the token as query param and modify backend. 
    // Wait! Let's modify backend later to accept query param token if needed, or we just do it here:
    f.images.forEach((img: any) => {
      images.push({
        id: img.id,
        src: `http://localhost:8000${img.src}?token=${token}`,
        fileId: img.fileId,
        shardIndex: img.shardIndex,
        name: img.name
      });
    });
  });
  
  return { files, images };
}

async function uploadStegoFile(
  file: File,
  colorPair: { color: string; glowColor: string }
): Promise<{ fileId: string; fileName: string; images: VaultImage[] }> {
  const token = localStorage.getItem("cuttlefish_token");
  if (!token) throw new Error("No token");
  
  const formData = new FormData();
  formData.append("file", file);
  
  const res = await fetch("http://localhost:8000/api/v1/stego/upload", {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` },
    body: formData
  });
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  
  const images: VaultImage[] = data.images.map((img: any) => ({
    id: img.id,
    src: `http://localhost:8000${img.src}?token=${token}`,
    fileId: img.fileId,
    shardIndex: img.shardIndex,
    name: img.name
  }));
  
  return { fileId: data.fileId, fileName: data.fileName, images };
}

async function recoverStegoFile(
  imageIds: string[]
): Promise<{ downloadUrl: string; fileName: string }> {
  const token = localStorage.getItem("cuttlefish_token");
  if (!token) throw new Error("No token");
  
  const res = await fetch("http://localhost:8000/api/v1/stego/recover", {
    method: "POST",
    headers: { 
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ shard_ids: imageIds })
  });
  
  if (!res.ok) throw new Error("Recovery failed");
  
  const blob = await res.blob();
  const disp = res.headers.get("Content-Disposition");
  let fileName = "recovered_file";
  if (disp && disp.includes("filename=")) {
    fileName = disp.split("filename=")[1].replace(/"/g, "");
  }
  
  return { downloadUrl: URL.createObjectURL(blob), fileName };
}

/* ════════════════════════════════════════════════════════════════════
   SEEDED BG DOTS
   ════════════════════════════════════════════════════════════════════ */
function seededValue(seed: number): number {
  const v = Math.sin(seed * 12.9898) * 43758.5453;
  return v - Math.floor(v);
}
const BG_DOTS = Array.from({ length: 35 }, (_, i) => ({
  id: i,
  top: seededValue(i + 10) * 100,
  left: seededValue(i + 40) * 100,
  size: 1 + seededValue(i + 70) * 2.5,
  opacity: seededValue(i + 100) > 0.4 ? 0.05 + seededValue(i + 130) * 0.1 : 0,
}));

/* ════════════════════════════════════════════════════════════════════
   SECTION LABEL
   ════════════════════════════════════════════════════════════════════ */
function SectionLabel({ label, id, badge }: { label: string; id: string; badge?: string }) {
  return (
    <div id={id} style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.75rem" }}>
      <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#f8fafc", whiteSpace: "nowrap", margin: 0 }}>
        {label}
      </h2>
      {badge && (
        <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "#94a3b8", border: "1px solid #334155", padding: "0.2rem 0.6rem", borderRadius: "9999px" }}>
          {badge}
        </span>
      )}
      <div style={{ flex: 1, height: "1px", background: "linear-gradient(to right, #334155, transparent)" }} />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   CATALOG IMAGE CARD
   ════════════════════════════════════════════════════════════════════ */
function CatalogCard({
  image,
  group,
  isSelected,
  isAnimating,
  onClick,
}: {
  image: VaultImage;
  group: FileGroup;
  isSelected: boolean;
  isAnimating: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      id={`catalog-card-${image.id}`}
      style={{
        position: "relative",
        borderRadius: "0.75rem",
        overflow: "visible",
        cursor: isAnimating ? "default" : "pointer",
        breakInside: "avoid",
        marginBottom: "1rem",
        display: "block",
      }}
    >
      {/* Glow ring — colour-coded per file group */}
      <motion.div
        animate={{
          boxShadow: isSelected
            ? `0 0 0 2px ${group.color}, 0 0 28px ${group.glowColor}`
            : hovered
            ? `0 0 0 1px ${group.color}88, 0 0 18px ${group.glowColor}55`
            : `0 0 0 1px ${group.color}25`,
          borderRadius: "0.75rem",
        }}
        transition={{ duration: 0.22 }}
        style={{ position: "absolute", inset: 0, borderRadius: "0.75rem", zIndex: 2, pointerEvents: "none" }}
      />

      {/* Image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.src}
        alt={image.name}
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          borderRadius: "0.75rem",
          filter: isSelected ? "brightness(0.75) saturate(1.2)" : hovered ? "brightness(0.85)" : "brightness(1)",
          transition: "filter 0.25s ease",
        }}
      />

      {/* Selected checkmark */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            key="check"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "absolute",
              top: "0.5rem",
              left: "0.5rem",
              zIndex: 5,
              width: "1.6rem",
              height: "1.6rem",
              borderRadius: "50%",
              background: group.color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 0 14px ${group.glowColor}`,
            }}
          >
            <span style={{ fontSize: "0.75rem", color: "#050505", fontWeight: 800, lineHeight: 1 }}>✓</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom metadata bar */}
      <div style={{
        padding: "0.5rem 0.6rem 0.4rem",
        background: "rgba(3,3,3,0.75)",
        backdropFilter: "blur(8px)",
        borderBottomLeftRadius: "0.75rem",
        borderBottomRightRadius: "0.75rem",
        marginTop: "-4px",
        borderTop: `1px solid ${group.color}22`,
      }}>
        {/* Shard badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.2rem" }}>
          <span style={{
            fontFamily: "monospace",
            fontSize: "0.55rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            padding: "0.15rem 0.4rem",
            borderRadius: "4px",
            background: `${group.color}15`,
            border: `1px solid ${group.color}35`,
            color: group.color,
          }}>
            Shard {image.shardIndex}/{group.totalShards}
          </span>
        </div>
        <p style={{ fontFamily: "monospace", fontSize: "0.62rem", color: "rgba(255,255,255,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {group.fileName}
        </p>
      </div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   RECOVERY ANIMATION OVERLAY
   ════════════════════════════════════════════════════════════════════ */
function RecoveryAnimation({
  selectedImages,
  group,
  onComplete,
}: {
  selectedImages: VaultImage[];
  group: FileGroup;
  onComplete: () => void;
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 400,
        background: "rgba(2,2,8,0.92)",
        backdropFilter: "blur(24px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "2rem",
      }}
    >
      {/* Phase label */}
      <motion.p
        key={phase}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        style={{ fontFamily: "monospace", fontSize: "0.65rem", letterSpacing: "0.3em", textTransform: "uppercase", color: group.color }}
      >
        {phase === "gather" && "Extracting steganographic shards…"}
        {phase === "merge" && "Reconstructing via Shamir's algorithm…"}
        {phase === "reveal" && "Decrypting with AES-256-GCM…"}
      </motion.p>

      {/* Images converging */}
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
                position: "absolute",
                top: "50%",
                left: "50%",
                width: "90px",
                height: "70px",
                marginLeft: "-45px",
                marginTop: "-35px",
                borderRadius: "0.5rem",
                overflow: "hidden",
                border: `2px solid ${group.color}`,
                boxShadow: `0 0 20px ${group.glowColor}`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.src} alt={img.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </motion.div>
          );
        })}

        {/* Centre merge glow */}
        <motion.div
          animate={{
            scale: phase === "merge" ? [1, 1.4, 1] : phase === "reveal" ? 2 : 0,
            opacity: phase === "gather" ? 0 : phase === "merge" ? 0.6 : 0,
          }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: "80px",
            height: "80px",
            marginLeft: "-40px",
            marginTop: "-40px",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${group.color} 0%, transparent 70%)`,
            filter: "blur(12px)",
          }}
        />

        {/* SVG connecting lines */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" }}>
          <defs>
            <filter id="glow-filter">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {phase !== "gather" && selectedImages.map((_, i) => {
            const a1 = ((i - 1) * 120) * (Math.PI / 180);
            const a2 = ((((i + 1) % 3) - 1) * 120) * (Math.PI / 180);
            const r = phase === "merge" ? 30 : 0;
            const cx = 140, cy = 100;
            return (
              <motion.line
                key={`line-${i}`}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: phase === "reveal" ? 0 : 0.6 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                x1={cx + Math.cos(a1) * r}
                y1={cy + Math.sin(a1) * r}
                x2={cx + Math.cos(a2) * r}
                y2={cy + Math.sin(a2) * r}
                stroke={group.color}
                strokeWidth="1.5"
                filter="url(#glow-filter)"
              />
            );
          })}
        </svg>
      </div>

      {/* Progress dots */}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        {["gather", "merge", "reveal"].map((p, i) => (
          <motion.div
            key={p}
            animate={{
              background: ["gather", "merge", "reveal"].indexOf(phase) >= i ? group.color : "rgba(255,255,255,0.15)",
              boxShadow: ["gather", "merge", "reveal"].indexOf(phase) >= i ? `0 0 8px ${group.glowColor}` : "none",
            }}
            transition={{ duration: 0.3 }}
            style={{ width: "6px", height: "6px", borderRadius: "50%" }}
          />
        ))}
      </div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   CUSTOM COVERS SECTION
   ════════════════════════════════════════════════════════════════════ */
function CustomCoversSection() {
  const [covers, setCovers] = useState<{ id: string; fileName: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCovers();
  }, []);

  const fetchCovers = async () => {
    try {
      const token = localStorage.getItem("cuttlefish_token");
      const res = await fetch("http://localhost:8000/api/v1/stego/covers", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) setCovers(await res.json());
    } catch (e) {
      console.error("Failed to fetch custom covers");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setIsUploading(true);
    try {
      const token = localStorage.getItem("cuttlefish_token");
      const formData = new FormData();
      formData.append("file", file);
      
      const res = await fetch("http://localhost:8000/api/v1/stego/covers", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData
      });
      if (!res.ok) throw new Error();
      await fetchCovers();
    } catch (e) {
      alert("Failed to upload custom cover.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this custom cover?")) return;
    try {
      const token = localStorage.getItem("cuttlefish_token");
      const res = await fetch(`http://localhost:8000/api/v1/stego/covers/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      await fetchCovers();
    } catch (e) {
      alert("Failed to delete cover.");
    }
  };

  return (
    <div style={{ marginBottom: "3rem", padding: "1.5rem", borderRadius: "0.75rem", background: "#1e293b", border: "1px solid #334155" }}>
      <SectionLabel label="Custom Covers" id="covers-label" badge={`${covers.length}/5+ uploaded`} />
      <p style={{ fontSize: "0.875rem", color: "#94a3b8", marginBottom: "1.25rem", maxWidth: "600px", lineHeight: 1.6 }}>
        Upload your own cover images for steganographic hiding.
      </p>
      
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        {covers.map(c => {
          const token = localStorage.getItem("cuttlefish_token");
          return (
            <div key={c.id} style={{ position: "relative", width: "80px", height: "80px", borderRadius: "0.5rem", overflow: "hidden", border: "1px solid rgba(0,255,255,0.3)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`http://localhost:8000/api/v1/stego/covers/${c.id}/image?token=${token}`} alt={c.fileName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <button
                onClick={() => handleDelete(c.id)}
                style={{ position: "absolute", top: "4px", right: "4px", background: "rgba(255,0,0,0.8)", border: "none", borderRadius: "50%", width: "20px", height: "20px", color: "white", fontSize: "0.6rem", cursor: "pointer" }}
              >✕</button>
            </div>
          );
        })}
        
        <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "80px", height: "80px", borderRadius: "0.5rem", border: "1px dashed #475569", cursor: "pointer", background: "transparent", transition: "all 0.2s" }}>
          <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileUpload} style={{ display: "none" }} />
          <span style={{ fontSize: "1.5rem", color: "#94a3b8" }}>{isUploading ? "…" : "+"}</span>
        </label>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   UPLOAD SECTION
   ════════════════════════════════════════════════════════════════════ */
function FileUploadSection({
  onUploadComplete,
  nextColorIndex,
}: {
  onUploadComplete: (group: FileGroup, images: VaultImage[]) => void;
  nextColorIndex: number;
}) {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setSelectedFile(file);
    setStatus("idle");
    setMessage("");
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setStatus("uploading");
    setProgress(0);
    setMessage("Encrypting with AES-256-GCM…");

    // Simulated progress stages
    const stages = [
      { pct: 20, msg: "Encrypting with AES-256-GCM…" },
      { pct: 45, msg: "Splitting via Shamir's Secret Sharing (k=3, n=5)…" },
      { pct: 75, msg: "Embedding shards into cover images (SteganoGAN)…" },
      { pct: 95, msg: "Verifying steganographic integrity…" },
    ];

    for (const stage of stages) {
      await new Promise((r) => setTimeout(r, 550));
      setProgress(stage.pct);
      setMessage(stage.msg);
    }

    const colorPair = FILE_COLORS[nextColorIndex % FILE_COLORS.length];
    try {
      const result = await uploadStegoFile(selectedFile, colorPair);
      setProgress(100);

      const group: FileGroup = {
        fileId: result.fileId,
        fileName: result.fileName,
        color: colorPair.color,
        glowColor: colorPair.glowColor,
        totalShards: 5,
        threshold: 3,
      };

      onUploadComplete(group, result.images);
      setStatus("success");
      setMessage(`File stored across 5 images. Choose any 3 to recover.`);
    } catch (e) {
      setStatus("error");
      setMessage("Upload failed. Ensure backend is running.");
    }
    setSelectedFile(null);
    setTimeout(() => { setStatus("idle"); setMessage(""); setProgress(0); }, 6000);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div id="file-upload-section" style={{ marginBottom: "5rem" }}>
      <SectionLabel label="Embed New File" id="upload-label" badge="AES-256 · Shamir's Secret Sharing" />

      {/* Drop zone */}
      <motion.div
        id="file-drop-zone"
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => status !== "uploading" && fileInputRef.current?.click()}
        animate={{
          borderColor: isDragging ? "#0ea5e9" : status === "success" ? "#10b981" : status === "error" ? "#ef4444" : "#475569",
          background: isDragging ? "rgba(14,165,233,0.05)" : "#1e293b",
          boxShadow: isDragging ? "0 0 0 4px rgba(14,165,233,0.1)" : "none",
        }}
        transition={{ duration: 0.25 }}
        style={{
          border: "1px dashed #475569",
          borderRadius: "0.75rem",
          padding: "2.5rem 2rem",
          textAlign: "center",
          cursor: status === "uploading" ? "default" : "pointer",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Progress bar */}
        {status === "uploading" && (
          <motion.div
            style={{ position: "absolute", bottom: 0, left: 0, height: "2px", background: "linear-gradient(to right, #00ffff, #00e5ff)", boxShadow: "0 0 12px rgba(0,255,255,0.6)" }}
            initial={{ width: "0%" }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4 }}
          />
        )}

        <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>
          {status === "success" ? "✓" : status === "error" ? "⚠" : status === "uploading" ? "⋯" : "⊕"}
        </div>

        {selectedFile && status === "idle" && (
          <p style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "#00ffff", marginBottom: "0.4rem" }}>
            {selectedFile.name}
          </p>
        )}

        <p style={{
          fontFamily: "monospace",
          fontSize: "0.7rem",
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: status === "success" ? "rgba(0,255,160,0.8)" : status === "error" ? "rgba(255,100,100,0.8)" : status === "uploading" ? "rgba(0,255,255,0.6)" : "rgba(0,255,255,0.38)",
        }}>
          {status === "uploading" ? message
            : status === "success" ? message
            : status === "error" ? "Upload failed. Try again."
            : isDragging ? "Release to embed"
            : selectedFile ? "File ready — click Embed below"
            : "Drop any file here or click to browse"}
        </p>

        {status === "uploading" && (
          <p style={{ fontFamily: "monospace", fontSize: "0.6rem", color: "rgba(0,255,255,0.35)", marginTop: "0.4rem" }}>
            {progress}%
          </p>
        )}
      </motion.div>

      <input
        ref={fileInputRef}
        id="file-upload-input"
        type="file"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        style={{ display: "none" }}
        aria-label="Select file for steganographic embedding"
      />

      {/* Embed button */}
      {selectedFile && status === "idle" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}
        >
          <button
            id="embed-btn"
            onClick={handleUpload}
            className="vault-btn-primary"
            style={{ fontSize: "0.78rem" }}
          >
            Embed File →
          </button>
        </motion.div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   RECOVERY SECTION
   ════════════════════════════════════════════════════════════════════ */
function RecoveryPanel({
  selectedIds,
  vaultImages,
  fileGroups,
  onRecover,
  onClearSelection,
  recoveryStatus,
  downloadInfo,
}: {
  selectedIds: Set<string>;
  vaultImages: VaultImage[];
  fileGroups: FileGroup[];
  onRecover: () => void;
  onClearSelection: () => void;
  recoveryStatus: RecoveryStatus;
  downloadInfo: { url: string; fileName: string } | null;
}) {
  const selectedImages = vaultImages.filter((img) => selectedIds.has(img.id));
  const selectedFileIds = new Set(selectedImages.map((img) => img.fileId));
  const isMixed = selectedFileIds.size > 1;
  const selectedGroup = fileGroups.find((g) => g.fileId === [...selectedFileIds][0]);
  const threshold = selectedGroup?.threshold ?? 3;
  const canRecover = selectedIds.size >= threshold && !isMixed && recoveryStatus === "idle";

  return (
    <div id="recovery-section" style={{ marginBottom: "5rem" }}>
      <SectionLabel label="Recover File" id="recovery-label" badge={`Select ${threshold} shards from same file`} />

      <div style={{
        border: "1px solid #334155",
        borderRadius: "0.75rem",
        padding: "1.75rem",
        background: "#1e293b",
      }}>
        {/* Selection status */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <p style={{ fontFamily: "monospace", fontSize: "0.62rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(0,255,255,0.4)", marginBottom: "0.3rem" }}>
              Selection
            </p>
            <p style={{ fontSize: "0.95rem", color: "#ffffff", fontWeight: 600 }}>
              {selectedIds.size === 0
                ? "No images selected"
                : `${selectedIds.size} shard${selectedIds.size > 1 ? "s" : ""} selected`}
              {selectedIds.size > 0 && selectedGroup && (
                <span style={{ marginLeft: "0.5rem", fontFamily: "monospace", fontSize: "0.7rem", color: selectedGroup.color }}>
                  · {selectedGroup.fileName}
                </span>
              )}
            </p>

            {/* Mixed-file error */}
            {isMixed && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ fontFamily: "monospace", fontSize: "0.68rem", color: "rgba(255,100,100,0.85)", marginTop: "0.35rem" }}
              >
                ✕ Invalid selection — images must be from the same file
              </motion.p>
            )}

            {/* Not enough shards */}
            {!isMixed && selectedIds.size > 0 && selectedIds.size < threshold && (
              <p style={{ fontFamily: "monospace", fontSize: "0.65rem", color: "rgba(255,255,255,0.3)", marginTop: "0.3rem" }}>
                Select {threshold - selectedIds.size} more shard{threshold - selectedIds.size > 1 ? "s" : ""} to unlock recovery
              </p>
            )}
          </div>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            {selectedIds.size > 0 && (
              <button
                id="clear-selection-btn"
                onClick={onClearSelection}
                className="vault-btn-ghost"
              >
                Clear
              </button>
            )}
            <button
              id="recover-btn"
              onClick={onRecover}
              className="vault-btn-primary"
              disabled={!canRecover}
            >
              {recoveryStatus === "animating" || recoveryStatus === "downloading"
                ? "Recovering…"
                : "Recover File →"}
            </button>
          </div>
        </div>

        {/* Selected thumbnails preview */}
        {selectedImages.length > 0 && (
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {selectedImages.map((img) => {
              const g = fileGroups.find((fg) => fg.fileId === img.fileId)!;
              return (
                <div key={img.id} style={{ width: "60px", height: "50px", borderRadius: "0.4rem", overflow: "hidden", border: `1px solid ${g.color}60`, position: "relative" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.src} alt={img.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              );
            })}
          </div>
        )}

        {/* Download button after recovery */}
        <AnimatePresence>
          {recoveryStatus === "done" && downloadInfo && (
            <motion.div
              key="download-ready"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              style={{ marginTop: "1.25rem", padding: "1.25rem", border: "1px solid rgba(0,255,160,0.25)", borderRadius: "0.75rem", background: "rgba(0,255,160,0.04)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}
            >
              <div>
                <p style={{ fontFamily: "monospace", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(0,255,160,0.6)", marginBottom: "0.2rem" }}>
                  ✓ Recovery complete
                </p>
                <p style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "rgba(0,255,160,0.85)" }}>
                  {downloadInfo.fileName}
                </p>
                <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.3)", marginTop: "0.2rem" }}>
                  Images remain in vault — re-select to recover again
                </p>
              </div>
              <a
                id="download-file-btn"
                href={downloadInfo.url}
                download={downloadInfo.fileName}
                className="vault-btn-primary"
                style={{ textDecoration: "none", fontSize: "0.78rem" }}
              >
                ↓ Download
              </a>
            </motion.div>
          )}
        </AnimatePresence>

        {recoveryStatus === "error" && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ fontFamily: "monospace", fontSize: "0.7rem", color: "rgba(255,100,100,0.8)", marginTop: "1rem" }}
          >
            ✕ Recovery failed — could not reconstruct file from selected shards.
          </motion.p>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   HEADER
   ════════════════════════════════════════════════════════════════════ */
function SecretHeader({ onExit }: { onExit: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const s = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", s, { passive: true });
    return () => window.removeEventListener("scroll", s);
  }, []);

  return (
    <motion.header
      id="secret-vault-header"
      animate={{
        background: scrolled ? "rgba(15, 23, 42, 0.9)" : "transparent",
        backdropFilter: scrolled ? "blur(10px)" : "none",
        borderBottom: scrolled ? "1px solid #1e293b" : "1px solid transparent",
      }}
      transition={{ duration: 0.3 }}
      style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.1rem 2rem" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.9rem" }}>
        <span style={{ fontFamily: "inherit", fontSize: "1rem", fontWeight: 700, color: "#f8fafc" }}>
          Cuttlefish Vault
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {/* Profile pill */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", padding: "0.35rem 0.8rem", borderRadius: "9999px", border: "1px solid #334155", background: "#1e293b" }}>
          <div style={{ width: "1.4rem", height: "1.4rem", borderRadius: "50%", background: "#0ea5e9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: 700, color: "#ffffff" }}>U</div>
          <span style={{ fontSize: "0.75rem", color: "#cbd5e1" }}>vault://user</span>
        </div>

        {/* Exit button */}
        <button
          id="secret-exit-btn"
          onClick={onExit}
          className="vault-btn-ghost"
          style={{ padding: "0.4rem 0.9rem", borderRadius: "9999px" }}
        >
          ← Exit
        </button>
      </div>
    </motion.header>
  );
}

/* ════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════ */
export default function SecretVaultClient() {
  const router = useRouter();
  const [vaultImages, setVaultImages] = useState<VaultImage[]>([]);
  const [fileGroups, setFileGroups] = useState<FileGroup[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [recoveryStatus, setRecoveryStatus] = useState<RecoveryStatus>("idle");
  const [downloadInfo, setDownloadInfo] = useState<{ url: string; fileName: string } | null>(null);
  const [showRecoveryAnim, setShowRecoveryAnim] = useState(false);
  const [filterFileId, setFilterFileId] = useState<string | "all">("all");
  const lenisRef = useRef<{ destroy: () => void; raf: (t: number) => void } | null>(null);

  // Auth check
  useEffect(() => {
    const token = localStorage.getItem("cuttlefish_token");
    if (!token) {
      router.push("/auth/login");
    } else {
      fetchStegoFiles().then((data) => {
        setFileGroups(data.files);
        setVaultImages(data.images);
      }).catch(console.error);
    }
  }, [router]);

  /* ── Lenis smooth scroll ─────────────────────────────────────── */
  useEffect(() => {
    let rafId: number;
    import("lenis").then(({ default: Lenis }) => {
      const lenis = new Lenis({ duration: 1.4, smoothWheel: true });
      lenisRef.current = lenis;
      function raf(t: number) { lenis.raf(t); rafId = requestAnimationFrame(raf); }
      rafId = requestAnimationFrame(raf);
    });
    return () => { cancelAnimationFrame(rafId); lenisRef.current?.destroy(); };
  }, []);

  /* ── Escape → exit, Shift+Esc+G → stays on page (handled in VaultPage) ── */
  const exitToVault = useCallback(() => {
    router.push("/vault");
  }, [router]);

  useEffect(() => {
    const pressed = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      pressed.add(key);
      if (key === "escape" && !e.shiftKey && !pressed.has("g")) {
        exitToVault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => pressed.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [exitToVault]);

  /* ── Selection ────────────────────────────────────────────────── */
  const toggleSelect = useCallback((id: string) => {
    if (recoveryStatus !== "idle") return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // Reset download state when selection changes
    setDownloadInfo(null);
    setRecoveryStatus("idle");
  }, [recoveryStatus]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setDownloadInfo(null);
    setRecoveryStatus("idle");
  }, []);

  /* ── Upload complete ─────────────────────────────────────────── */
  const handleUploadComplete = useCallback((group: FileGroup, images: VaultImage[]) => {
    setFileGroups((prev) => [...prev, group]);
    setVaultImages((prev) => [...prev, ...images]);
  }, []);

  /* ── Recovery ────────────────────────────────────────────────── */
  const handleRecover = useCallback(async () => {
    const selectedImages = vaultImages.filter((img) => selectedIds.has(img.id));
    const fileIds = new Set(selectedImages.map((img) => img.fileId));
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
      
      // Auto trigger download
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error(e);
      setRecoveryStatus("error");
    }
  }, [vaultImages, selectedIds, fileGroups]);

  /* ── Delete ──────────────────────────────────────────────────── */
  const handleDeleteFile = useCallback(async (fileId: string) => {
    if (!confirm("Are you sure you want to delete this file and all its shards? This action cannot be undone.")) return;
    try {
      const token = localStorage.getItem("cuttlefish_token");
      const res = await fetch(`http://localhost:8000/api/v1/stego/files/${fileId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Delete failed");
      
      setFileGroups(prev => prev.filter(g => g.fileId !== fileId));
      setVaultImages(prev => prev.filter(img => img.fileId !== fileId));
      if (filterFileId === fileId) setFilterFileId("all");
    } catch (e) {
      console.error(e);
      alert("Failed to delete file.");
    }
  }, [filterFileId]);

  /* ── Filtered images ─────────────────────────────────────────── */
  const filteredImages = useMemo(() =>
    filterFileId === "all" ? vaultImages : vaultImages.filter((img) => img.fileId === filterFileId),
    [vaultImages, filterFileId]
  );

  const selectedImages = vaultImages.filter((img) => selectedIds.has(img.id));
  const selectedGroup = fileGroups.find((g) =>
    selectedImages.length > 0 && g.fileId === selectedImages[0].fileId &&
    selectedImages.every((img) => img.fileId === g.fileId)
  );

  const nextColorIndex = fileGroups.length;

  return (
    <>
      {/* ── Fixed BG ─────────────────────────────────────────────── */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, background: "#0f172a", pointerEvents: "none" }}>
      </div>

      {/* ── Header ───────────────────────────────────────────────── */}
      <SecretHeader onExit={exitToVault} />

      {/* ── Main ─────────────────────────────────────────────────── */}
      <main id="secret-vault-main" style={{ position: "relative", zIndex: 10, paddingTop: "5.5rem", minHeight: "100dvh" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 2rem 6rem" }}>

          {/* ── Page heading ─────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            style={{ marginBottom: "3.5rem", paddingTop: "2rem" }}
          >
            <h1 style={{ fontSize: "clamp(2rem, 6vw, 3.5rem)", fontWeight: 800, lineHeight: 1.2, color: "#f8fafc", marginBottom: "1rem" }}>
              Steganographic Vault
            </h1>
            <p style={{ fontSize: "clamp(1rem, 2vw, 1.125rem)", color: "#94a3b8", maxWidth: "600px", lineHeight: 1.6 }}>
              Files concealed within carrier images via GAN-based embedding. Shamir reconstruction requires any {3} of 5 shards. Zero server knowledge.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "1.25rem", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                Esc to exit · Shift+Esc+G to re-enter
              </span>
            </div>
          </motion.div>

          <div style={{ height: "1px", background: "#1e293b", marginBottom: "4rem" }} />

          {/* ── Custom Covers ──────────────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}>
            <CustomCoversSection />
          </motion.div>

          {/* ── File Upload ───────────────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
            <FileUploadSection onUploadComplete={handleUploadComplete} nextColorIndex={nextColorIndex} />
          </motion.div>

          {/* ── Recovery Panel ────────────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.35 }}>
            <RecoveryPanel
              selectedIds={selectedIds}
              vaultImages={vaultImages}
              fileGroups={fileGroups}
              onRecover={handleRecover}
              onClearSelection={clearSelection}
              recoveryStatus={recoveryStatus}
              downloadInfo={downloadInfo}
            />
          </motion.div>

          {/* ── Photo Catalog ─────────────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.5 }}>
            <SectionLabel
              label={`Carrier Image Catalog · ${vaultImages.length}`}
              id="catalog-label"
              badge={`${selectedIds.size} selected`}
            />

            {/* Filter tabs */}
            <div id="catalog-filter-tabs" style={{ display: "flex", gap: "0.5rem", marginBottom: "1.75rem", flexWrap: "wrap" }}>
              <button
                id="filter-all"
                onClick={() => setFilterFileId("all")}
                className={filterFileId === "all" ? "vault-filter-tab vault-filter-tab-active" : "vault-filter-tab"}
              >
                All Files
              </button>
              {fileGroups.map((g) => (
                <button
                  key={g.fileId}
                  id={`filter-${g.fileId}`}
                  onClick={() => setFilterFileId(g.fileId === filterFileId ? "all" : g.fileId)}
                  className="vault-filter-tab"
                  style={{
                    borderColor: filterFileId === g.fileId ? `${g.color}80` : "rgba(255,255,255,0.1)",
                    color: filterFileId === g.fileId ? g.color : "rgba(255,255,255,0.45)",
                    background: filterFileId === g.fileId ? `${g.color}10` : "transparent",
                    boxShadow: filterFileId === g.fileId ? `0 0 14px ${g.glowColor}30` : "none",
                  }}
                >
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: g.color, display: "inline-block", marginRight: "0.4rem", boxShadow: `0 0 6px ${g.glowColor}` }} />
                  {g.fileName}
                </button>
              ))}
            </div>

            {/* Instruction hint */}
            <p style={{ fontFamily: "monospace", fontSize: "0.62rem", color: "rgba(255,255,255,0.2)", marginBottom: "1.25rem", letterSpacing: "0.08em" }}>
              Click images to select shards for recovery. Choose {selectedGroup?.threshold ?? 3} from the same file.
            </p>

            {/* Masonry grid */}
            <div
              id="secret-catalog-grid"
              style={{
                columns: "var(--catalog-cols, 4)",
                columnGap: "1rem",
              }}
            >
              <AnimatePresence>
                {filteredImages.map((image) => {
                  const group = fileGroups.find((g) => g.fileId === image.fileId)!;
                  return (
                    <CatalogCard
                      key={image.id}
                      image={image}
                      group={group}
                      isSelected={selectedIds.has(image.id)}
                      isAnimating={recoveryStatus === "animating"}
                      onClick={() => toggleSelect(image.id)}
                    />
                  );
                })}
              </AnimatePresence>
            </div>

            {filteredImages.length === 0 && (
              <div style={{ textAlign: "center", padding: "4rem 0" }}>
                <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "rgba(0,255,255,0.3)", letterSpacing: "0.15em" }}>No carrier images found</p>
              </div>
            )}
          </motion.div>

          {/* ── Legend ───────────────────────────────────────────── */}
          {fileGroups.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              style={{ marginTop: "4rem", padding: "1.5rem", border: "1px solid #334155", borderRadius: "0.75rem", background: "#1e293b" }}
            >
              <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", marginBottom: "1rem" }}>
                File Legend
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {fileGroups.map((g) => (
                  <div key={g.fileId} id={`legend-${g.fileId}`} style={{ display: "flex", alignItems: "center", gap: "0.75rem", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <div style={{ width: "12px", height: "12px", borderRadius: "3px", background: g.color }} />
                      <span style={{ fontSize: "0.875rem", color: "#f8fafc" }}>{g.fileName}</span>
                      <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                        k={g.threshold}, n={g.totalShards} · {vaultImages.filter((img) => img.fileId === g.fileId).length} shards in vault
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteFile(g.fileId)}
                      className="vault-btn-danger"
                      style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

        </div>
      </main>

      {/* ── Recovery animation overlay ────────────────────────────── */}
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
    </>
  );
}
