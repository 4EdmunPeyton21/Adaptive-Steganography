import torch
import torch.nn as nn
from models.encoder import StegEncoder, ConvBnRelu

class FlatDecoder(nn.Module):
    def __init__(self, base_ch=32):
        super().__init__()
        b = base_ch
        self.conv = nn.Sequential(
            ConvBnRelu(3, b),
            ConvBnRelu(b, b),
            ConvBnRelu(b, b),
            ConvBnRelu(b, b),
            ConvBnRelu(b, b),
            nn.Conv2d(b, 1, kernel_size=1),
            nn.Sigmoid()
        )
    def forward(self, x):
        return self.conv(x)

device = "cpu"
encoder = StegEncoder().to(device)
decoder = FlatDecoder().to(device)

opt_G = torch.optim.Adam(list(encoder.parameters()) + list(decoder.parameters()), lr=1e-3)
bce = nn.BCELoss()
mse = nn.MSELoss()

for i in range(101):
    cover = torch.rand(2, 3, 256, 256)
    secret = torch.randint(0, 2, (2, 1, 256, 256)).float()
    cap = torch.ones(2, 1, 256, 256)
    
    opt_G.zero_grad()
    stego = encoder(cover, secret, cap)
    extracted = decoder(stego)
    
    loss_ext = bce(extracted, secret)
    loss_hide = mse(stego, cover)
    
    loss = 100.0 * loss_ext + 10.0 * loss_hide
    loss.backward()
    opt_G.step()
    
    hard = (extracted > 0.5).float()
    ber = (hard != secret).float().mean().item()
    if i % 10 == 0:
        print(f"Step {i:03d} | Ext Loss: {loss_ext.item():.4f} | Hide Loss: {loss_hide.item():.6f} | BER: {ber:.4f}", flush=True)
