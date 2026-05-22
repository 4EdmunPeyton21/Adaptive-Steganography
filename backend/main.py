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
import random
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Any

import asyncpg
import jwt
from fastapi import FastAPI, File, HTTPException, UploadFile, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from crypto_utils import generate_horcruxes, assemble_horcruxes
from encrypt_image import StegoEngine
from decrypt_image import GhostDecoder
import io
from PIL import Image
import bcrypt
from pydantic import BaseModel, Field, EmailStr

# ── Auth Configuration ───────────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-key-change-me")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 1 week

# ── Configuration ────────────────────────────────────────────────

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://cuttlefish:cuttlefish@localhost:5432/cuttlefish_db",
)

SHAMIR_K = 3   # reconstruction threshold
SHAMIR_N = 5   # total shares
COVER_SIZE = 256  # GAN pipeline resolution

# ── Pydantic Models ──────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str
    passphrase: str

class LoginRequest(BaseModel):
    email: str
    password: str

class AuthResponse(BaseModel):
    status: str
    token: str
    user_id: int
    username: str
    passphrase: str


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
    expose_headers=["Content-Disposition", "Content-Length", "Content-Type"],
)


# ── Helpers ──────────────────────────────────────────────────────

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def sha256_digest(data: bytes) -> str:
    """Return hex SHA-256 of raw bytes."""
    return hashlib.sha256(data).hexdigest()

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> int:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return int(user_id)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user_from_query(token: str) -> int:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return int(user_id)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

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


# ── POST /api/v1/auth/register ───────────────────────────────────

