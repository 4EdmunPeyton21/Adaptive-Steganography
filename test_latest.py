import asyncio
import asyncpg
import io
import sys

sys.path.insert(0, ".")

DATABASE_URL = "postgresql://cuttlefish:cuttlefish@localhost:5432/cuttlefish_db"

async def test_latest_recover():
    pool = await asyncpg.create_pool(DATABASE_URL)
    
    from PIL import Image
    from decrypt_image import GhostDecoder
    from crypto_utils import assemble_horcruxes
    
    # Get latest file
    file_row = await pool.fetchrow('SELECT id, ciphertext, file_name FROM stego_files ORDER BY created_at DESC LIMIT 1')
    if not file_row:
        print('No files found')
        return
        
    file_id = file_row['id']
    print(f"File: {file_row['file_name']}, ciphertext={len(file_row['ciphertext'])} bytes")
    
    # Get its shards
    shards = await pool.fetch('SELECT id, image_data FROM stego_shards WHERE stego_file_id = $1 LIMIT 3', file_id)
    if len(shards) < 3:
        print('Not enough shards')
        return
        
    decoder = GhostDecoder()
    extracted_shards = []
    
    for i, row in enumerate(shards):
        img = Image.open(io.BytesIO(row['image_data']))
        print(f"  Extracting shard {i+1}...")
        try:
            shard_str = decoder.extract_shard(img)
            print(f"  -> length: {len(shard_str) if shard_str else None}")
            if shard_str:
                extracted_shards.append(shard_str)
        except Exception as e:
            print(f"  -> EXCEPTION: {e}")
            
    print(f"Extracted {len(extracted_shards)}/{len(shards)} shards")
    
    if len(extracted_shards) >= 3:
        try:
            raw_data = assemble_horcruxes(extracted_shards, file_row['ciphertext'], k=3)
            print(f"SUCCESS: recovered {len(raw_data)} bytes")
        except Exception as e:
            print(f"assemble_horcruxes FAILED: {type(e).__name__}: {e}")

    await pool.close()

asyncio.run(test_latest_recover())
