import cv2
import numpy as np
from skimage.metrics import structural_similarity as ssim
import matplotlib.pyplot as plt

def calculate_psnr(img1, img2):
    """Calculates Peak Signal-to-Noise Ratio in dB."""
    mse = np.mean((img1 - img2) ** 2)
    if mse == 0:
        return float('inf')
    max_pixel = 255.0
    psnr = 20 * np.log10(max_pixel / np.sqrt(mse))
    return psnr

def main():
    # Paths (Must match your encrypt_image.py output)
    original_path = "input_images/room_photo.jpg"
    stego_path = "output/stego_image.png"

    # 1. Load and prepare images
    original = cv2.imread(original_path)
    stego = cv2.imread(stego_path)

    if original is None or stego is None:
        print("[!] Error: Could not find images. Ensure you ran encrypt_image.py first.")
        return

    # Ensure images are the same size (The U-Net uses 256x256)
    original = cv2.resize(original, (256, 256))
    stego = cv2.resize(stego, (256, 256))

    # 2. Convert to Grayscale for SSIM calculation
    orig_gray = cv2.cvtColor(original, cv2.COLOR_BGR2GRAY)
    stego_gray = cv2.cvtColor(stego, cv2.COLOR_BGR2GRAY)

    # 3. Run the Math
    psnr_val = calculate_psnr(original, stego)
    ssim_val, diff = ssim(orig_gray, stego_gray, full=True)
    diff = (diff * 255).astype("uint8") # Generate a difference map

    # 4. Results Table
    print("\n" + "="*30)
    print("  AI STEGO QUALITY REPORT")
    print("="*30)
    print(f"PSNR Score: {psnr_val:.2f} dB")
    print(f"SSIM Score: {ssim_val:.4f}")
    print("="*30)

    # 5. Visual Validation (The "Difference Map")
    plt.figure(figsize=(15, 5))
    plt.subplot(1, 3, 1)
    plt.title("Original (Cover)")
    plt.imshow(cv2.cvtColor(original, cv2.COLOR_BGR2RGB))
    
    plt.subplot(1, 3, 2)
    plt.title("Stego (With Hidden File)")
    plt.imshow(cv2.cvtColor(stego, cv2.COLOR_BGR2RGB))
    
    plt.subplot(1, 3, 3)
    plt.title("Error Map (SSIM Diff)")
    plt.imshow(diff, cmap='inferno')
    plt.colorbar()
    
    print("[+] Quality plots generated. Check the UI window.")
    plt.show()

if __name__ == "__main__":
    main()