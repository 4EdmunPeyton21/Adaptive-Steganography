import numpy as np

class AdaptiveEngine:
    """
    The Decision Engine: Translates AI Heatmaps into Binary Pixel Changes.
    Optimized for high-speed performance on RTX-series GPUs.
    """
    def __init__(self):
        # We've moved model loading to the main scripts to prevent 
        # redundant memory usage on your GPU.
        pass

    def _capacity(self, h_val):
        """
        Determines bit-depth based on AI confidence scores.
        Thresholds: >0.7 (3 bits), >0.4 (2 bits), else (1 bit).
        """
        if h_val > 0.7:
            return 3
        elif h_val > 0.4:
            return 2
        else:
            return 1   

    def embed(self, cover_np, heatmap, bits):
        """
        Adaptive LSB Embedding.
        Injects a bitstream into the cover image based on texture awareness.
        """
        stego_np = cover_np.copy()
        bit_idx = 0
        h, w, _ = stego_np.shape
        
        # Iterate through every pixel
        for y in range(h):
            for x in range(w):
                if bit_idx >= len(bits):
                    break
                
                # Determine how many bits this specific pixel can hide
                cap = self._capacity(heatmap[y, x])

                # Process Red, Green, and Blue channels
                for channel in range(3):
                    if bit_idx >= len(bits):
                        break

                    # Grab the next chunk of secret bits
                    chunk = bits[bit_idx : bit_idx + cap]
                    bit_idx += len(chunk)
                    
                    # Ensure the chunk matches the capacity (padding for the very end)
                    chunk_padded = chunk.ljust(cap, '0')

                    # Binary surgery: Clear old bits and inject new secret bits
                    val = int(stego_np[y, x, channel])
                    mask = (0xFF << cap) & 0xFF            # Bitmask to clear LSBs
                    stego_np[y, x, channel] = (val & mask) | int(chunk_padded, 2)
            
            if bit_idx >= len(bits):
                break

        return stego_np, bit_idx

    def extract(self, stego_np, heatmap):
        """
        Blind Extraction logic.
        Re-traces the AI's hiding path to recover the raw bitstream.
        """
        collected = []
        h, w, _ = stego_np.shape

        for y in range(h):
            for x in range(w):
                # We use the same AI-generated map to find the 'path'
                cap = self._capacity(heatmap[y, x])

                for channel in range(3):
                    val = int(stego_np[y, x, channel])
                    # Pull only the bits that contain secret data
                    lsbs = format(val & ((1 << cap) - 1), f'0{cap}b')
                    collected.append(lsbs)

        return ''.join(collected)

# Status Check
print(" Adaptive Engine Ready.")