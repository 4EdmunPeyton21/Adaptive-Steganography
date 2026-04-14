import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset
import cv2
import os
import glob
import numpy as np
from models.camouflage_net import CamouflageNet
from models.steganalyzer import Steganalyzer

class StegoDataset(Dataset):
    """Loads images from the DIV2K subset and prepares them for the U-Net."""
    def __init__(self, folder_path):
        self.img_paths = glob.glob(os.path.join(folder_path, "*.png"))
        if len(self.img_paths) == 0:
            raise FileNotFoundError(f"No images found in {folder_path}. Run get_data.py first!")

    def __len__(self): 
        return len(self.img_paths)

    def __getitem__(self, idx):
        img = cv2.imread(self.img_paths[idx])
        # Resize to 256x256 to fit RTX 3050 VRAM limits
        img = cv2.resize(cv2.cvtColor(img, cv2.COLOR_BGR2RGB), (256, 256))
        # Create a "Natural Saliency" map to serve as the 'Real' data for the GAN
        gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
        edge_map = cv2.Sobel(gray, cv2.CV_64F, 1, 1, ksize=5)
        edge_map = np.abs(edge_map)
        edge_map = (edge_map / edge_map.max() if edge_map.max() > 0 else edge_map)
        
        img_tensor = torch.from_numpy(img).permute(2, 0, 1).float() / 255.0
        edge_tensor = torch.from_numpy(edge_map).unsqueeze(0).float()
        return img_tensor, edge_tensor

def train_gan():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[*] Training on: {device}")

    # 1. Initialize Rivals
    generator = CamouflageNet().to(device)
    discriminator = Steganalyzer().to(device)
    
    # Load midsem weights to start from a 'smart' baseline
    weights_path = "models/weights/camou_net_midsem.pth"
    if os.path.exists(weights_path):
        generator.load_state_dict(torch.load(weights_path, map_location=device))
        print("[*] Base U-Net weights loaded for stealth optimization.")

    # 2. Setup Rules (Loss & Optimizers)
    criterion = nn.BCELoss()
    optimizer_G = optim.Adam(generator.parameters(), lr=1e-4)
    optimizer_D = optim.Adam(discriminator.parameters(), lr=1e-4)

    # 3. Load Data (Batch Size 2 for 4GB VRAM)
    dataset = StegoDataset("input_dataset")
    loader = DataLoader(dataset, batch_size=2, shuffle=True)

    print(f"[*] Starting Adversarial Battle on {len(dataset)} images...")

    for epoch in range(10): # Initial 10-epoch sprint
        epoch_d_loss = 0
        epoch_g_loss = 0

        for i, (imgs, real_heatmaps) in enumerate(loader):
            imgs, real_heatmaps = imgs.to(device), real_heatmaps.to(device)
            batch_sz = imgs.size(0)

            # --- PHASE 1: Train Discriminator (The Police) ---
            optimizer_D.zero_grad()
            
            # Test Real (Natural edge-based importance maps)
            label_real = torch.ones(batch_sz, 1).to(device)
            out_real = discriminator(real_heatmaps)
            loss_D_real = criterion(out_real, label_real)
            
            # Test Fake (AI-generated heatmaps)
            fake_heatmaps = generator(imgs).detach() 
            label_fake = torch.zeros(batch_sz, 1).to(device)
            out_fake = discriminator(fake_heatmaps)
            loss_D_fake = criterion(out_fake, label_fake)
            
            loss_D = (loss_D_real + loss_D_fake) / 2
            loss_D.backward()
            optimizer_D.step()

            # --- PHASE 2: Train Generator (The Smuggler) ---
            optimizer_G.zero_grad()
            
            # The Generator wants the Discriminator to think AI heatmaps are 'Real'
            gen_heatmaps = generator(imgs)
            out_gan = discriminator(gen_heatmaps)
            loss_G = criterion(out_gan, label_real) # Goal: Fool the police
            
            loss_G.backward()
            optimizer_G.step()

            epoch_d_loss += loss_D.item()
            epoch_g_loss += loss_G.item()

        avg_d = epoch_d_loss / len(loader)
        avg_g = epoch_g_loss / len(loader)
        print(f"Epoch [{epoch+1}/10] | Disc_Loss: {avg_d:.4f} | Gen_Loss: {avg_g:.4f}")

    # 4. Save the "Invisibility" weights
    os.makedirs("models/weights", exist_ok=True)
    torch.save(generator.state_dict(), "models/weights/camou_net_adversarial.pth")
    print("\n[+] Success! Stealth-optimized weights saved to models/weights/camou_net_adversarial.pth")

if __name__ == "__main__":
    train_gan()