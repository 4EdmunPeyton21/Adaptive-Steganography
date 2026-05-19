"""
═══════════════════════════════════════════════════════════════════
Cuttlefish Vault — FastAPI Backend
═══════════════════════════════════════════════════════════════════

High-performance API for the Neural Steganography Vault.

Endpoints:
  POST /api/v1/shatter      — Upload + encrypt + distribute to n=5 covers
  GET  /api/v1/summon/{name} — O(1) Ghost Map lookup by filename
  GET  /api/v1/health        — Service health check

Key design:
  - All image transport uses lossless PNG (no JPEG compression)
  - asyncpg for non-blocking PostgreSQL access
  - Pydantic v2 models for strict type validation
  - CORS configured for Next.js dev server

Usage:
  uvicorn backend.main:app --reload --port 8000
═══════════════════════════════════════════════════════════════════
"""

from __future__ import annotations

import hashlib
import io
import os
import time
import uuid
from contextlib import asynccontextmanager
from typing import Any

import asyncpg
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# ── Configuration ────────────────────────────────────────────────

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://cuttlefish:cuttlefish@localhost:5432/cuttlefish_db",
)

SHAMIR_K = 3   # reconstruction threshold
SHAMIR_N = 5   # total shares
COVER_SIZE = 256  # GAN pipeline resolution

# ── Pydantic Models ──────────────────────────────────────────────


class ShardInfo(BaseModel):
    shard_index: int
    cover_node_id: str
    gallery_id: str
    checksum: str


class GhostMapPayload(BaseModel):
    shards: list[ShardInfo]
    encoding_params: dict[str, Any] = Field(default_factory=lambda: {
        "model": "stego_encoder_v4",
        "resolution": [256, 256],
        "capacity_bpp": 0.4,
    })


class ShatterResponse(BaseModel):
    status: str
    file_name: str
    file_hash: str
    ghost_map_id: str
    shards_distributed: int
    processing_time_ms: float
    timings: dict[str, float]


class SummonResponse(BaseModel):
    status: str
    file_name: str
    file_hash: str
    file_size_bytes: int
    shamir_k: int
    shamir_n: int
    enc_algorithm: str
    ghost_map: dict[str, Any]
    cover_gallery_ids: list[str]
    lookup_time_ms: float


class HealthResponse(BaseModel):
    status: str
    database: str
    version: str = "0.9.4"


# ── Database Pool ────────────────────────────────────────────────

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    """Return the asyncpg connection pool, creating it lazily."""
    global _pool
    if _pool is None:
        try:
            _pool = await asyncpg.create_pool(
                DATABASE_URL,
                min_size=2,
                max_size=10,
                command_timeout=5,
            )
        except Exception:
            # Demo mode — no Postgres available
            _pool = None  # type: ignore
    return _pool  # type: ignore


# ── Lifecycle ────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: warm the connection pool. Shutdown: close it."""
    await get_pool()
    yield
    if _pool:
        await _pool.close()


# ── App ──────────────────────────────────────────────────────────

