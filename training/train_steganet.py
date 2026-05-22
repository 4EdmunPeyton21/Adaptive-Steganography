"""
================================================================================
training/train_steganet.py  --  End-to-End Steganography GAN Training Loop
================================================================================

Networks being trained:
    StegEncoder   (E)   -- hides bits inside cover images
    StegDecoder   (D)   -- extracts bits from stego images
    Steganalyzer  (S)   -- tries to detect steganographic images (adversary)

Frozen (pre-trained weights loaded, gradients disabled):
    CamouflageNet (C)   -- generates capacity maps (where in the image to hide)
                          Weights: models/weights/camou_net_adversarial.pth

Training objective (3 competing losses):
    loss_extraction    : BCE(extracted_bits, original_bits)      <- can we read it back?
    loss_imperceptible : MSE(stego_image,   cover_image)         <- does it look the same?
    loss_adversarial   : BCE(steganalyzer(stego), real_label)    <- does it fool the detector?

    Generator total = lambda_read * loss_extraction
                    + lambda_hide * loss_imperceptible
                    + lambda_adv  * loss_adversarial

    Discriminator   = 0.5 * (BCE(S(cover), 1) + BCE(S(stego.detach()), 0))

Convergence goal:
    - Steganalyzer accuracy ~50%  (cannot distinguish cover from stego)
    - Bit Error Rate (BER)  ~0%   (perfect message recovery)
    - PSNR between cover and stego > 40 dB (imperceptible to human eye)

Hardware:
    Designed for RTX 3050 (4 GB VRAM).
    AMP (Automatic Mixed Precision) is ON by default — halves VRAM usage.
    Batch size 2 is safe on 4 GB; increase to 4 if you have 6+ GB.

Usage:
    python -m training.train_steganet
    python -m training.train_steganet --epochs 50 --batch_size 4
================================================================================
"""

from __future__ import annotations

import argparse
import math
import os
import time
from pathlib import Path

import cv2
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.amp import GradScaler, autocast
from torch.utils.data import DataLoader, Dataset

# -- Our models --
from models.camouflage_net import CamouflageNet
from models.encoder       import StegEncoder
from models.decoder       import StegDecoder
from models.steganalyzer  import Steganalyzer


# ── Paths ─────────────────────────────────────────────────────────────────────

ROOT         = Path(__file__).resolve().parent.parent
WEIGHTS_DIR  = ROOT / "models" / "weights"
CAMOU_WEIGHTS = WEIGHTS_DIR / "camou_net_adversarial.pth"
DATA_DIR     = ROOT / "input_dataset"

WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)


# ── Loss weights ───────────────────────────────────────────────────────────────

# FIX: The AI was previously penalized 50x more for changing pixels than it was 
# rewarded for hiding data. It learned the "lazy" solution: do nothing to the image.
# We must heavily prioritize the extraction channel (LAMBDA_READ) to break the 0.5 BER.
LAMBDA_READ = 100.0  # BCE: bit extraction accuracy  (Massively boosted)
LAMBDA_HIDE = 1.0    # MSE: pixel imperceptibility   (Lowered to 1.0 so U-Net focuses purely on bits)
LAMBDA_ADV  = 0.001  # BCE: fool the steganalyzer    (Low weight)


# ── Dataset ───────────────────────────────────────────────────────────────────

class CoverDataset(Dataset):
    """
    Loads cover images from input_dataset/.
    Returns normalised float tensors (3, 256, 256) in [0, 1].
    Secret bit maps are generated on-the-fly in the training loop
    (random binary tensors) — not stored on disk.
    """

    def __init__(self, folder: Path, size: int = 256):
        self.paths = sorted(
            p for ext in ("*.png", "*.jpg", "*.jpeg")
            for p in folder.glob(ext)
        )
        if not self.paths:
            raise FileNotFoundError(
                f"No images found in {folder}. Run get_data.py first!"
            )
        self.size = size

    def __len__(self) -> int:
        return len(self.paths)

    def __getitem__(self, idx: int) -> torch.Tensor:
        bgr  = cv2.imread(str(self.paths[idx]))
        rgb  = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        img  = cv2.resize(rgb, (self.size, self.size), interpolation=cv2.INTER_LANCZOS4)
        t    = torch.from_numpy(img).permute(2, 0, 1).float() / 255.0  # (3, H, W)
        return t


