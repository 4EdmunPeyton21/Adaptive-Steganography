import io
from PIL import Image, PngImagePlugin

# 1. Create fake image
img = Image.new('RGB', (256, 256), color = 'red')

# 2. Add metadata
meta = PngImagePlugin.PngInfo()
meta.add_text("ghost_shard", "TEST_SHARD_123")

# 3. Save to BytesIO
img_byte_arr = io.BytesIO()
img.save(img_byte_arr, format='PNG', pnginfo=meta)
img_bytes = img_byte_arr.getvalue()

# 4. Load from BytesIO
img_loaded = Image.open(io.BytesIO(img_bytes))

# 5. Extract metadata
shard_str = img_loaded.info.get("ghost_shard")
print(f"Extracted: {shard_str}")
