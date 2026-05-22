"""
═══════════════════════════════════════════════════════════════════
StegEncoder — Neural Steganography Embedding Network
═══════════════════════════════════════════════════════════════════

Architecture overview:
  - Input : Cover Image   (B, 3, 256, 256)  ← the host/carrier image
             Secret Map    (B, 1, 256, 256)  ← binary payload as 2D bit grid
             Capacity Map  (B, 1, 256, 256)  ← from CamouflageNet (where to hide)

  - Output: Stego Image   (B, 3, 256, 256)  ← visually identical to cover

Design principles:
  1. Residual embedding: stego = cover + delta
     The network only learns the *perturbation*, not the full image.
     This biases the output to stay close to the cover (imperceptibility).

  2. Capacity-weighted delta: delta = capacity_map * raw_delta
     Forces the network to embed data only in textured/busy regions
     (where human vision is least sensitive to change).

  3. U-Net skip connections preserve spatial precision so fine pixel
     details from the cover are faithfully carried to the output.

Usage:
  encoder = StegEncoder()
  stego   = encoder(cover, secret_map, capacity_map)
  # stego.shape == (B, 3, 256, 256), pixel values clamped to [0, 1]
═══════════════════════════════════════════════════════════════════
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


# ── Building Blocks ───────────────────────────────────────────────

class ConvBnRelu(nn.Module):
    """Conv2d → BatchNorm2d → ReLU  (standard residual building block)."""
    def __init__(self, in_ch: int, out_ch: int, kernel: int = 3, stride: int = 1):
        super().__init__()
        padding = kernel // 2
        self.block = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, kernel, stride=stride, padding=padding, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.block(x)


class EncoderBlock(nn.Module):
    """Downsampling block: ConvBnRelu × 2 → MaxPool."""
    def __init__(self, in_ch: int, out_ch: int):
        super().__init__()
        self.conv = nn.Sequential(
            ConvBnRelu(in_ch, out_ch),
            ConvBnRelu(out_ch, out_ch),
        )
        self.pool = nn.MaxPool2d(2)

    def forward(self, x: torch.Tensor):
        skip = self.conv(x)   # saved for skip connection
        down = self.pool(skip)
        return down, skip


class DecoderBlock(nn.Module):
    """Upsampling block: bilinear upsample → concat skip → ConvBnRelu × 2."""
    def __init__(self, in_ch: int, skip_ch: int, out_ch: int):
        super().__init__()
        self.up   = nn.Upsample(scale_factor=2, mode="bilinear", align_corners=True)
        self.conv = nn.Sequential(
            ConvBnRelu(in_ch + skip_ch, out_ch),
            ConvBnRelu(out_ch, out_ch),
        )

    def forward(self, x: torch.Tensor, skip: torch.Tensor) -> torch.Tensor:
        x = self.up(x)
        # Pad in case spatial dims differ by 1 pixel (odd input sizes)
        dh = skip.size(2) - x.size(2)
        dw = skip.size(3) - x.size(3)
        x = F.pad(x, [dw // 2, dw - dw // 2, dh // 2, dh - dh // 2])
        return self.conv(torch.cat([x, skip], dim=1))


# ── StegEncoder ───────────────────────────────────────────────────

class StegEncoder(nn.Module):
    """
    Steganographic Embedding Network.

    Args:
        base_ch (int): Base channel width. Default 32 (lightweight for CPU/small GPU).
                       Increase to 64 for better quality with a capable GPU.
    """

    def __init__(self, base_ch: int = 32):
        super().__init__()
        b = base_ch

        # ── Input fusion ──────────────────────────────────────────
        # Concatenate cover (3ch) + secret bits (1ch) + capacity map (1ch) = 5ch
        self.input_conv = ConvBnRelu(5, b)

        # ── Encoder path (down) ───────────────────────────────────
        self.enc1 = EncoderBlock(b,      b * 2)   # 256 → 128
        self.enc2 = EncoderBlock(b * 2,  b * 4)   # 128 →  64
        self.enc3 = EncoderBlock(b * 4,  b * 8)   #  64 →  32

        # ── Bottleneck ────────────────────────────────────────────
        self.bottleneck = nn.Sequential(
            ConvBnRelu(b * 8, b * 16),
            ConvBnRelu(b * 16, b * 16),
        )

        # ── Decoder path (up) ─────────────────────────────────────
        self.dec3 = DecoderBlock(b * 16, b * 8,  b * 8)   #  32 →  64
        self.dec2 = DecoderBlock(b * 8,  b * 4,  b * 4)   #  64 → 128
        self.dec1 = DecoderBlock(b * 4,  b * 2,  b * 2)   # 128 → 256

        # ── Delta output head ─────────────────────────────────────
        # Outputs a 3-channel perturbation map (one per RGB channel).
        # tanh keeps values in [-1, 1]; multiplied by a small epsilon
        # at forward time to keep perturbations invisible.
        self.delta_head = nn.Sequential(
            ConvBnRelu(b * 2, b),
            nn.Conv2d(b, 3, kernel_size=1),  # 1×1 conv — pixel-wise projection
            nn.Tanh(),
        )

        # Maximum allowed perturbation per pixel (controls invisibility vs capacity)
        # Increased to 0.08 to give the U-Net enough signal strength to drop BER to 0.00
        self.epsilon = 0.08

    def forward(
        self,
        cover: torch.Tensor,        # (B, 3, 256, 256)  — normalised [0, 1]
        secret: torch.Tensor,       # (B, 1, 256, 256)  — binary {0, 1} or soft [0, 1]
        capacity_map: torch.Tensor, # (B, 1, 256, 256)  — CamouflageNet output [0, 1]
    ) -> torch.Tensor:
        """
        Returns the stego image clamped to [0, 1].
        """
        # 1. Fuse all inputs into a 5-channel tensor
        x = torch.cat([cover, secret, capacity_map], dim=1)   # (B, 5, H, W)
        x = self.input_conv(x)

        # 2. Encode (save skips)
        x, s1 = self.enc1(x)
        x, s2 = self.enc2(x)
        x, s3 = self.enc3(x)

        # 3. Bottleneck
        x = self.bottleneck(x)

        # 4. Decode with skip connections
        x = self.dec3(x, s3)
        x = self.dec2(x, s2)
        x = self.dec1(x, s1)

        # 5. Compute the raw delta (perturbation)
        raw_delta = self.delta_head(x)   # (B, 3, H, W) ∈ [-1, 1]

        # 6. Weight by capacity map — only embed in textured regions
        #    Broadcast capacity_map from (B,1,H,W) to (B,3,H,W)
        weighted_delta = raw_delta * (capacity_map + 0.1) * self.epsilon

        # 7. Add perturbation to cover, clamp to valid image range
        stego = torch.clamp(cover + weighted_delta, 0.0, 1.0)
        return stego


# ── Quick sanity check ────────────────────────────────────────────

if __name__ == "__main__":
    print("Booting StegEncoder...")

    model = StegEncoder(base_ch=32)
    total_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"Trainable parameters : {total_params:,}")

    B = 2
    cover        = torch.rand(B, 3, 256, 256)   # fake cover images
    secret_map   = torch.randint(0, 2, (B, 1, 256, 256)).float()  # binary bit grid
    capacity_map = torch.rand(B, 1, 256, 256)   # fake CamouflageNet output

    stego = model(cover, secret_map, capacity_map)
    print(f"Cover  shape : {cover.shape}")
    print(f"Secret shape : {secret_map.shape}")
    print(f"Stego  shape : {stego.shape}  <- must match cover")

    max_diff = (stego - cover).abs().max().item()
    print(f"Max pixel diff (cover vs stego): {max_diff:.6f}  <- should be <= epsilon ({model.epsilon})")
    assert stego.shape == cover.shape, "Shape mismatch!"
    print("StegEncoder structural check PASSED.")
