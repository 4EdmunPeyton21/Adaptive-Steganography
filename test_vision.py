import torch
import matplotlib.pyplot as plt
import os
import sys
import numpy as np

# Setup paths for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from models.camouflage_net import CamouflageNet
from data.dataset import get_stego_dataloader

def see_through_ai_eyes():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"👁️ Visualizing using: {device}")
    
    # 1. Load the Brain (Using your best epoch weights)
    model = CamouflageNet().to(device)
    weights_path = "models/weights/camou_net_midsem.pth"
    
    if os.path.exists(weights_path):
        model.load_state_dict(torch.load(weights_path, map_location=device))
        print("🧠 Loaded the trained AI brain!")
    else:
        print("⚠️ Error: Trained weights not found. Run training first!")
        return

    model.eval()

    # 2. Grab a fresh image from COCO
    dataloader = get_stego_dataloader("data/bossbase", batch_size=1)
    images = next(iter(dataloader)).to(device)

    # 3. Predict the heatmap
    with torch.no_grad():
        heatmap = model(images)

    # 4. Prepare for Plotting
    img = images[0].cpu().permute(1, 2, 0).numpy()
    h_map = heatmap[0].cpu().squeeze().numpy()
    
    # Thresholding: Show pixels where we will hide >1 bit
    binary_map = (h_map > 0.5).astype(np.float32)

    # 5. Plot the Triple View
    plt.figure(figsize=(18, 6))
    
    plt.subplot(1, 3, 1)
    plt.title("Original Cover Image")
    plt.imshow(img)
    plt.axis('off')

    plt.subplot(1, 3, 2)
    plt.title("AI Texture Awareness (Heatmap)")
    plt.imshow(h_map, cmap='magma')
    plt.axis('off')

    plt.subplot(1, 3, 3)
    plt.title("Active Embedding Zones (>1 Bit/Pixel)")
    plt.imshow(binary_map, cmap='gray')
    plt.axis('off')

    plt.tight_layout()
    plt.show()

if __name__ == "__main__":
    see_through_ai_eyes()