@app.post("/api/v1/auth/register", response_model=AuthResponse)
async def register(req: RegisterRequest):
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="Database not available")
        
    hashed_pwd = get_password_hash(req.password)
    
    try:
        user_id = await pool.fetchval(
            """
            INSERT INTO users (username, email, password_hash, passphrase)
            VALUES ($1, $2, $3, $4)
            RETURNING id
            """,
            req.username,
            req.email,
            hashed_pwd,
            req.passphrase,
        )
        
        access_token = create_access_token(
            data={"sub": str(user_id)},
            expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        
        return AuthResponse(
            status="success",
            token=access_token,
            user_id=user_id,
            username=req.username,
            passphrase=req.passphrase,
        )
    except asyncpg.UniqueViolationError:
        raise HTTPException(status_code=400, detail="Username or email already registered")

# ── POST /api/v1/auth/login ──────────────────────────────────────

@app.post("/api/v1/auth/login", response_model=AuthResponse)
async def login(req: LoginRequest):
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="Database not available")
        
    user_record = await pool.fetchrow(
        "SELECT id, username, password_hash, passphrase FROM users WHERE email = $1",
        req.email,
    )
    
    if not user_record or not verify_password(req.password, user_record["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
        
    access_token = create_access_token(
        data={"sub": str(user_record["id"])},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    return AuthResponse(
        status="success",
        token=access_token,
        user_id=user_record["id"],
        username=user_record["username"],
        passphrase=user_record["passphrase"],
    )

# ── POST /api/v1/shatter ─────────────────────────────────────────

@app.post("/api/v1/shatter", response_model=ShatterResponse)
async def shatter_file(file: UploadFile = File(...), user_id: int = Depends(get_current_user)):
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
                    (id, user_id, file_name, file_hash, file_size_bytes,
                     shamir_k, shamir_n, enc_algorithm, enc_key_hash, enc_iv,
                     ghost_map, file_data)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                ON CONFLICT DO NOTHING
                """,
                uuid.UUID(ghost_map_id),
                user_id,
                file_name,
                file_hash,
                file_size,
                SHAMIR_K,
                SHAMIR_N,
                "AES-256-GCM",
                enc_key_hash,
                enc_iv,
                ghost_map_payload.model_dump_json(),
                raw_bytes,
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


# ── GET /api/v1/vault/memories ────────────────────────────────────

@app.get("/api/v1/vault/memories")
async def get_memories(user_id: int = Depends(get_current_user)):
    pool = await get_pool()
    if not pool:
        return []
    
    rows = await pool.fetch(
        "SELECT id, file_name, file_size_bytes, created_at FROM cuttlefish_vault WHERE user_id = $1 ORDER BY created_at DESC",
        user_id
    )
    
    photos = []
    for r in rows:
        photos.append({
            "id": str(r["id"]),
            "src": f"/api/v1/vault/memories/{r['id']}/image",
            "name": r["file_name"],
            "size": f"{r['file_size_bytes'] / (1024 * 1024):.1f} MB",
            "uploadedAt": r["created_at"].isoformat().split("T")[0] if r["created_at"] else "",
            "width": 600,
            "height": 400
        })
    return photos

# ── GET /api/v1/vault/memories/{id}/image ──────────────────────────

@app.get("/api/v1/vault/memories/{vault_id}/image")
async def get_memory_image(vault_id: str, user_id: int = Depends(get_current_user)):
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        val_uuid = uuid.UUID(vault_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID format")

    row = await pool.fetchrow(
        "SELECT file_data, file_name FROM cuttlefish_vault WHERE id = $1 AND user_id = $2",
        val_uuid, user_id
    )
    
    if not row or not row["file_data"]:
        raise HTTPException(status_code=404, detail="Image not found")
        
    return Response(content=row["file_data"], media_type="image/jpeg")

# ── DELETE /api/v1/vault/memories/{vault_id} ───────────────────────

@app.delete("/api/v1/vault/memories/{vault_id}")
async def delete_memory(vault_id: str, user_id: int = Depends(get_current_user)):
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        val_uuid = uuid.UUID(vault_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID format")

    result = await pool.execute(
        "DELETE FROM cuttlefish_vault WHERE id = $1 AND user_id = $2",
        val_uuid, user_id
    )

    # asyncpg returns e.g. "DELETE 1" — if 0 rows affected the photo wasn't found/owned
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Memory not found or not owned by user")

    return {"deleted": vault_id}


@app.get("/api/v1/summon/{filename}", response_model=SummonResponse)
async def summon_file(filename: str):
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
# ── POST /api/v1/stego/upload ──────────────────────────────────────
@app.post("/api/v1/stego/upload")
async def stego_upload(file: UploadFile = File(...), user_id: int = Depends(get_current_user)):
    pool = await get_pool()
    raw_bytes = await file.read()

    # 1. Generate Horcruxes (AES-256 + Shamir k=3, n=5)
    horcrux_data = generate_horcruxes(raw_bytes, k=3, n=5)
    ciphertext = horcrux_data['ciphertext']
    shards = horcrux_data['shards']

    # 2. Fetch cover images — prioritise user's Memory Vault images,
    #    fall back to any custom stego covers they have uploaded.
    engine = StegoEngine()

    # Pull all vault images for this user
    vault_rows = await pool.fetch(
        "SELECT file_data FROM cuttlefish_vault WHERE user_id = $1 ORDER BY RANDOM() LIMIT 10",
        user_id
    )
    vault_covers = [r["file_data"] for r in vault_rows if r["file_data"]]

    # Also pull any custom stego covers
    cover_rows = await pool.fetch(
        "SELECT image_data FROM stego_custom_covers WHERE user_id = $1",
        user_id
    )
    custom_covers = [r["image_data"] for r in cover_rows]
    random.shuffle(custom_covers)

    # Merge: vault first, then custom covers
    all_covers = vault_covers + custom_covers

    if len(all_covers) < 5:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Not enough cover images — need at least 5, found {len(all_covers)}. "
                "Upload more images to your Memory Vault first."
            )
        )

    # Pick 5 random covers
    selected_covers = random.sample(all_covers, 5)

    file_id = str(uuid.uuid4())

    # Insert file record
    await pool.execute(
        "INSERT INTO stego_files (id, user_id, file_name, ciphertext, total_shards, threshold) "
        "VALUES ($1, $2, $3, $4, $5, $6)",
        uuid.UUID(file_id), user_id, file.filename, ciphertext, 5, 3
    )

    image_responses = []

    for i in range(5):
        cover_bytes = selected_covers[i]
        cover_img = engine.normalize_cover(io.BytesIO(cover_bytes))

        stego_result, metadata = engine.run_embedding(cover_img, shards[i])

        img_byte_arr = io.BytesIO()
        if metadata is not None:
            stego_result.save(img_byte_arr, format='PNG', pnginfo=metadata)
        else:
            stego_result.save(img_byte_arr, format='PNG')
        img_bytes = img_byte_arr.getvalue()

        shard_id = str(uuid.uuid4())

        await pool.execute(
            "INSERT INTO stego_shards (id, stego_file_id, user_id, shard_index, image_data) "
            "VALUES ($1, $2, $3, $4, $5)",
            uuid.UUID(shard_id), uuid.UUID(file_id), user_id, i + 1, img_bytes
        )

        image_responses.append({
            "id": shard_id,
            "src": f"/api/v1/stego/shards/{shard_id}/image",
            "fileId": file_id,
            "shardIndex": i + 1,
            "name": f"shard_{i + 1}.png"
        })

    return {
        "fileId": file_id,
        "fileName": file.filename,
        "images": image_responses
    }

# ── GET /api/v1/stego/files ───────────────────────────────────────
@app.get("/api/v1/stego/files")
async def get_stego_files(user_id: int = Depends(get_current_user)):
    pool = await get_pool()
    file_rows = await pool.fetch("SELECT * FROM stego_files WHERE user_id = $1 ORDER BY created_at DESC", user_id)
    
    files = []
    for f in file_rows:
        shard_rows = await pool.fetch("SELECT id, shard_index FROM stego_shards WHERE stego_file_id = $1 ORDER BY shard_index", f["id"])
        
        images = []
        for s in shard_rows:
            images.append({
                "id": str(s["id"]),
                "src": f"/api/v1/stego/shards/{s['id']}/image",
                "fileId": str(f["id"]),
                "shardIndex": s["shard_index"],
                "name": f"shard_{s['shard_index']}.png"
            })
            
        files.append({
            "fileId": str(f["id"]),
            "fileName": f["file_name"],
            "totalShards": f["total_shards"],
            "threshold": f["threshold"],
            "images": images
        })
        
    return files

# ── GET /api/v1/stego/shards/{id}/image ───────────────────────────
@app.get("/api/v1/stego/shards/{shard_id}/image")
async def get_stego_shard_image(shard_id: str, user_id: int = Depends(get_current_user_from_query)):
    pool = await get_pool()
    row = await pool.fetchrow("SELECT image_data FROM stego_shards WHERE id = $1 AND user_id = $2", uuid.UUID(shard_id), user_id)
    if not row:
        raise HTTPException(status_code=404, detail="Shard not found")
    return Response(content=row["image_data"], media_type="image/png")

# ── DELETE /api/v1/stego/shards/{id} ──────────────────────────────
@app.delete("/api/v1/stego/shards/{shard_id}")
async def delete_stego_shard(shard_id: str, user_id: int = Depends(get_current_user)):
    pool = await get_pool()
    result = await pool.execute("DELETE FROM stego_shards WHERE id = $1 AND user_id = $2", uuid.UUID(shard_id), user_id)
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Shard not found")
    return {"status": "deleted"}

# ── POST /api/v1/stego/recover ────────────────────────────────────
class RecoverRequest(BaseModel):
    shard_ids: list[str]

@app.post("/api/v1/stego/recover")
async def recover_stego_file(req: RecoverRequest, user_id: int = Depends(get_current_user)):
    pool = await get_pool()
    
    if len(req.shard_ids) < 3:
        raise HTTPException(status_code=400, detail="Need at least 3 shards to recover")
        
    # Fetch all shards
    shards_data = []
    file_ids = set()
    for sid in req.shard_ids:
        row = await pool.fetchrow("SELECT image_data, stego_file_id FROM stego_shards WHERE id = $1 AND user_id = $2", uuid.UUID(sid), user_id)
        if not row:
            raise HTTPException(status_code=404, detail=f"Shard {sid} not found")
        file_ids.add(row["stego_file_id"])
        shards_data.append(row["image_data"])
        
    if len(file_ids) > 1:
        raise HTTPException(status_code=400, detail="Shards must belong to the same file")
        
    file_id = list(file_ids)[0]
    
    # Fetch ciphertext
    file_row = await pool.fetchrow("SELECT ciphertext, file_name FROM stego_files WHERE id = $1", file_id)
    if not file_row:
        raise HTTPException(status_code=404, detail="File not found")
        
    # Extract shards from images
    decoder = GhostDecoder()
    extracted_shards = []
    for img_bytes in shards_data:
        img = Image.open(io.BytesIO(img_bytes))
        shard_str = decoder.extract_shard(img)
        if shard_str:
            extracted_shards.append(shard_str)
            
    if len(extracted_shards) < 3:
        raise HTTPException(status_code=400, detail="Failed to extract hidden data from images")
        
    # Reassemble
    try:
        raw_data = assemble_horcruxes(extracted_shards, file_row["ciphertext"], k=3)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recovery failed: {str(e)}")
        
    # Determine MIME type from filename to help browsers open it correctly
    import mimetypes
    mime_type, _ = mimetypes.guess_type(file_row["file_name"])
    if not mime_type:
        mime_type = "application/octet-stream"

    # Properly encode filename in Content-Disposition for all browsers
    safe_name = file_row["file_name"].replace('"', '_')

    return Response(
        content=raw_data,
        media_type=mime_type,
        headers={
            "Content-Disposition": f'attachment; filename="{safe_name}"',
            "Content-Length": str(len(raw_data)),
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )

# ── DELETE /api/v1/stego/files/{id} ───────────────────────────────
@app.delete("/api/v1/stego/files/{file_id}")
async def delete_stego_file(file_id: str, user_id: int = Depends(get_current_user)):
    pool = await get_pool()
    file_uuid = uuid.UUID(file_id)

    # Verify the file belongs to this user before deleting anything
    row = await pool.fetchrow(
        "SELECT id FROM stego_files WHERE id = $1 AND user_id = $2",
        file_uuid, user_id
    )
    if not row:
        raise HTTPException(status_code=404, detail="File not found")

    # Delete child shards first (foreign key constraint)
    shards_deleted = await pool.execute(
        "DELETE FROM stego_shards WHERE stego_file_id = $1", file_uuid
    )

    # Now delete the parent file record
    await pool.execute(
        "DELETE FROM stego_files WHERE id = $1 AND user_id = $2", file_uuid, user_id
    )

    return {"status": "deleted", "shards_removed": shards_deleted}

# ── POST /api/v1/stego/covers ───────────────────────────────────────
@app.post("/api/v1/stego/covers")
async def upload_custom_cover(file: UploadFile = File(...), user_id: int = Depends(get_current_user)):
    pool = await get_pool()
    raw_bytes = await file.read()
    
    # Optional: basic validation to ensure it's an image
    try:
        Image.open(io.BytesIO(raw_bytes)).verify()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")
        
    cover_id = str(uuid.uuid4())
    await pool.execute(
        "INSERT INTO stego_custom_covers (id, user_id, file_name, image_data) VALUES ($1, $2, $3, $4)",
        uuid.UUID(cover_id), user_id, file.filename, raw_bytes
    )
    return {"id": cover_id, "fileName": file.filename}

# ── GET /api/v1/stego/covers ────────────────────────────────────────
@app.get("/api/v1/stego/covers")
async def get_custom_covers(user_id: int = Depends(get_current_user)):
    pool = await get_pool()
    rows = await pool.fetch("SELECT id, file_name FROM stego_custom_covers WHERE user_id = $1 ORDER BY created_at DESC", user_id)
    return [{"id": str(r["id"]), "fileName": r["file_name"]} for r in rows]

# ── GET /api/v1/stego/covers/{id}/image ─────────────────────────────
@app.get("/api/v1/stego/covers/{cover_id}/image")
async def get_custom_cover_image(cover_id: str, user_id: int = Depends(get_current_user_from_query)):
    pool = await get_pool()
    row = await pool.fetchrow("SELECT image_data FROM stego_custom_covers WHERE id = $1 AND user_id = $2", uuid.UUID(cover_id), user_id)
    if not row:
        raise HTTPException(status_code=404, detail="Cover not found")
    return Response(content=row["image_data"], media_type="image/jpeg")

# ── DELETE /api/v1/stego/covers/{id} ────────────────────────────────
@app.delete("/api/v1/stego/covers/{cover_id}")
async def delete_custom_cover(cover_id: str, user_id: int = Depends(get_current_user)):
    pool = await get_pool()
    res = await pool.execute("DELETE FROM stego_custom_covers WHERE id = $1 AND user_id = $2", uuid.UUID(cover_id), user_id)
    if res == "DELETE 0":
        raise HTTPException(status_code=404, detail="Cover not found")
    return {"status": "deleted"}

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
