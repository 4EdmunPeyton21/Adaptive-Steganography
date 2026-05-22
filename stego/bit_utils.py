"""
================================================================================
stego/bit_utils.py  --  Bit Conversion Pipeline for Neural Steganography
================================================================================

This module is the bridge between the cryptographic layer (Shamir shards)
and the neural layer (StegEncoder / StegDecoder).

The image capacity at 256x256 is 65,536 pixels == 65,536 bits == 8,192 bytes.
A single Shamir shard string (format: "<index>-<521-bit hex>") is at most
~170 characters = ~170 bytes, well within the capacity of one cover image.

ECC Layer (Spatial Repetition Code)
------------------------------------
Because Shamir shards are small (~133 bytes), we use only ~1.5% of the image's
bit capacity. We exploit the remaining 98.5% to store the same message
ECC_REPS=31 times, interleaved across the entire image grid.

On extraction, the decoder gathers all 31 copies of each bit and takes a
majority vote. This mathematically tolerates up to 15% raw BER:

    P(majority wrong | BER=8%) ≈ 0.00000004%

This makes recovery work reliably without needing the neural network to reach
0% BER during training.

Data layout inside the bit grid  (65,536 bits total)
------------------------------------------------------
Let ECC_MSG_BITS = floor(GRID_BITS / ECC_REPS) = 2114 bits (264 bytes).

The message block (2114 bits):
  Bits [0 .. 15]                         : LENGTH HEADER (uint16, big-endian)
                                           stores the number of payload BYTES.
  Bits [16 .. 16 + payload_bits - 1]     : PAYLOAD (shard string as UTF-8)
  Bits [16 + payload_bits .. 2113]       : PADDING (zeros, ignored on decode)

This block is tiled ECC_REPS=31 times:
  Output bits [0 .. 2113]        : copy 0
  Output bits [2114 .. 4227]     : copy 1
  ...
  Output bits [63520 .. 65533]   : copy 30
  Output bits [65534 .. 65535]   : zero pad (last 2 bits)

Max payload = (2114 - 16) // 8 = 262 bytes (far exceeds shard ~133 bytes).

Public API
----------
    text_to_bit_tensor(text, H=256, W=256)  -> torch.Tensor  (1, H, W)
    bit_tensor_to_text(tensor)              -> str
    bytes_to_bit_tensor(data, H=256, W=256) -> torch.Tensor  (1, H, W)
    bit_tensor_to_bytes(tensor)             -> bytes
    shard_capacity_check(text, H=256, W=256) -> dict   (info / validation)

All functions are pure NumPy + PyTorch — no GPU required for the conversion
itself; the tensors are then passed to the models which handle device placement.
================================================================================
"""

from __future__ import annotations

import struct
from typing import Union

import numpy as np
import torch


# ── Constants ────────────────────────────────────────────────────────────────

HEADER_BITS  = 16          # uint16 length header
HEADER_BYTES = 2
GRID_H       = 256
GRID_W       = 256
GRID_BITS    = GRID_H * GRID_W                      # 65,536

# Error Correction Code: Spatial Repetition
ECC_REPS         = 31                               # each bit repeated 31×
ECC_MSG_BITS     = GRID_BITS // ECC_REPS            # 2114 bits per message block
ECC_TOTAL_BITS   = ECC_MSG_BITS * ECC_REPS          # 65,534 bits used; last 2 = 0

MAX_PAYLOAD_BYTES = (ECC_MSG_BITS - HEADER_BITS) // 8   # 262 bytes


# ── Low-level helpers ────────────────────────────────────────────────────────

def _bytes_to_bits(data: bytes) -> np.ndarray:
    """Convert raw bytes to a 1-D numpy array of uint8 bits {0, 1}."""
    arr = np.frombuffer(data, dtype=np.uint8)
    # unpackbits expands each byte into 8 bits, MSB-first
    return np.unpackbits(arr)


def _bits_to_bytes(bits: np.ndarray) -> bytes:
    """Convert a 1-D numpy array of bits {0, 1} back to raw bytes.

    The length of *bits* must be a multiple of 8.
    """
    if len(bits) % 8 != 0:
        raise ValueError(
            f"Bit array length ({len(bits)}) must be a multiple of 8."
        )
    return np.packbits(bits.astype(np.uint8)).tobytes()


