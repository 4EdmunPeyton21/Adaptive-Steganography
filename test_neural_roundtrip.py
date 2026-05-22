import torch
import numpy as np
from PIL import Image
from encrypt_image import StegoEngine
from decrypt_image import GhostDecoder
import io
import struct

engine = StegoEngine()
decoder = GhostDecoder()

cover = Image.fromarray((np.random.rand(256, 256, 3) * 255).astype(np.uint8), "RGB")
secret_str = "1-deadbeefcafe1234deadbeefcafe"

stego_pil, _ = engine.run_embedding(cover, secret_str)

img_byte_arr = io.BytesIO()
stego_pil.save(img_byte_arr, format='PNG')
img_bytes = img_byte_arr.getvalue()

recovered_pil = Image.open(io.BytesIO(img_bytes))

# Now manually do what GhostDecoder._neural_extract does
from decrypt_image import _pil_to_tensor, _device, _decoder
stego_t = _pil_to_tensor(recovered_pil).to(_device)
with torch.no_grad():
    bit_probs = _decoder(stego_t)

bit_map = bit_probs.squeeze(0)  # (1, 256, 256)
print(f"bit_probs mean: {bit_map.mean().item():.4f}")
print(f"bit_probs min : {bit_map.min().item():.4f}")
print(f"bit_probs max : {bit_map.max().item():.4f}")

# Threshold to hard bits
tensor = bit_map.squeeze(0) # (256, 256)
bits = (tensor > 0.5).cpu().numpy().astype(np.uint8).flatten()
header_bits  = bits[:16]
print(f"Extracted header bits: {header_bits.tolist()}")

from stego.bit_utils import _bits_to_bytes
header_bytes = _bits_to_bytes(header_bits)
payload_len  = struct.unpack(">H", header_bytes)[0]
print(f"Decoded payload len: {payload_len}")

try:
    recovered_str = decoder.extract_shard(recovered_pil)
    print(f"Recovered secret: '{recovered_str}'")
except Exception as e:
    print(f"Exception: {e}")