# ── Metrics helpers ────────────────────────────────────────────────────────────

def compute_psnr(img1: torch.Tensor, img2: torch.Tensor) -> float:
    """Peak Signal-to-Noise Ratio in dB. > 40 dB = imperceptible."""
    mse = torch.mean((img1 - img2) ** 2).item()
    if mse == 0:
        return float("inf")
    return 10 * math.log10(1.0 / mse)


def compute_ber(extracted: torch.Tensor, original: torch.Tensor) -> float:
    """Bit Error Rate in [0, 1]. Goal: < 0.01 (< 1% error)."""
    hard = (extracted.detach() > 0.5).float()
    return (hard != original).float().mean().item()


# ── Training ───────────────────────────────────────────────────────────────────

def train(
    epochs: int     = 30,
    batch_size: int = 2,
    lr_gen: float   = 2e-4,
    lr_disc: float  = 1e-4,
    save_every: int = 5,
    seed: int       = 42,
) -> None:
    """
    Main training loop for the steganography GAN.

    Args:
        epochs      : Number of training epochs.
        batch_size  : Images per batch. Use 2 for 4 GB VRAM, 4 for 6+ GB.
        lr_gen      : Learning rate for Encoder + Decoder.
        lr_disc     : Learning rate for Steganalyzer.
        save_every  : Save checkpoint every N epochs.
        seed        : Random seed for reproducibility.
    """
    torch.manual_seed(seed)
    np.random.seed(seed)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    use_amp = device.type == "cuda"
    print(f"[*] Device      : {device}  (AMP={'ON' if use_amp else 'OFF'})")

    # ── 1. Load models ────────────────────────────────────────────────────────

    # CamouflageNet: frozen — only used to compute capacity maps
    camou_net = CamouflageNet().to(device)
    if CAMOU_WEIGHTS.exists():
        state = torch.load(CAMOU_WEIGHTS, map_location=device, weights_only=True)
        camou_net.load_state_dict(state)
        print(f"[*] CamouflageNet weights loaded from {CAMOU_WEIGHTS.name}")
    else:
        print(f"[!] WARNING: {CAMOU_WEIGHTS} not found — using random CamouflageNet weights.")
    camou_net.eval()
    for p in camou_net.parameters():
        p.requires_grad = False  # FROZEN — do not train

    encoder     = StegEncoder(base_ch=32).to(device)
    decoder     = StegDecoder(base_ch=32).to(device)
    steganalyzer = Steganalyzer().to(device)

    enc_params  = sum(p.numel() for p in encoder.parameters()      if p.requires_grad)
    dec_params  = sum(p.numel() for p in decoder.parameters()      if p.requires_grad)
    disc_params = sum(p.numel() for p in steganalyzer.parameters() if p.requires_grad)
    print(f"[*] StegEncoder      : {enc_params:>10,} params")
    print(f"[*] StegDecoder      : {dec_params:>10,} params")
    print(f"[*] Steganalyzer     : {disc_params:>10,} params")

    # ── 2. Loss functions ─────────────────────────────────────────────────────

    bce = nn.BCELoss()    # for bit extraction + adversarial
    mse = nn.MSELoss()    # for pixel imperceptibility

    # ── 3. Optimizers ─────────────────────────────────────────────────────────

    # Generator = Encoder + Decoder trained jointly
    optimizer_G = optim.Adam(
        list(encoder.parameters()) + list(decoder.parameters()),
        lr=lr_gen, betas=(0.5, 0.999)
    )
    optimizer_D = optim.Adam(
        steganalyzer.parameters(),
        lr=lr_disc, betas=(0.5, 0.999)
    )

    # Reduce LR on plateau — helps convergence past early epochs
    scheduler_G = optim.lr_scheduler.ReduceLROnPlateau(
        optimizer_G, mode="min", factor=0.5, patience=3
    )
    scheduler_D = optim.lr_scheduler.ReduceLROnPlateau(
        optimizer_D, mode="min", factor=0.5, patience=3
    )

    # ── 4. AMP scaler ─────────────────────────────────────────────────────────

    scaler_G = GradScaler(device=device.type, enabled=use_amp)
    scaler_D = GradScaler(device=device.type, enabled=use_amp)

    # ── 5. Dataloader ─────────────────────────────────────────────────────────

    dataset    = CoverDataset(DATA_DIR)
    dataloader = DataLoader(
        dataset, batch_size=batch_size, shuffle=True,
        num_workers=2, pin_memory=(device.type == "cuda"),
        drop_last=True
    )
    print(f"[*] Dataset         : {len(dataset)} images  |  {len(dataloader)} batches/epoch")

    # Pre-make label tensors (avoid re-allocating each step)
    label_real = torch.ones (batch_size, 1, device=device)
    label_fake = torch.zeros(batch_size, 1, device=device)

    print(f"\n[*] Starting training for {epochs} epoch(s)...\n")
    print(f"{'Epoch':>6} {'D_Loss':>8} {'G_Loss':>8} "
          f"{'Ext_Loss':>9} {'Hide_Loss':>10} {'Adv_Loss':>9} "
          f"{'BER':>7} {'PSNR':>7} {'Time':>7}")
    print("-" * 82)

    best_ber  = 1.0
    best_psnr = 0.0

    for epoch in range(1, epochs + 1):
        epoch_start = time.time()

        # Running accumulators
        sum_d_loss = sum_g_loss = 0.0
        sum_ext    = sum_hide   = sum_adv = 0.0
        sum_ber    = sum_psnr   = 0.0

        encoder.train()
        decoder.train()
        steganalyzer.train()

        for cover in dataloader:
            cover = cover.to(device)          # (B, 3, 256, 256)
            B     = cover.size(0)

            # Random binary secret map — B × 1 × 256 × 256 of {0.0, 1.0}
            secret = torch.randint(0, 2, (B, 1, 256, 256),
                                   device=device, dtype=torch.float32)

            # ── Capacity map from frozen CamouflageNet ────────────────────
            with torch.no_grad():
                capacity = camou_net(cover)   # (B, 1, 256, 256)

            # ── Forward: Encoder produces stego image ─────────────────────
            with autocast(device_type=device.type, enabled=use_amp):
                stego = encoder(cover, secret, capacity)   # (B, 3, 256, 256)

            # ──────────────────────────────────────────────────────────────
            # PHASE 1: Train Steganalyzer (Discriminator / Police)
            # Only train the police after Epoch 15 (let the U-Net figure out 
            # how to hide data perfectly first, otherwise it gets crushed).
            # ──────────────────────────────────────────────────────────────
            if epoch > 15:
                optimizer_D.zero_grad(set_to_none=True)

                with autocast(device_type=device.type, enabled=use_amp):
                    d_real = steganalyzer(cover)
                    d_fake = steganalyzer(stego.detach())

                # BCELoss must be computed outside autocast
                loss_d_real = bce(d_real.float(), label_real[:B].float())
                loss_d_fake = bce(d_fake.float(), label_fake[:B].float())
                loss_D = 0.5 * (loss_d_real + loss_d_fake)

                scaler_D.scale(loss_D).backward()
                scaler_D.step(optimizer_D)
                scaler_D.update()
            else:
                loss_D = torch.tensor(0.0)

            # ──────────────────────────────────────────────────────────────
            # PHASE 2: Train Encoder + Decoder (Generator / Smugglers)
            # Goal: hide the bits invisibly AND recover them perfectly
            # ──────────────────────────────────────────────────────────────
            optimizer_G.zero_grad(set_to_none=True)

            with autocast(device_type=device.type, enabled=use_amp):
                extracted = decoder(stego)                 # (B, 1, 256, 256)
                if epoch > 15:
                    d_fooled  = steganalyzer(stego)

            # Compute losses outside autocast block to avoid AMP errors
            loss_ext  = bce(extracted.float(), secret.float())
            loss_hide = mse(stego.float(), cover.float())

            if epoch > 15:
                loss_adv  = bce(d_fooled.float(), label_real[:B].float())
            else:
                loss_adv  = torch.tensor(0.0, device=device)

            # Weighted total generator loss
            loss_G = (LAMBDA_READ * loss_ext
                    + LAMBDA_HIDE * loss_hide
                    + LAMBDA_ADV  * loss_adv)

            scaler_G.scale(loss_G).backward()
            scaler_G.step(optimizer_G)
            scaler_G.update()

            # ── Metrics (no_grad — cheap) ─────────────────────────────────
            with torch.no_grad():
                ber  = compute_ber(extracted, secret)
                psnr = compute_psnr(stego.float(), cover.float())

            sum_d_loss += loss_D.item()
            sum_g_loss += loss_G.item()
            sum_ext    += loss_ext.item()
            sum_hide   += loss_hide.item()
            sum_adv    += loss_adv.item()
            sum_ber    += ber
            sum_psnr   += psnr

        # ── Epoch averages ─────────────────────────────────────────────────
        n = len(dataloader)
        avg_d    = sum_d_loss / n
        avg_g    = sum_g_loss / n
        avg_ext  = sum_ext    / n
        avg_hide = sum_hide   / n
        avg_adv  = sum_adv    / n
        avg_ber  = sum_ber    / n
        avg_psnr = sum_psnr   / n
        elapsed  = time.time() - epoch_start

        # Scheduler step (based on extraction loss — the primary goal)
        scheduler_G.step(avg_ext)
        scheduler_D.step(avg_d)

        print(
            f"{epoch:>6}/{epochs}  "
            f"{avg_d:>8.4f}  {avg_g:>8.4f}  "
            f"{avg_ext:>9.4f}  {avg_hide:>10.6f}  {avg_adv:>9.4f}  "
            f"{avg_ber:>7.4f}  {avg_psnr:>7.2f}  {elapsed:>5.1f}s"
        )

        # ── Track best model ───────────────────────────────────────────────
        if avg_ber < best_ber:
            best_ber = avg_ber
            torch.save(encoder.state_dict(),      WEIGHTS_DIR / "encoder_best.pth")
            torch.save(decoder.state_dict(),      WEIGHTS_DIR / "decoder_best.pth")
            torch.save(steganalyzer.state_dict(), WEIGHTS_DIR / "steganalyzer_best.pth")
            print(f"         [+] New best BER={best_ber:.4f} — weights saved.")

        if avg_psnr > best_psnr:
            best_psnr = avg_psnr

        # ── Periodic checkpoint ────────────────────────────────────────────
        if epoch % save_every == 0:
            torch.save(encoder.state_dict(),      WEIGHTS_DIR / f"encoder_epoch_{epoch}.pth")
            torch.save(decoder.state_dict(),      WEIGHTS_DIR / f"decoder_epoch_{epoch}.pth")
            torch.save(steganalyzer.state_dict(), WEIGHTS_DIR / f"steganalyzer_epoch_{epoch}.pth")
            print(f"         [*] Checkpoint saved at epoch {epoch}.")

    # ── Final save ─────────────────────────────────────────────────────────────
    torch.save(encoder.state_dict(),      WEIGHTS_DIR / "encoder_final.pth")
    torch.save(decoder.state_dict(),      WEIGHTS_DIR / "decoder_final.pth")
    torch.save(steganalyzer.state_dict(), WEIGHTS_DIR / "steganalyzer_final.pth")

    print("\n" + "=" * 82)
    print(f"  Training complete.")
    print(f"  Best BER  : {best_ber:.4f}   (goal: < 0.01)")
    print(f"  Best PSNR : {best_psnr:.2f} dB  (goal: > 40 dB)")
    print(f"  Weights   : {WEIGHTS_DIR}")
    print("=" * 82)


# ── CLI entry point ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train the Cuttlefish Steganography GAN")
    parser.add_argument("--epochs",     type=int,   default=30,  help="Number of epochs (default: 30)")
    parser.add_argument("--batch_size", type=int,   default=2,   help="Batch size (default: 2, use 4 for 6+ GB VRAM)")
    parser.add_argument("--lr_gen",     type=float, default=2e-4, help="Generator learning rate")
    parser.add_argument("--lr_disc",    type=float, default=1e-4, help="Discriminator learning rate")
    parser.add_argument("--save_every", type=int,   default=5,   help="Save checkpoint every N epochs")
    args = parser.parse_args()

    train(
        epochs     = args.epochs,
        batch_size = args.batch_size,
        lr_gen     = args.lr_gen,
        lr_disc    = args.lr_disc,
        save_every = args.save_every,
    )
