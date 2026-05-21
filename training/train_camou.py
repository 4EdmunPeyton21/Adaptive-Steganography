import os
import sys
import torch
import torch.nn as nn
import torch.optim as optim
import torch.nn.functional as F
from torch.amp import autocast, GradScaler 

# Setup path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from data.dataset import get_stego_dataloader
from models.camouflage_net import CamouflageNet

def create_heuristic_target(images):
    gray = images.mean(dim=1, keepdim=True)
    gx = torch.abs(gray[:, :, :, :-1] - gray[:, :, :, 1:])
    gy = torch.abs(gray[:, :, :-1, :] - gray[:, :, 1:, :])
    gx = F.pad(gx, (0, 1, 0, 0))
    gy = F.pad(gy, (0, 0, 0, 1))
    edges = gx + gy
    return edges / (edges.max() + 1e-8)

def train():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"🚀 Phase 1 Training | Device: {device}")
    
    model = CamouflageNet().to(device)
    optimizer = optim.Adam(model.parameters(), lr=0.0002)
    criterion = nn.MSELoss()
    scaler = GradScaler() 
    
    dataloader = get_stego_dataloader("data/bossbase", batch_size=4)
    os.makedirs("models/weights", exist_ok=True)

    epochs = 5
    for epoch in range(epochs):
        epoch_loss = 0.0
        for batch_idx, images in enumerate(dataloader):
            images = images.to(device)
            target = create_heuristic_target(images)
            
            optimizer.zero_grad()
            with autocast(device_type=device.type):
                output = model(images)
                loss = criterion(output, target)
            
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
            
            epoch_loss += loss.item()
            if batch_idx % 50 == 0:
                print(f"Epoch [{epoch+1}/{epochs}] | Batch [{batch_idx}/{len(dataloader)}] | Loss: {loss.item():.6f}")

        # SAVE CHECKPOINT AFTER EVERY EPOCH
        save_path = f"models/weights/camou_epoch_{epoch+1}.pth"
        torch.save(model.state_dict(), save_path)
        torch.save(model.state_dict(), "models/weights/camou_net_midsem.pth")
        print(f"✅ Epoch {epoch+1} complete. Brain saved to {save_path}")

if __name__ == "__main__":
    train()