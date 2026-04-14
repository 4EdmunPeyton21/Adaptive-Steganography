import torch
import cv2
import numpy as np
from models.steganalyzer import Steganalyzer

def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    # 1. Load the "Police Officer" (Untrained)
    police = Steganalyzer().to(device)
    police.eval()

    # 2. Load Images
    clean_path = "input_images/room_photo.jpg"
    stego_path = "output/stego_image.png"

    def get_score(path):
        img = cv2.imread(path)
        img = cv2.resize(img, (256, 256))
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        tensor = torch.from_numpy(img_rgb).permute(2, 0, 1).float().unsqueeze(0).to(device) / 255.0
        with torch.no_grad():
            prediction = police(tensor).item()
        return prediction

    # 3. Compare Scores
    clean_score = get_score(clean_path)
    stego_score = get_score(stego_path)

    print("\n" + "="*35)
    print("  INITIAL STEGANALYSIS TEST")
    print("="*35)
    print(f"Clean Image Suspicion: {clean_score:.4f}")
    print(f"Stego Image Suspicion: {stego_score:.4f}")
    print("="*35)

    if abs(clean_score - stego_score) < 0.05:
        print("[🛡️] RESULT: The models are statistically indistinguishable.")
    else:
        print("[!] RESULT: The Steganalyzer sees a difference.")

if __name__ == "__main__":
    main()