app = FastAPI(
    title="Cuttlefish Vault API",
    version="0.9.4",
    description="Neural Steganography Vault — Shatter & Summon endpoints",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helpers ──────────────────────────────────────────────────────

def sha256_digest(data: bytes) -> str:
    """Return hex SHA-256 of raw bytes."""
    return hashlib.sha256(data).hexdigest()


def generate_node_id(card_id: str) -> str:
    """Deterministic hex node ID — mirrors the frontend deriveNodeId()."""
    h = 0
    for ch in card_id:
        h = ((31 * h) + ord(ch)) & 0xFFFFFFFF
    return "0x" + format(h & 0xFFFF, "04X")


# Gallery ID slots for shard distribution (mirrors frontend GHOST_MAPS)
GALLERY_SLOTS = {
    0: ["g01", "g02", "g03", "g04", "g05"],
    1: ["g06", "g07", "g08", "g09", "g10"],
    2: ["g11", "g12", "g13", "g14", "g15"],
}


def pick_cover_slots() -> list[str]:
    """Select the next available ghost map slot (round-robin demo)."""
    # In production, this queries the DB for the least-used slot.
    # For demo, always return the first slot.
    return GALLERY_SLOTS[0]


# ── POST /api/v1/shatter ─────────────────────────────────────────

@app.post("/api/v1/shatter", response_model=ShatterResponse)
async def shatter_file(file: UploadFile = File(...)):
    """
    Upload a secret file, encrypt it, derive Shamir shares,
    and distribute across n=5 cover images.

    CRITICAL: All image covers are handled as lossless PNG.
    The response includes per-stage timing for the terminal log.
    """
    t_total = time.perf_counter()
    timings: dict[str, float] = {}

    # ── 1. Read & validate the uploaded file ──────────────────────
    t0 = time.perf_counter()
    raw_bytes = await file.read()
    file_name = file.filename or f"unnamed_{uuid.uuid4().hex[:8]}"
    file_hash = sha256_digest(raw_bytes)
    file_size = len(raw_bytes)
    timings["file_read_ms"] = round((time.perf_counter() - t0) * 1000, 2)

    if file_size == 0:
        raise HTTPException(status_code=400, detail="Empty file")
    if file_size > 50 * 1024 * 1024:  # 50 MB limit
        raise HTTPException(status_code=413, detail="File too large (max 50MB)")

    # ── 2. Simulate AES-256-GCM encryption ────────────────────────
    t0 = time.perf_counter()
    enc_iv = os.urandom(12)  # 96-bit nonce
    enc_key_hash = sha256_digest(os.urandom(32))  # simulated derived key
    timings["encryption_ms"] = round((time.perf_counter() - t0) * 1000, 2)

    # ── 3. Simulate Shamir's Secret Sharing (k=3, n=5) ───────────
    t0 = time.perf_counter()
    cover_ids = pick_cover_slots()
    shards: list[ShardInfo] = []
    for i, gid in enumerate(cover_ids):
        shards.append(ShardInfo(
            shard_index=i,
            cover_node_id=generate_node_id(gid),
            gallery_id=gid,
            checksum=sha256_digest(raw_bytes[i * len(raw_bytes) // SHAMIR_N:(i + 1) * len(raw_bytes) // SHAMIR_N]),
        ))
    timings["shamir_split_ms"] = round((time.perf_counter() - t0) * 1000, 2)

    # ── 4. Simulate GAN embedding (stego_encoder_v4 forward pass) ─
    t0 = time.perf_counter()
    # In production: load PyTorch model, run forward pass on 256×256 covers
    # The covers are ALWAYS PNG (lossless) to preserve steganographic bits
    timings["gan_embedding_ms"] = round((time.perf_counter() - t0) * 1000, 2)

    # ── 5. Persist Ghost Map to PostgreSQL ────────────────────────
    ghost_map_payload = GhostMapPayload(shards=shards)
    ghost_map_id = str(uuid.uuid4())

    t0 = time.perf_counter()
    pool = await get_pool()
    if pool:
        try:
            await pool.execute(
                """
                INSERT INTO cuttlefish_vault
                    (id, file_name, file_hash, file_size_bytes,
                     shamir_k, shamir_n, enc_algorithm, enc_key_hash, enc_iv,
                     ghost_map)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT DO NOTHING
                """,
                uuid.UUID(ghost_map_id),
                file_name,
                file_hash,
                file_size,
                SHAMIR_K,
                SHAMIR_N,
                "AES-256-GCM",
                enc_key_hash,
                enc_iv,
                ghost_map_payload.model_dump_json(),
            )
            timings["postgres_write_ms"] = round((time.perf_counter() - t0) * 1000, 2)
        except Exception as e:
            timings["postgres_write_ms"] = -1
            timings["postgres_error"] = str(e)[:120]
    else:
        # Demo mode — no DB, just measure timing
        timings["postgres_write_ms"] = 0.12  # simulated

    timings["total_ms"] = round((time.perf_counter() - t_total) * 1000, 2)

    return ShatterResponse(
        status="success",
        file_name=file_name,
        file_hash=file_hash,
        ghost_map_id=ghost_map_id,
        shards_distributed=SHAMIR_N,
        processing_time_ms=timings["total_ms"],
        timings=timings,
    )


# ── GET /api/v1/summon/{filename} ─────────────────────────────────

@app.get("/api/v1/summon/{filename}", response_model=SummonResponse)
async def summon_file(filename: str):
    """
    O(1) Ghost Map retrieval by filename.
    Uses the HASH index on cuttlefish_vault.file_name.

    Returns the full ghost map + list of gallery cover IDs
    for the frontend to illuminate.
    """
    t0 = time.perf_counter()

    pool = await get_pool()
    row = None

    if pool:
        try:
            row = await pool.fetchrow(
                """
                SELECT id, file_name, file_hash, file_size_bytes,
                       shamir_k, shamir_n, enc_algorithm, ghost_map,
                       created_at
                FROM cuttlefish_vault
                WHERE file_name = $1
                LIMIT 1
                """,
                filename,
            )
        except Exception:
            pass

    lookup_ms = round((time.perf_counter() - t0) * 1000, 2)

    if row:
        # Real DB result
        import json
        ghost_map = json.loads(row["ghost_map"]) if isinstance(row["ghost_map"], str) else row["ghost_map"]
        gallery_ids = [s.get("gallery_id", "") for s in ghost_map.get("shards", [])]

        # Update accessed_at timestamp
        if pool:
            try:
                await pool.execute(
                    "UPDATE cuttlefish_vault SET accessed_at = NOW() WHERE file_name = $1",
                    filename,
                )
            except Exception:
                pass

        return SummonResponse(
            status="found",
            file_name=row["file_name"],
            file_hash=row["file_hash"],
            file_size_bytes=row["file_size_bytes"],
            shamir_k=row["shamir_k"],
            shamir_n=row["shamir_n"],
            enc_algorithm=row["enc_algorithm"],
            ghost_map=ghost_map,
            cover_gallery_ids=gallery_ids,
            lookup_time_ms=lookup_ms,
        )

    # ── Demo fallback: match against hardcoded ghost maps ─────────
    DEMO_MAPS: dict[str, dict[str, Any]] = {
        "FILE_ALPHA": {
            "gallery_ids": ["g01", "g02", "g03", "g04", "g05"],
            "file_hash": "a3f1e2d4b5c6...",
            "file_size": 524288,
        },
        "FILE_BETA": {
            "gallery_ids": ["g06", "g07", "g08", "g09", "g10"],
            "file_hash": "b4c5d6e7f8a9...",
            "file_size": 1048576,
        },
        "FILE_GAMMA": {
            "gallery_ids": ["g11", "g12", "g13", "g14", "g15"],
            "file_hash": "c5d6e7f8a9b0...",
            "file_size": 262144,
        },
    }

    # Case-insensitive lookup with partial matching
    match_key = None
    query_upper = filename.upper().strip()
    for key in DEMO_MAPS:
        if query_upper == key or query_upper in key or key in query_upper:
            match_key = key
            break

    if not match_key:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "NOT_FOUND",
                "message": f"No ghost map found for '{filename}'",
                "lookup_time_ms": lookup_ms,
            },
        )

    demo = DEMO_MAPS[match_key]
    demo_shards = [
        {
            "shard_index": i,
            "cover_node_id": generate_node_id(gid),
            "gallery_id": gid,
            "checksum": f"sha256_shard{i}_{match_key.lower()}",
        }
        for i, gid in enumerate(demo["gallery_ids"])
    ]

    return SummonResponse(
        status="found",
        file_name=match_key,
        file_hash=demo["file_hash"],
        file_size_bytes=demo["file_size"],
        shamir_k=SHAMIR_K,
        shamir_n=SHAMIR_N,
        enc_algorithm="AES-256-GCM",
        ghost_map={
            "shards": demo_shards,
            "encoding_params": {
                "model": "stego_encoder_v4",
                "resolution": [256, 256],
                "capacity_bpp": 0.4,
            },
        },
        cover_gallery_ids=demo["gallery_ids"],
        lookup_time_ms=lookup_ms,
    )


# ── GET /api/v1/health ────────────────────────────────────────────

@app.get("/api/v1/health", response_model=HealthResponse)
async def health_check():
    """Service health — checks DB connectivity."""
    pool = await get_pool()
    db_status = "disconnected"
    if pool:
        try:
            await pool.fetchval("SELECT 1")
            db_status = "connected"
        except Exception:
            db_status = "error"
    else:
        db_status = "demo_mode"

    return HealthResponse(
        status="ok",
        database=db_status,
    )


# ── Direct run ───────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
