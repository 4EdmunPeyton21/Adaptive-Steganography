/* ═══════════════════════════════════════════════════════════════════
 * Cuttlefish Vault — PostgreSQL Schema
 * ═══════════════════════════════════════════════════════════════════
 *
 * This schema stores the "Ghost Map" for each shattered file.
 * Each row represents one hidden file, with its encrypted shards
 * distributed across 5 cover images (n=5, k=3 threshold).
 *
 * Key design choices:
 *  1. JSONB for ghost_map → schemaless shard metadata, GIN-indexable
 *  2. HASH index on file_name → O(1) equality lookups
 *  3. Separate columns for crypto metadata so WHERE clauses
 *     don't require JSONB path extraction
 *
 * Usage:
 *   psql -U cuttlefish -d cuttlefish_db -f schema.sql
 * ═══════════════════════════════════════════════════════════════════ */

-- ── Extensions ──────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";       -- gen_random_bytes() for demo seeding

-- ── Drop existing (dev only) ────────────────────────────────────
DROP TABLE IF EXISTS cuttlefish_vault CASCADE;
DROP TABLE IF EXISTS cover_images    CASCADE;

/* ─── Cover Images Registry ──────────────────────────────────────
 * Stores the 256×256 PNG covers as lossless binary.
 * BYTEA guarantees zero compression — GAN steganographic bits
 * survive round-trip storage intact.
 * ─────────────────────────────────────────────────────────────── */
CREATE TABLE cover_images (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id     VARCHAR(10) NOT NULL UNIQUE,       -- e.g. "0xA3F1"
    file_name   VARCHAR(64) NOT NULL,              -- original cover filename
    image_data  BYTEA       NOT NULL,              -- raw PNG bytes (lossless!)
    width       INT         NOT NULL DEFAULT 256,
    height      INT         NOT NULL DEFAULT 256,
    checksum    VARCHAR(64) NOT NULL,              -- SHA-256 of image_data
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure dimensions match our GAN pipeline
    CONSTRAINT chk_dimensions CHECK (width = 256 AND height = 256)
);

/* ─── Cuttlefish Vault (Ghost Map Storage) ────────────────────────
 * Each row = one secret file shattered across n cover images.
 *
 * ghost_map JSONB structure:
 * {
 *   "shards": [
 *     {
 *       "shard_index": 0,
 *       "cover_node_id": "0xA3F1",
 *       "cover_image_id": "uuid-...",
 *       "embedding_channel": "RGB",
 *       "bit_depth": 2,
 *       "checksum": "sha256-of-shard-data"
 *     },
 *     ... (5 entries for n=5)
 *   ],
 *   "encoding_params": {
 *     "model": "stego_encoder_v4",
 *     "resolution": [256, 256],
 *     "capacity_bpp": 0.4
 *   }
 * }
 * ─────────────────────────────────────────────────────────────── */
CREATE TABLE cuttlefish_vault (
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- File identity
    file_name       VARCHAR(255) NOT NULL,          -- original secret filename
    file_hash       VARCHAR(64)  NOT NULL,          -- SHA-256 of original file
    file_size_bytes BIGINT       NOT NULL,

    -- Shamir parameters
    shamir_k        SMALLINT     NOT NULL DEFAULT 3,  -- reconstruction threshold
    shamir_n        SMALLINT     NOT NULL DEFAULT 5,  -- total shares

    -- Encryption metadata
    enc_algorithm   VARCHAR(32)  NOT NULL DEFAULT 'AES-256-GCM',
    enc_key_hash    VARCHAR(64)  NOT NULL,          -- SHA-256(PBKDF2-derived key)
    enc_iv          BYTEA        NOT NULL,          -- 12-byte nonce for AES-GCM

    -- The Ghost Map (JSONB) — the core shard distribution data
    ghost_map       JSONB        NOT NULL,

    -- Timestamps
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    accessed_at     TIMESTAMPTZ,                    -- last summon timestamp

    -- Constraints
    CONSTRAINT chk_shamir_params CHECK (shamir_k <= shamir_n AND shamir_k >= 2),
    CONSTRAINT chk_file_size     CHECK (file_size_bytes > 0)
);

/* ─── O(1) Hash Index on file_name ───────────────────────────────
 *
 * WHY HASH instead of B-Tree:
 *   - We only ever do exact equality lookups (WHERE file_name = $1)
 *   - Hash indices are ~30% smaller in memory than B-Tree
 *   - Constant-time O(1) lookup vs O(log n) for B-Tree
 *
 * TRADE-OFF: Hash indices do NOT support range queries or ORDER BY.
 *   This is acceptable since we never sort by filename — all access
 *   patterns are exact-match lookups from the frontend search bar.
 * ─────────────────────────────────────────────────────────────── */
