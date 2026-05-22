import torch
from models.encoder import StegEncoder
from models.decoder import StegDecoder
from models.camouflage_net import CamouflageNet
from stego.bit_utils import text_to_bit_tensor, bit_tensor_to_text
import numpy as np

device = "cpu"
encoder = StegEncoder().to(device)
encoder.load_state_dict(torch.load("models/weights/encoder_best.pth", map_location=device))
encoder.eval()

decoder = StegDecoder().to(device)
decoder.load_state_dict(torch.load("models/weights/decoder_best.pth", map_location=device))
decoder.eval()

camou = CamouflageNet().to(device)
camou.load_state_dict(torch.load("models/weights/camou_net_adversarial.pth", map_location=device))
camou.eval()

# Fake cover
cover = torch.rand(1, 3, 256, 256).to(device)

# Fake shard
fake_shard = "1-deadbeef"
secret = text_to_bit_tensor(fake_shard).unsqueeze(0).to(device)

with torch.no_grad():
    cap = camou(cover)
    stego = encoder(cover, secret, cap)
    extracted_probs = decoder(stego)

    hard_bits = (extracted_probs > 0.5).float()
    ber = (hard_bits != secret).float().mean().item()
    print(f"BER: {ber}")
    try:
        decoded = bit_tensor_to_text(extracted_probs)
        print(f"Decoded: {decoded}")
    except Exception as e:
        print(f"Decode Error: {e}")
