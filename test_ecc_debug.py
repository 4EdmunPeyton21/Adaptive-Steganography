import torch
import numpy as np
from PIL import Image
from encrypt_image import StegoEngine
from decrypt_image import GhostDecoder
import io
import struct

engine = StegoEngine()
decoder = GhostDecoder()

from stego.bit_utils import (
    text_to_bit_tensor, ECC_REPS, ECC_MSG_BITS, ECC_TOTAL_BITS,
    HEADER_BITS, _bits_to_bytes, _bytes_to_bits
)

cover = Image.fromarray((np.random.rand(256, 256, 3) * 255).astype(np.uint8), "RGB")
secret_str = "1-deadbeefcafe1234deadbeefcafe"

print(f"Secret: {secret_str}")

# Encode with ECC
secret_tensor = text_to_bit_tensor(secret_str)
orig_bits = secret_tensor.squeeze(0).cpu().numpy().astype(np.uint8).flatten()

# Inspect the pattern: all 31 copies should have the same header bits
print(f"\nECC_MSG_BITS = {ECC_MSG_BITS}, ECC_REPS = {ECC_REPS}, ECC_TOTAL_BITS = {ECC_TOTAL_BITS}")
print(f"orig_bits shape: {orig_bits.shape}")

# Check all 31 copies have identical headers
votes = orig_bits[:ECC_TOTAL_BITS].reshape(ECC_REPS, ECC_MSG_BITS)
header_copies = votes[:, :HEADER_BITS]
print(f"\nCopy 0 header:  {votes[0, :HEADER_BITS].tolist()}")
print(f"Copy 1 header:  {votes[1, :HEADER_BITS].tolist()}")
print(f"Copy 15 header: {votes[15, :HEADER_BITS].tolist()}")
print(f"Copy 30 header: {votes[30, :HEADER_BITS].tolist()}")
print(f"All identical:  {np.all(header_copies == header_copies[0])}")

# Now embed and extract
stego_pil, _ = engine.run_embedding(cover, secret_str)
img_byte_arr = io.BytesIO()
stego_pil.save(img_byte_arr, format='PNG')
recovered_pil = Image.open(io.BytesIO(img_byte_arr.getvalue()))

# Manual extraction
from decrypt_image import _pil_to_tensor, _device, _decoder
stego_t = _pil_to_tensor(recovered_pil).to(_device)
with torch.no_grad():
    bit_probs = _decoder(stego_t)

bit_map = bit_probs.squeeze(0).squeeze(0)  # (256, 256)
ext_bits = (bit_map > 0.5).cpu().numpy().astype(np.uint8).flatten()

# BER
ber = np.sum(ext_bits != orig_bits) / len(orig_bits)
print(f"\nFull grid BER: {ber:.4f}")

# Now run majority vote manually
ecc_bits = ext_bits[:ECC_TOTAL_BITS]
votes_ext = ecc_bits.reshape(ECC_REPS, ECC_MSG_BITS)  # (31, 2114)
msg_bits = (votes_ext.sum(axis=0) >= (ECC_REPS // 2 + 1)).astype(np.uint8)  # majority

print(f"\nPost-vote header bits: {msg_bits[:HEADER_BITS].tolist()}")
header_bytes = _bits_to_bytes(msg_bits[:HEADER_BITS])
payload_len = struct.unpack(">H", header_bytes)[0]
print(f"Post-vote payload_len: {payload_len}")

# Per-copy vote analysis
header_sums = votes_ext[:, :HEADER_BITS].sum(axis=0)
print(f"\nVote sums for each header bit (max={ECC_REPS}):")
print(header_sums.tolist())
print(f"Original header bits:  {orig_bits[:HEADER_BITS].tolist()}")
print(f"Majority threshold: {ECC_REPS // 2 + 1}")