CREATE INDEX idx_vault_file_name_hash
    ON cuttlefish_vault USING HASH (file_name);

-- B-Tree on file_hash for integrity verification queries
CREATE INDEX idx_vault_file_hash
    ON cuttlefish_vault (file_hash);

-- GIN index on ghost_map for JSONB containment queries
-- e.g. SELECT * FROM cuttlefish_vault WHERE ghost_map @> '{"shards": [{"cover_node_id": "0xA3F1"}]}'
CREATE INDEX idx_vault_ghost_map_gin
    ON cuttlefish_vault USING GIN (ghost_map jsonb_path_ops);

-- Hash index on cover_images.node_id for reverse shard lookups
CREATE INDEX idx_cover_node_id_hash
    ON cover_images USING HASH (node_id);

/* ─── Seed Data (Demo Ghost Maps) ────────────────────────────────
 * These match the GHOST_MAPS defined in lib/galleryData.ts
 * ─────────────────────────────────────────────────────────────── */
INSERT INTO cuttlefish_vault (file_name, file_hash, file_size_bytes, enc_key_hash, enc_iv, ghost_map)
VALUES
(
    'FILE_ALPHA',
    'a3f1e2d4b5c6a7f8e9d0c1b2a3f4e5d6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2',
    524288,
    'e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2',
    E'\\x000102030405060708090a0b',
    '{
        "shards": [
            {"shard_index": 0, "cover_node_id": "0x0011", "gallery_id": "g01", "checksum": "sha256_shard0_alpha"},
            {"shard_index": 1, "cover_node_id": "0x0012", "gallery_id": "g02", "checksum": "sha256_shard1_alpha"},
            {"shard_index": 2, "cover_node_id": "0x0013", "gallery_id": "g03", "checksum": "sha256_shard2_alpha"},
            {"shard_index": 3, "cover_node_id": "0x0014", "gallery_id": "g04", "checksum": "sha256_shard3_alpha"},
            {"shard_index": 4, "cover_node_id": "0x0015", "gallery_id": "g05", "checksum": "sha256_shard4_alpha"}
        ],
        "encoding_params": {"model": "stego_encoder_v4", "resolution": [256, 256], "capacity_bpp": 0.4}
    }'::jsonb
),
(
    'FILE_BETA',
    'b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5',
    1048576,
    'f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3',
    E'\\x0c0d0e0f10111213141516',
    '{
        "shards": [
            {"shard_index": 0, "cover_node_id": "0x0016", "gallery_id": "g06", "checksum": "sha256_shard0_beta"},
            {"shard_index": 1, "cover_node_id": "0x0017", "gallery_id": "g07", "checksum": "sha256_shard1_beta"},
            {"shard_index": 2, "cover_node_id": "0x0018", "gallery_id": "g08", "checksum": "sha256_shard2_beta"},
            {"shard_index": 3, "cover_node_id": "0x0019", "gallery_id": "g09", "checksum": "sha256_shard3_beta"},
            {"shard_index": 4, "cover_node_id": "0x001A", "gallery_id": "g10", "checksum": "sha256_shard4_beta"}
        ],
        "encoding_params": {"model": "stego_encoder_v4", "resolution": [256, 256], "capacity_bpp": 0.4}
    }'::jsonb
),
(
    'FILE_GAMMA',
    'c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
    262144,
    'a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4',
    E'\\x18191a1b1c1d1e1f20212223',
    '{
        "shards": [
            {"shard_index": 0, "cover_node_id": "0x001B", "gallery_id": "g11", "checksum": "sha256_shard0_gamma"},
            {"shard_index": 1, "cover_node_id": "0x001C", "gallery_id": "g12", "checksum": "sha256_shard1_gamma"},
            {"shard_index": 2, "cover_node_id": "0x001D", "gallery_id": "g13", "checksum": "sha256_shard2_gamma"},
            {"shard_index": 3, "cover_node_id": "0x001E", "gallery_id": "g14", "checksum": "sha256_shard3_gamma"},
            {"shard_index": 4, "cover_node_id": "0x001F", "gallery_id": "g15", "checksum": "sha256_shard4_gamma"}
        ],
        "encoding_params": {"model": "stego_encoder_v4", "resolution": [256, 256], "capacity_bpp": 0.4}
    }'::jsonb
);

/* ─── Verification Query ─────────────────────────────────────────
 * Run after seeding to confirm O(1) index is active:
 *
 *   EXPLAIN ANALYZE SELECT * FROM cuttlefish_vault
 *     WHERE file_name = 'FILE_ALPHA';
 *
 * Expected output should show "Index Scan using idx_vault_file_name_hash"
 * with execution time < 0.1ms on warm cache.
 * ─────────────────────────────────────────────────────────────── */
