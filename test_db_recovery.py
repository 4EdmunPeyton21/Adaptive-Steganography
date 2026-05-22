import asyncio
import asyncpg
import io
import uuid
from PIL import Image

DATABASE_URL = "postgresql://cuttlefish:cuttlefish@localhost:5432/cuttlefish_db"

async def check_db():
    try:
        pool = await asyncpg.create_pool(DATABASE_URL)
        files = await pool.fetch("SELECT id, file_name FROM stego_files")
        print(f"Found {len(files)} files.")
        for f in files:
            print(f"File: {f['file_name']} ({f['id']})")
            shards = await pool.fetch("SELECT id, image_data, shard_index FROM stego_shards WHERE stego_file_id = $1", f['id'])
            for s in shards:
                img_bytes = s['image_data']
                img = Image.open(io.BytesIO(img_bytes))
                print(f"  Shard {s['shard_index']} metadata 'ghost_shard': {img.info.get('ghost_shard') is not None}")
                
                # Check what GhostDecoder extracts
                from decrypt_image import GhostDecoder
                decoder = GhostDecoder()
                extracted = decoder.extract_shard(img)
                print(f"  Extracted via GhostDecoder: {extracted[:30] if extracted else None}...")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check_db())
