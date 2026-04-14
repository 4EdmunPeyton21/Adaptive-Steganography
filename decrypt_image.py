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
    global _model
    if _model is None:
        _model = CamouflageNet().to(DEVICE)
        if os.path.exists(WEIGHTS_PATH):
            _model.load_state_dict(torch.load(WEIGHTS_PATH, map_location=DEVICE))
            _model.eval()
    return _model

def decrypt_logic(stego_path, output_file_path, password):
    """
    Core Logic for Extraction and Decryption.
    """
    # 1. Load Stego Image
    stego_img = cv2.imread(stego_path)
    if stego_img is None:
        raise FileNotFoundError(f"Cannot find stego image: {stego_path}")

    img_rgb = cv2.cvtColor(stego_img, cv2.COLOR_BGR2RGB)
    h, w, _ = img_rgb.shape
    
    # 2. Re-generate AI Heatmap
    # We must resize to 256x256 to match the training dimensions
    img_resized = cv2.resize(img_rgb, (256, 256))
    img_tensor = torch.from_numpy(img_resized).permute(2, 0, 1).float().unsqueeze(0).to(DEVICE) / 255.0

    model = get_model()
    with torch.no_grad():
        heatmap_tensor = model(img_tensor).squeeze().cpu().numpy()
    
    # Scale heatmap back to original size to locate hidden bits
    heatmap = cv2.resize(heatmap_tensor, (w, h), interpolation=cv2.INTER_CUBIC)

    # 3. Extract Bitstream
    print("[*] Extracting data from AI-defined regions...")
    engine = AdaptiveEngine(stego_img, heatmap)
    encrypted_data, tag, nonce = engine.extract()

    # 4. Decrypt and Verify Integrity
    cipher = AESCipher(password)
    try:
        decrypted_bytes = cipher.decrypt(encrypted_data, tag, nonce)
        with open(output_file_path, "wb") as f:
            f.write(decrypted_bytes)
        return True
    except Exception as e:
        print(f"\n[!] Integrity Error: Data may be corrupted or password incorrect. ({e})")
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="GhostDrive AI Decoder")
    parser.add_argument("--stego", required=True, help="Path to stego image")
    parser.add_argument("--out", required=True, help="Path to save recovered file")
    parser.add_argument("--pwd", required=True, help="AES Password")
    
    args = parser.parse_args()
    
    if decrypt_logic(args.stego, args.out, args.pwd):
        print(f"\n[+] Success! File recovered: {args.out}")