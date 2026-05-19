import os
from PIL import Image, ImageOps, PngImagePlugin
from crypto_utils import generate_horcruxes

class StegoEngine:
    def __init__(self):
        self.target_size = (256, 256)

    def normalize_cover(self, image_path):
        """Standardizes any image to 256x256 using Center-Crop (Technical Luxury style)."""
        img = Image.open(image_path).convert("RGB")
        # ImageOps.fit ensures no stretching; it crops to fill the square perfectly.
        img = ImageOps.fit(img, self.target_size, Image.Resampling.LANCZOS)
        return img

    def run_embedding(self, cover_img, shard_string):
        """
        The 'Black Magic' Shim:
        For testing, we hide the shard string in PNG metadata.
        In the final version, this is where the camouflage_net GAN runs.
        """
        # Create metadata container
        meta = PngImagePlugin.PngInfo()
        meta.add_text("ghost_shard", shard_string)
        
        # In a test scenario, the stego_img is visually identical to cover_img
        stego_img = cover_img 
        return stego_img, meta

def process_full_payload(file_path, cover_images, output_dir, k=3, n=5):
    """Orchestrates the sharding and embedding of a file."""
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    engine = StegoEngine()
    
    # 1. Read secret and generate Horcruxes
    with open(file_path, 'rb') as f:
        data = f.read()
    
    horcrux_data = generate_horcruxes(data, k=k, n=n)
    shards = horcrux_data['shards']
    ciphertext = horcrux_data['ciphertext']
    
    stego_paths = []
    
    # 2. Embed each shard into a normalized 256x256 image
    for i in range(n):
        cover_img = engine.normalize_cover(cover_images[i])
        stego_result, metadata = engine.run_embedding(cover_img, shards[i])
        
        out_path = os.path.join(output_dir, f"ghost_shard_{i+1}.png")
        # MUST save as PNG to preserve metadata and pixel integrity
        stego_result.save(out_path, "PNG", pnginfo=metadata)
        stego_paths.append(out_path)
        
    return stego_paths, ciphertext