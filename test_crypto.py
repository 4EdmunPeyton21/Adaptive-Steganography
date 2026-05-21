# test_crypto.py
from crypto_utils import generate_horcruxes, assemble_horcruxes

msg = b"Secret End-Sem Data"
result = generate_horcruxes(msg, k=3, n=5)

print(f"Shards generated: {result['shards']}")

# Try to recover with 3 shards
decrypted = assemble_horcruxes(result['shards'][:3], result['ciphertext'], k=3)
print(f"Decrypted: {decrypted.decode()}") # Should be 'Secret End-Sem Data'