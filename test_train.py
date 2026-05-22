import torch
import torch.nn as nn
from models.encoder import StegEncoder
from models.decoder import StegDecoder

device = "cpu"
encoder = StegEncoder().to(device)
decoder = StegDecoder().to(device)

opt_G = torch.optim.Adam(list(encoder.parameters()) + list(decoder.parameters()), lr=1e-3)
bce = nn.BCELoss()
mse = nn.MSELoss()

for i in range(50):
    cover = torch.rand(2, 3, 256, 256)
    secret = torch.randint(0, 2, (2, 1, 256, 256)).float()
    cap = torch.ones(2, 1, 256, 256) # Force max capacity
    
    opt_G.zero_grad()
    stego = encoder(cover, secret, cap)
    extracted = decoder(stego)
    
    loss_ext = bce(extracted, secret)
    loss_hide = mse(stego, cover)
    
    # Just extraction loss
    loss = loss_ext + 10.0 * loss_hide
    loss.backward()
    opt_G.step()
    
    hard = (extracted > 0.5).float()
    ber = (hard != secret).float().mean().item()
    if i % 10 == 0:
        print(f"Step {i} | Ext Loss: {loss_ext.item():.4f} | Hide Loss: {loss_hide.item():.4f} | BER: {ber:.4f}")
