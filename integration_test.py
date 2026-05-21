import os
from PIL import Image

# Flat imports since everything is in the root directory
from encrypt_image import process_full_payload
from decrypt_image import recover_full_payload

def setup_test_environment():
    """Creates dummy data and cover images for the test."""
    if not os.path.exists("test_data"): os.makedirs("test_data")
    if not os.path.exists("test_covers"): os.makedirs("test_covers")
    
    # 1. Create a secret message
    with open("test_data/secret.txt", "w") as f:
        f.write("End-Sem Project: Ghost API Top Secret Payload 2026")
    
    # 2. Create 5 dummy cover images
    colors = ["red", "blue", "green", "yellow", "purple"]
    cover_paths = []
    for i, color in enumerate(colors):
        path = f"test_covers/cover_{i}.png"
        img = Image.new("RGB", (500, 500), color=color)
        img.save(path)
        cover_paths.append(path)
    
    return "test_data/secret.txt", cover_paths

def run_integration_test():
    secret_file, cover_images = setup_test_environment()
    output_vault = "vault_output"
    
    print("--- PHASE 1: SHARDING & EMBEDDING ---")
    # Using k=3, n=5 (Horcrux Protocol)
    # This generates 5 images; we only need 3 to get the data back.
    stego_paths, ciphertext = process_full_payload(
        secret_file, 
        cover_images, 
        output_vault, 
        k=3, n=5
    )
    
    print(f"✔ Generated {len(stego_paths)} Stego-images in {output_vault}")
    
    print("\n--- PHASE 2: DECRYPTION & SUMMONING ---")
    # We simulate a "Partial Recovery" by only providing 3 shards
    selected_shards = [stego_paths[0], stego_paths[1], stego_paths[2]]
    print(f"Using 3/5 shards: {[os.path.basename(p) for p in selected_shards]}")
    
    decrypted_data = recover_full_payload(selected_shards, ciphertext, k=3)
    
    if decrypted_data:
        print("\n--- THE REVEAL ---")
        result_text = decrypted_data.decode()
        print(f"Decrypted Content: {result_text}")
        
        if result_text == "End-Sem Project: Ghost API Top Secret Payload 2026":
            print("\n✅ BLACK MAGIC CONFIRMED: The pipeline is fully operational.")
        else:
            print("\n❌ ERROR: Data mismatch.")
    else:
        print("\n❌ ERROR: Reconstruction failed.")

if __name__ == "__main__":
    run_integration_test()