import os
from PIL import Image
from crypto_utils import assemble_horcruxes

class GhostDecoder:
    def __init__(self):
        self.target_size = (256, 256)

    def extract_shard(self, stego_img_path):
        """
        The 'Summoning' Shim:
        Extracts the Horcrux shard string from PNG metadata.
        """
        img = Image.open(stego_img_path)
        # Pull the 'ghost_shard' key from the PNG tEXt chunks
        shard_string = img.info.get("ghost_shard")
        return shard_string

def recover_full_payload(stego_image_paths, ciphertext, k=3):
    """Reconstructs the original data from at least K stego-images."""
    decoder = GhostDecoder()
    shards = []
    
    # 1. Extract shards from the provided images
    for path in stego_image_paths:
        shard = decoder.extract_shard(path)
        if shard:
            shards.append(shard)
            
    # 2. Check if we met the threshold
    if len(shards) < k:
        print(f"Error: Only found {len(shards)} shards. Need {k}.")
        return None
        
    # 3. Reconstruct using Horcrux logic
    try:
        original_data = assemble_horcruxes(shards, ciphertext, k=k)
        return original_data
    except Exception as e:
        print(f"Extraction failed: {str(e)}")
        return None