# ── Primary API ──────────────────────────────────────────────────────────────

def bytes_to_bit_tensor(
    data: bytes,
    H: int = GRID_H,
    W: int = GRID_W,
) -> torch.Tensor:
    """
    Encode raw bytes into a (1, H, W) binary float tensor ready for StegEncoder.

    ECC Layout (Spatial Repetition Code):
        1. Build a message block of ECC_MSG_BITS bits:
               [uint16 header][payload bits][zero padding]
        2. Tile this block ECC_REPS=31 times across the full grid.
           This means every bit is stored 31 times, spread across the image.
        3. The last (GRID_BITS - ECC_TOTAL_BITS) bits are zero-padded.

    The decoder uses a majority vote over all 31 copies to correct errors.
    This tolerates up to ~15% raw Bit Error Rate from the neural network.

    Args:
        data : The raw bytes to hide (e.g., a UTF-8 encoded shard string).
        H, W : Target grid dimensions.

    Returns:
        Tensor of shape (1, H, W) with dtype=torch.float32, values in {0.0, 1.0}.

    Raises:
        ValueError if data is too large to fit in one message block.
    """
    grid_bits = H * W
    ecc_msg_bits = grid_bits // ECC_REPS
    capacity_bytes = (ecc_msg_bits - HEADER_BITS) // 8

    if len(data) > capacity_bytes:
        raise ValueError(
            f"Payload too large: {len(data)} bytes > ECC capacity {capacity_bytes} bytes "
            f"for a {H}x{W} grid with {ECC_REPS}x repetition."
        )

    # -- 1. Build header (uint16, big-endian) --
    header_bytes = struct.pack(">H", len(data))   # 2 bytes
    header_bits  = _bytes_to_bits(header_bytes)    # 16 bits

    # -- 2. Build payload bits --
    payload_bits = _bytes_to_bits(data)            # len(data) * 8 bits

    # -- 3. Combine into one message block padded to ecc_msg_bits --
    msg = np.concatenate([header_bits, payload_bits])
    padding = np.zeros(ecc_msg_bits - len(msg), dtype=np.uint8)
    msg_block = np.concatenate([msg, padding])     # shape: (ecc_msg_bits,)

    # -- 4. Tile ECC_REPS times and pad to exactly grid_bits --
    tiled = np.tile(msg_block, ECC_REPS)           # (ecc_msg_bits * ECC_REPS,) = 65534
    if len(tiled) < grid_bits:
        tiled = np.concatenate([tiled, np.zeros(grid_bits - len(tiled), dtype=np.uint8)])

    # -- 5. Reshape and convert to float32 tensor --
    grid   = tiled.reshape(H, W).astype(np.float32)
    tensor = torch.from_numpy(grid).unsqueeze(0)        # (1, H, W)
    return tensor


