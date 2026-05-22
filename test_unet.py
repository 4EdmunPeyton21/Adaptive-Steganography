import torch
import torch.nn as nn
from models.encoder import StegEncoder
from models.decoder import StegDecoder

device = "cpu"
encoder = StegEncoder().to(device)
decoder = StegDecoder().to(device)

# User's current parameters
LAMBDA_READ = 100.0
LAMBDA_HIDE = 10.0

opt_G = torch.optim.Adam(list(encoder.parameters()) + list(decoder.parameters()), lr=2e-4)
bce = nn.BCELoss()
mse = nn.MSELoss()

for i in range(151):
    cover = torch.rand(2, 3, 256, 256)
    secret = torch.randint(0, 2, (2, 1, 256, 256)).float()
    
    # Simulate an untrained or weak capacity map
    cap = torch.rand(2, 1, 256, 256) * 0.5 
    
    opt_G.zero_grad()
    stego = encoder(cover, secret, cap)
    extracted = decoder(stego)
    
    loss_ext = bce(extracted, secret)
    loss_hide = mse(stego, cover)
    
    loss = LAMBDA_READ * loss_ext + LAMBDA_HIDE * loss_hide
    loss.backward()
    opt_G.step()
    
    hard = (extracted > 0.5).float()
    ber = (hard != secret).float().mean().item()
    if i % 10 == 0:
        print(f"Step {i:03d} | Ext Loss: {loss_ext.item():.4f} | Hide Loss: {loss_hide.item():.6f} | BER: {ber:.4f}", flush=True)
