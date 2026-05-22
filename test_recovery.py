import io
import sys
import asyncio
import asyncpg

sys.path.insert(0, r'c:\sem2\Adaptive_Stego_FULL')

DATABASE_URL = 'postgresql://cuttlefish:cuttlefish@localhost:5432/cuttlefish_db'

async def test():
    pool = await asyncpg.create_pool(DATABASE_URL)
    
    file_row = await pool.fetchrow('SELECT id, file_name, ciphertext FROM stego_files LIMIT 1')
    if not file_row:
        print('No files found in DB')
        return
    
    print(f"File: {file_row['file_name']}")
    print(f"Ciphertext size: {len(file_row['ciphertext'])} bytes")
    print(f"Ciphertext type: {type(file_row['ciphertext'])}")
    
    shards = await pool.fetch(
        'SELECT id, shard_index, image_data FROM stego_shards WHERE stego_file_id = $1 LIMIT 3',
        file_row['id']
    )
    print(f"Found {len(shards)} shards")
    
    if len(shards) < 3:
        print('Not enough shards')
        await pool.close()
        return
    
    from PIL import Image
    from decrypt_image import GhostDecoder
    decoder = GhostDecoder()
    
    extracted = []
    for s in shards:
        img = Image.open(io.BytesIO(bytes(s['image_data'])))
        result = decoder.extract_shard(img)
        print(f"Shard {s['shard_index']}: {repr(result[:40]) if result else None}")
        if result:
            extracted.append(result)
    
    print(f"\nExtracted {len(extracted)} shards successfully")
    
    if len(extracted) >= 3:
        from crypto_utils import assemble_horcruxes
        try:
            raw = assemble_horcruxes(extracted[:3], bytes(file_row['ciphertext']), k=3)
            print(f"SUCCESS: recovered {len(raw)} bytes")
            print(f"First 16 bytes hex: {raw[:16].hex()}")
            # Try to detect what kind of file this is
            print(f"First 4 bytes: {raw[:4]}")
        except Exception as e:
            print(f"FAILED: {e}")
    
    await pool.close()

asyncio.run(test())
