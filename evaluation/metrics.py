import torch
import matplotlib.pyplot as plt
import numpy as np
from models.camouflage_net import CamouflageNet
from data.dataset import get_stego_dataloader

def visualize_results():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    # 1. Load the trained AI Brain
    model = CamouflageNet().to(device)
    try:
        model.load_state_dict(torch.load("models/weights/camou_net_midsem.pth", map_location=device))
        model.eval()
        print("✅ Trained AI Brain loaded successfully!")
    except:
        print("⚠️ No trained weights found. Showing random initialization (AI is still a 'baby').")

    # 2. Grab a real image from your new dataset
    dataloader = get_stego_dataloader("data/bossbase", batch_size=1)
    image = next(iter(dataloader)).to(device)

    # 3. Let the AI 'Look' at the image and draw a map
    with torch.no_state():
        heatmap = model(image)

    # 4. Convert tensors back to viewable images
    img_np = image.squeeze().cpu().numpy().transpose(1, 2, 0)
    map_np = heatmap.squeeze().cpu().numpy()

    # 5. Plot them side-by-side
    plt.figure(figsize=(12, 6))
    
    plt.subplot(1, 2, 1)
    plt.title("Original Cover Image")
    plt.imshow(img_np)
    plt.axis('off')

    plt.subplot(1, 2, 2)
    plt.title("AI Capacity Heatmap (White = Safe)")
    plt.imshow(map_np, cmap='hot')
    plt.axis('off')

    plt.tight_layout()
    plt.show()
    print("📊 Visualization complete. Look for the pop-up window!")

if __name__ == "__main__":
    visualize_results()