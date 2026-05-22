"""
═══════════════════════════════════════════════════════════════════
StegDecoder — Neural Steganography Extraction Network
═══════════════════════════════════════════════════════════════════

Architecture overview:
  - Input : Stego Image   (B, 3, 256, 256)  ← the carrier image from vault

  - Output: Bit Map       (B, 1, 256, 256)  ← probability per pixel {0→0.0, 1→1.0}

Design principles:
  1. Mirror the Encoder's spatial resolution — the Decoder must produce
     an output with the same H×W as the secret grid that was embedded.

  2. Deep feature extraction before the final prediction head — the
     embedded perturbations are very subtle (< 0.03 per pixel), so the
     network needs enough depth to amplify the steganographic signal.

  3. Sigmoid output — gives a probability per bit position.
     During inference:  bit = (prob > 0.5).float()
     During training:   use BCE loss against the ground-truth bit grid.

  4. No skip connections from the input image — unlike the Encoder, the
     Decoder should NOT "see" the original cover at any point. It must
     learn to extract the hidden signal purely from the stego pixels.

Usage:
  decoder    = StegDecoder()
  bit_probs  = decoder(stego_image)   # (B, 1, 256, 256)
  bit_grid   = (bit_probs > 0.5).float()
═══════════════════════════════════════════════════════════════════
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from models.encoder import ConvBnRelu, EncoderBlock, DecoderBlock

class StegDecoder(nn.Module):
    """
    Steganographic Extraction Network.

    Takes a stego image and predicts the hidden binary bit map.
    Uses a U-Net architecture so high-frequency pixel-level signals 
    can bypass the downsampling bottleneck via skip connections.
    """
    def __init__(self, base_ch: int = 32):
        super().__init__()
        b = base_ch

        # ── Input stem ────────────────────────────────────────────
        self.input_conv = ConvBnRelu(3, b)

        # ── Encoder path (down) ───────────────────────────────────
        self.enc1 = EncoderBlock(b,      b * 2)   # 256 → 128
        self.enc2 = EncoderBlock(b * 2,  b * 4)   # 128 →  64
        self.enc3 = EncoderBlock(b * 4,  b * 8)   #  64 →  32

        # ── Bottleneck ────────────────────────────────────────────
        self.bottleneck = nn.Sequential(
            ConvBnRelu(b * 8, b * 16),
            ConvBnRelu(b * 16, b * 16),
        )

        # ── Decoder path (up) with skip connections ───────────────
        self.dec3 = DecoderBlock(b * 16, b * 8,  b * 8)   #  32 →  64
        self.dec2 = DecoderBlock(b * 8,  b * 4,  b * 4)   #  64 → 128
        self.dec1 = DecoderBlock(b * 4,  b * 2,  b * 2)   # 128 → 256

        # ── Bit probability head ──────────────────────────────────
        self.bit_head = nn.Sequential(
            ConvBnRelu(b * 2, b),
            nn.Conv2d(b, 1, kernel_size=1),
            nn.Sigmoid(),
        )

    def forward(self, stego: torch.Tensor) -> torch.Tensor:
        """
        Args:
            stego: Tensor of shape (B, 3, 256, 256), pixel values in [0, 1].

        Returns:
            bit_probs: Tensor of shape (B, 1, 256, 256), values in [0, 1].
        """
        x = self.input_conv(stego)

        x, s1 = self.enc1(x)
        x, s2 = self.enc2(x)
        x, s3 = self.enc3(x)

        x = self.bottleneck(x)

        x = self.dec3(x, s3)
        x = self.dec2(x, s2)
        x = self.dec1(x, s1)

        bit_probs = self.bit_head(x)
        return bit_probs

    def extract_bits(self, stego: torch.Tensor, threshold: float = 0.5) -> torch.Tensor:
        with torch.no_grad():
            probs = self.forward(stego)
        return (probs > threshold).float()

if __name__ == "__main__":
    print("Booting StegDecoder (Flat version)...")
    model = StegDecoder(base_ch=32)
    B = 2
    stego = torch.rand(B, 3, 256, 256)
    bit_probs = model(stego)
    print(f"Output shape: {bit_probs.shape} (Expected B, 1, 256, 256)")
    print("StegDecoder structural check PASSED.")
