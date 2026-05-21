import os
import binascii
import random
from Crypto.Cipher import AES

# --- PURE MATH HORCRUX ENGINE ---
# Mersenne Prime 2^521 - 1
PRIME = 2**521 - 1 

def _eval_at(poly, x, prime):
    """Evaluates polynomial at x using Horner's method."""
    accum = 0
    for coeff in reversed(poly):
        accum = (accum * x + coeff) % prime
    return accum

def _extended_gcd(a, b):
    """Extended Euclidean Algorithm to find modular inverse."""
    x, last_x = 0, 1
    y, last_y = 1, 0
    while b != 0:
        quot = a // b
        a, b = b, a % b
        x, last_x = last_x - quot * x, x
        y, last_y = last_y - quot * y, y
    return last_x, last_y

def _div_mod(num, den, prime):
    """Computes num / den modulo prime."""
    inv, _ = _extended_gcd(den, prime)
    return (num * inv) % prime

def _lagrange_interpolate(x, x_s, y_s, prime):
    """Reconstructs the secret (y-intercept) from shards."""
    k = len(x_s)
    total = 0
    for i in range(k):
        numerator = 1
        denominator = 1
        for j in range(k):
            if i == j:
                continue
            # (x - x_j) / (x_i - x_j)
            numerator = (numerator * (x - x_s[j])) % prime
            denominator = (denominator * (x_s[i] - x_s[j])) % prime
        
        # Multiply y_i by the basis polynomial
        lagrange_basis = _div_mod(numerator, denominator, prime)
        total = (total + y_s[i] * lagrange_basis) % prime
    return total

class HorcruxProvider:
    def __init__(self, threshold=3, total_shares=5):
        self.k = threshold
        self.n = total_shares

    def encrypt_and_shard(self, raw_data: bytes):
        # 1. AES-256-GCM Encryption
        key = os.urandom(32)
        cipher = AES.new(key, AES.MODE_GCM)
        ciphertext, tag = cipher.encrypt_and_digest(raw_data)
        
        # 2. Key Pack (64 bytes: Key + Nonce + Tag)
        key_pack = key + cipher.nonce + tag
        secret_int = int.from_bytes(key_pack, byteorder='big')
        
        # 3. Shamir's Split
        # f(x) = secret + a1*x + a2*x^2 ...
        poly = [secret_int] + [random.SystemRandom().randint(0, PRIME - 1) for _ in range(self.k - 1)]
        
        shards = []
        for i in range(1, self.n + 1):
            y = _eval_at(poly, i, PRIME)
            shards.append(f"{i}-{hex(y)[2:]}") 
        
        return {
            "ciphertext": ciphertext,
            "shards": shards
        }

    def recover_and_decrypt(self, shards: list, ciphertext: bytes):
        if len(shards) < self.k:
            raise ValueError(f"Need {self.k} shards, got {len(shards)}")

        # 1. Parse shards
        x_s, y_s = [], []
        for s in shards[:self.k]:
            idx, val = s.split('-')
            x_s.append(int(idx))
            y_s.append(int(val, 16))

        # 2. Recover secret_int
        secret_int = _lagrange_interpolate(0, x_s, y_s, PRIME)
        
        # 3. Convert back to exactly 64 bytes (padding if needed)
        key_pack = secret_int.to_bytes(64, byteorder='big')
        
        key = key_pack[:32]
        nonce = key_pack[32:48]
        tag = key_pack[48:]

        # 4. Final Decryption
        cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
        return cipher.decrypt_and_verify(ciphertext, tag)

def generate_horcruxes(data: bytes, k=3, n=5):
    return HorcruxProvider(k, n).encrypt_and_shard(data)

def assemble_horcruxes(shards: list, ciphertext: bytes, k=3):
    return HorcruxProvider(k).recover_and_decrypt(shards, ciphertext)