def bit_tensor_to_bytes(tensor: torch.Tensor) -> bytes:
    """
    Decode a (1, H, W) binary tensor (output of StegDecoder) back to raw bytes.

    ECC Decoding (Majority Vote):
        1. Flatten the (H, W) grid to (grid_bits,).
        2. Take the first ECC_TOTAL_BITS = ECC_MSG_BITS * ECC_REPS bits.
        3. Reshape to (ECC_REPS, ECC_MSG_BITS) — each row is one copy.
        4. Sum across rows: each column gets a vote count in [0, ECC_REPS].
        5. Majority vote: bit = 1 if sum >= ceil(ECC_REPS / 2) else 0.
        6. Read the 16-bit header from the voted message block.
        7. Extract payload_len bytes of payload.

    This corrects up to ~15% raw BER from the neural network.

    Args:
        tensor : Shape (1, H, W) or (H, W), soft probabilities or hard bits.

    Returns:
        Raw bytes of the hidden payload.

    Raises:
        ValueError if the voted length header is still corrupt (> capacity).
    """
    # Handle both (1, H, W) and (H, W) shapes
    if tensor.dim() == 3:
        tensor = tensor.squeeze(0)                   # (H, W)

    H, W = tensor.shape
    grid_bits    = H * W
    ecc_msg_bits = grid_bits // ECC_REPS
    ecc_total    = ecc_msg_bits * ECC_REPS
    capacity_bytes = (ecc_msg_bits - HEADER_BITS) // 8
    majority_threshold = ECC_REPS // 2 + 1          # 16 out of 31

    # Threshold to hard bits
    bits = (tensor > 0.5).cpu().numpy().astype(np.uint8).flatten()  # (grid_bits,)

    # -- 1. Take only the ECC-valid portion --
    ecc_bits = bits[:ecc_total]                      # (ecc_total,)

    # -- 2. Reshape to (ECC_REPS, ecc_msg_bits) and majority vote --
    votes     = ecc_bits.reshape(ECC_REPS, ecc_msg_bits)      # (31, 2114)
    msg_bits  = (votes.sum(axis=0) >= majority_threshold).astype(np.uint8)  # (2114,)

    # -- 3. Read the 16-bit length header --
    header_bits  = msg_bits[:HEADER_BITS]
    header_bytes = _bits_to_bytes(header_bits)
    payload_len  = struct.unpack(">H", header_bytes)[0]

    if payload_len > capacity_bytes:
        raise ValueError(
            f"Decoded length header ({payload_len}) exceeds ECC capacity "
            f"({capacity_bytes} bytes). The stego image may be corrupted beyond recovery."
        )

    # -- 4. Extract exactly payload_len * 8 payload bits --
    start = HEADER_BITS
    end   = HEADER_BITS + payload_len * 8
    payload_bits = msg_bits[start:end]

    # -- 5. Convert bits back to bytes --
    return _bits_to_bytes(payload_bits)


def text_to_bit_tensor(
    text: str,
    H: int = GRID_H,
    W: int = GRID_W,
    encoding: str = "utf-8",
) -> torch.Tensor:
    """
    Convenience wrapper: encode a Python string into a (1, H, W) bit tensor.

    The Shamir shard strings produced by crypto_utils.py have the format:
        "<index>-<hex_value>"   e.g.  "1-3f4a9b7c..."
    These are pure ASCII and encode cleanly to UTF-8.

    Args:
        text     : The string to hide (e.g., a Shamir shard).
        H, W     : Grid dimensions.
        encoding : Text encoding. Default "utf-8".

    Returns:
        Tensor (1, H, W) float32 with bit values {0.0, 1.0}.
    """
    return bytes_to_bit_tensor(text.encode(encoding), H, W)


def bit_tensor_to_text(
    tensor: torch.Tensor,
    encoding: str = "utf-8",
) -> str:
    """
    Convenience wrapper: decode a (1, H, W) bit tensor back to a Python string.

    Uses the ECC majority-vote decoder for robust extraction even at high BER.

    Args:
        tensor   : Output from StegDecoder, shape (1, H, W) or (H, W).
        encoding : Expected text encoding. Default "utf-8".

    Returns:
        The reconstructed shard string.

    Raises:
        UnicodeDecodeError if the recovered bytes are not valid text.
        ValueError if the length header is corrupt beyond ECC recovery.
    """
    raw = bit_tensor_to_bytes(tensor)
    return raw.decode(encoding)


