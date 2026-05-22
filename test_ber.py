import torch
import numpy as np
from PIL import Image
from encrypt_image import StegoEngine
from decrypt_image import GhostDecoder
import io
import struct

engine = StegoEngine()
decoder = GhostDecoder()

from stego.bit_utils import text_to_bit_tensor, bit_tensor_to_bytes, _bits_to_bytes

for i in range(5):
    cover = Image.fromarray((np.random.rand(256, 256, 3) * 255).astype(np.uint8), "RGB")
    secret_str = f"{i}-teststring-{np.random.rand()}"
    
    stego_pil, _ = engine.run_embedding(cover, secret_str)
    
    # Save/load via PNG to mirror real pipeline
    img_byte_arr = io.BytesIO()
    stego_pil.save(img_byte_arr, format='PNG')
    img_bytes = img_byte_arr.getvalue()
    recovered_pil = Image.open(io.BytesIO(img_bytes))
    
    # Neural extract
    from decrypt_image import _pil_to_tensor, _device, _decoder
    stego_t = _pil_to_tensor(recovered_pil).to(_device)
    with torch.no_grad():
        bit_probs = _decoder(stego_t)
        
    bit_map = bit_probs.squeeze(0).squeeze(0)  # (256, 256)
    bits = (bit_map > 0.5).cpu().numpy().astype(np.uint8).flatten()
    
    # Check original bits
    orig_tensor = text_to_bit_tensor(secret_str)
    orig_bits = orig_tensor.squeeze(0).cpu().numpy().astype(np.uint8).flatten()
    
    errors = np.sum(bits != orig_bits)
    ber = errors / len(bits)
    
    header_bits = bits[:16]
    orig_header_bits = orig_bits[:16]
    header_len = struct.unpack(">H", _bits_to_bytes(header_bits))[0]
    
    print(f"Test {i+1}:")
    print(f"  BER: {ber:.4f} ({errors} errors)")
    print(f"  Original header: {orig_header_bits.tolist()}")
    print(f"  Decoded header : {header_bits.tolist()}")
    print(f"  Decoded len    : {header_len}")
    
    try:
        shard = decoder.extract_shard(recovered_pil)
        print(f"  Extracted string: {shard}")
    except Exception as e:
        print(f"  extract_shard failed: {type(e).__name__}: {e}")
