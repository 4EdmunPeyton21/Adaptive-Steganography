from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes
import hashlib

class CryptoHandler:
    def __init__(self, password):
        # Hash the password to create a consistent 32-byte (256-bit) key
        self.key = hashlib.sha256(password.encode()).digest()

    def encrypt(self, raw_data):
        """Returns: nonce (16) + tag (16) + ciphertext"""
        cipher = AES.new(self.key, AES.MODE_GCM)
        ciphertext, tag = cipher.encrypt_and_digest(raw_data)
        return cipher.nonce + tag + ciphertext

    def decrypt(self, bundle):
        """Extracts nonce, tag, and ciphertext to verify and decrypt."""
        nonce = bundle[:16]
        tag = bundle[16:32]
        ciphertext = bundle[32:]
        cipher = AES.new(self.key, AES.MODE_GCM, nonce=nonce)
        try:
            return cipher.decrypt_and_verify(ciphertext, tag)
        except (ValueError, KeyError):
            return None