import torch
import cv2
import numpy as np
import os
import argparse
from models.camouflage_net import CamouflageNet
from adaptive_engine import AdaptiveEngine
from crypto_utils import AESCipher

# --- Configuration ---
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
WEIGHTS_PATH = "models/weights/camou_net_adversarial.pth"

_model = None

def get_model():
    """Efficiently loads the model into VRAM."""
    global _model
    if _model is None:
        _model = CamouflageNet().to(DEVICE)
        if os.path.exists(WEIGHTS_PATH):
            _model.load_state_dict(torch.load(WEIGHTS_PATH, map_location=DEVICE))
            _model.eval()
            print(f"[*] Loaded Adversarial Stealth Weights: {WEIGHTS_PATH}")
        else:
            print("[!] Warning: Adversarial weights not found. Check your models/weights/ folder.")
    return _model

def encrypt_logic(cover_path, secret_path, output_path, password):
    """
    Core Logic for Encryption and AI-driven Embedding.
    """
    # 1. AES-256-GCM Encryption
    cipher = AESCipher(password)
    with open(secret_path, "rb") as f:
        secret_bytes = f.read()
    
    # encrypted_data contains the payload; tag/nonce handle integrity
    encrypted_data, tag, nonce = cipher.encrypt(secret_bytes)

    # 2. Cover Image Processing
    img = cv2.imread(cover_path)
    if img is None:
        raise FileNotFoundError(f"Could not load image at {cover_path}")
    
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    h, w, _ = img_rgb.shape
    
    # Resize for AI brain (256x256), then scale heatmap back to original
    img_resized = cv2.resize(img_rgb, (256, 256))
    img_tensor = torch.from_numpy(img_resized).permute(2, 0, 1).float().unsqueeze(0).to(DEVICE) / 255.0

    # 3. Generate Adaptive Stealth Map
    model = get_model()
    with torch.no_grad():
        heatmap_tensor = model(img_tensor).squeeze().cpu().numpy()
    
    # Use CUBIC interpolation for a smooth importance map at high res
    heatmap = cv2.resize(heatmap_tensor, (w, h), interpolation=cv2.INTER_CUBIC)

    # 4. Adaptive Embedding
    print("[*] Running Adaptive AI Smuggler...")
    engine = AdaptiveEngine(img, heatmap)
    
    try:
        stego_img = engine.embed(encrypted_data, tag, nonce)
        cv2.imwrite(output_path, stego_img)
        return True
    except ValueError as e:
        print(f"[!] Capacity Error: {e}")
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="GhostDrive AI Encoder")
    parser.add_argument("--cover", required=True, help="Path to cover image")
    parser.add_argument("--secret", required=True, help="File to hide")
    parser.add_argument("--out", default="stego_vault.png", help="Output path")
    parser.add_argument("--pwd", required=True, help="AES Password")
    
    args = parser.parse_args()
    
    if encrypt_logic(args.cover, args.secret, args.out, args.pwd):
        print(f"\n[+] Success! Stego-vault created: {args.out}")