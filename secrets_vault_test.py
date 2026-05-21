import os
import sys
from PIL import Image

# Path Injector for root execution
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from encrypt_image import process_full_payload
from decrypt_image import recover_full_payload

def run_secrets_demo():
    # 1. Setup the Secrets Folder (Reusing the structure)
    secrets_dir = "secrets"
    if not os.path.exists(secrets_dir):
        os.makedirs(secrets_dir)
        print(f"[*] Initialized '{secrets_dir}' folder.")

    # 2. Place the message in a text file inside /secrets
    secret_file_path = os.path.join(secrets_dir, "top_secret.txt")
    message = "ATHARV_DALVI_2026: The Horcrux protocol is confirmed. Ghost API is live."
    
    with open(secret_file_path, "w") as f:
        f.write(message)
    
    print(f"--- [PHASE 1] INPUT ---")
    print(f"File: {secret_file_path}")
    print(f"Content: {message}")

    # 3. Setup covers and vault
    # Reusing test_covers from previous step
    cover_images = [f"test_covers/cover_{i}.png" for i in range(5)]
    output_vault = "vault_output"

    # 4. ENCRYPT (Sharding)
    print("\n--- [PHASE 2] ENCRYPTING (SHARDING INTO 5 IMAGES) ---")
    stego_paths, ciphertext = process_full_payload(
        secret_file_path, 
        cover_images, 
        output_vault, 
        k=3, n=5
    )
    print(f"✔ Horcruxes created in {output_vault}/")

    # 5. DECRYPT (Summoning)
    print("\n--- [PHASE 3] DECRYPTING (SUMMONING FROM 3 SHARDS) ---")
    # We use shards 2, 4, and 5 just to show we can pick any 3.
    chosen_shards = [stego_paths[1], stego_paths[3], stego_paths[4]]
    
    decrypted_bytes = recover_full_payload(chosen_shards, ciphertext, k=3)

    if decrypted_bytes:
        recovered_text = decrypted_bytes.decode()
        print(f"\n--- [PHASE 4] RECOVERY SUCCESS ---")
        print(f"Recovered Message: {recovered_text}")
        
        # Verify
        if recovered_text == message:
            print("\n✅ MATCH: The data integrity is 100%. The Ghost API is officially sound.")
    else:
        print("\n❌ FAILED: The summoning ritual was interrupted.")

if __name__ == "__main__":
    run_secrets_demo()