import cv2
import numpy as np
import torch
import os
from models.camouflage_net import CamouflageNet
from stego.adaptive_engine import AdaptiveEngine
from stego.crypto_utils import CryptoHandler

# This function is copied from your decrypt_image.py for a quick test
def extract_and_decrypt(bits, password):
    idx = bits.find("10101010")
    if idx == -1: return None
    idx += 8
    ext_len = int(bits[idx:idx+8], 2); idx += 8
    ext = "".join(chr(int(bits[i:i+8], 2)) for i in range(idx, idx+ext_len*8, 8))
    idx += ext_len * 8
    size = int(bits[idx:idx+32], 2); idx += 32
    encrypted_payload = bytearray(int(bits[i:i+8], 2) for i in range(idx, idx+size*8, 8))
    
    crypto = CryptoHandler(password)
    return crypto.decrypt(encrypted_payload)

def main():
    stego_path = "output/stego_image.png"
    tampered_path = "output/stego_TAMPERED.png"
    weights_path = "models/weights/camou_net_midsem.pth"
    password = "atharv_secure_pass" # Must match encrypt_image.py
    
    # 1. Load the authentic stego image
    img = cv2.imread(stego_path)
    if img is None:
        print("[!] Error: Run encrypt_image.py first!")
        return

    # 2. THE ATTACK: Change exactly one pixel at coordinate (50, 50)
    # We change the Red channel (index 2 in BGR) by just 1 unit.
    print("[*] Sabotaging pixel at (50, 50)...")
    img[50, 50, 2] = (img[50, 50, 2] + 1) % 256 
    cv2.imwrite(tampered_path, img)

    # 3. Attempt Decryption on the Tampered Image
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = CamouflageNet().to(device)
    model.load_state_dict(torch.load(weights_path, map_location=device))
    model.eval()

    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    tensor = torch.from_numpy(img_rgb).permute(2, 0, 1).float().unsqueeze(0).to(device) / 255.0
    
    with torch.no_grad():
        heatmap = model(tensor).squeeze().cpu().numpy()

    engine = AdaptiveEngine()
    raw_bits = engine.extract(img_rgb, heatmap)
    
    print("[*] Attempting to decrypt tampered data...")
    result = extract_and_decrypt(raw_bits, password)

    if result is None:
        print("\n[🛡️] INTEGRITY CHECK PASSED!")
        print("Result: Decryption Failed as expected.")
        print("Reason: The AES-GCM Authentication Tag detected a bit mismatch.")
    else:
        print("\n[!] FAILURE: The system decrypted tampered data. (Something is wrong!)")

if __name__ == "__main__":
    main()