def shard_capacity_check(
    text: str,
    H: int = GRID_H,
    W: int = GRID_W,
    encoding: str = "utf-8",
) -> dict:
    """
    Diagnostic utility. Returns a dict with capacity stats for a given shard string.

    Returns a dict with keys:
        shard_len_chars     : number of characters in the shard string
        shard_len_bytes     : byte length when UTF-8 encoded
        shard_len_bits      : bit length including the 16-bit header
        ecc_reps            : number of repetitions (ECC_REPS)
        ecc_msg_bits        : bits per message block
        grid_capacity_bits  : total bit capacity of the grid
        usage_pct           : percentage of one message block used
        fits                : True if the shard fits in the ECC message block
        max_payload_bytes   : maximum bytes that can be hidden per message block
        max_correctable_ber : BER the ECC can tolerate (theoretical)
    """
    encoded      = text.encode(encoding)
    shard_bytes  = len(encoded)
    shard_bits   = shard_bytes * 8 + HEADER_BITS
    grid_bits    = H * W
    ecc_msg_bits = grid_bits // ECC_REPS
    capacity     = (ecc_msg_bits - HEADER_BITS) // 8
    fits         = shard_bytes <= capacity

    return {
        "shard_len_chars"    : len(text),
        "shard_len_bytes"    : shard_bytes,
        "shard_len_bits"     : shard_bits,
        "ecc_reps"           : ECC_REPS,
        "ecc_msg_bits"       : ecc_msg_bits,
        "grid_capacity_bits" : grid_bits,
        "usage_pct"          : round(shard_bits / ecc_msg_bits * 100, 2),
        "fits"               : fits,
        "max_payload_bytes"  : capacity,
        "max_correctable_ber": "~15% (ECC_REPS=31, majority threshold=16)",
    }


# ── Self-test ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding="utf-8")

    print("=" * 60)
    print("  Bit Conversion Pipeline -- Self-Test (ECC Enabled)")
    print("=" * 60)

    import secrets
    fake_shard = f"3-{secrets.token_hex(66)}"   # ~133 chars, realistic shard
    print(f"\n[1] Simulated shard string ({len(fake_shard)} chars):")
    print(f"    {fake_shard[:60]}...")

    info = shard_capacity_check(fake_shard)
    print(f"\n[2] ECC Capacity check:")
    print(f"    Shard size    : {info['shard_len_bytes']} bytes")
    print(f"    ECC reps      : {info['ecc_reps']}×")
    print(f"    Msg block     : {info['ecc_msg_bits']} bits ({info['max_payload_bytes']} bytes capacity)")
    print(f"    Usage         : {info['usage_pct']}% of one message block")
    print(f"    Fits          : {info['fits']}")
    print(f"    Max BER tol.  : {info['max_correctable_ber']}")
    assert info["fits"], "Shard does not fit in ECC message block!"

    print(f"\n[3] Encoding shard to ECC bit tensor...")
    tensor = text_to_bit_tensor(fake_shard)
    print(f"    Output shape  : {tensor.shape}")
    assert tensor.shape == (1, 256, 256)

    print(f"\n[4] Perfect roundtrip...")
    recovered = bit_tensor_to_text(tensor)
    assert recovered == fake_shard, f"Mismatch!\n  Original : {fake_shard}\n  Recovered: {recovered}"
    print(f"    Match : PERFECT")

    print(f"\n[5] Noisy roundtrip at 8% BER (simulating current U-Net)...")
    noise_mask   = (torch.rand_like(tensor) < 0.08).float()
    noisy_tensor = ((tensor + noise_mask) % 2)
    flipped      = int(noise_mask.sum().item())
    print(f"    Bits flipped  : {flipped} / {256*256}  ({100*flipped/(256*256):.1f}%)")
    recovered_noisy = bit_tensor_to_text(noisy_tensor)
    match = recovered_noisy == fake_shard
    print(f"    ECC recovered : {'PERFECT ✓' if match else 'FAILED ✗'}")
    if not match:
        errors = sum(a != b for a, b in zip(recovered_noisy, fake_shard))
        print(f"    Character errors: {errors}")

    print(f"\n[6] Noisy roundtrip at 14% BER (near ECC limit)...")
    noise_mask2   = (torch.rand_like(tensor) < 0.14).float()
    noisy_tensor2 = ((tensor + noise_mask2) % 2)
    flipped2      = int(noise_mask2.sum().item())
    print(f"    Bits flipped  : {flipped2} / {256*256}  ({100*flipped2/(256*256):.1f}%)")
    try:
        recovered2 = bit_tensor_to_text(noisy_tensor2)
        match2 = recovered2 == fake_shard
        print(f"    ECC recovered : {'PERFECT ✓' if match2 else 'FAILED ✗'}")
    except Exception as e:
        print(f"    ECC recovered : FAILED ({e})")

    print("\n" + "=" * 60)
    print("  SELF-TEST COMPLETE")
    print("=" * 60)
