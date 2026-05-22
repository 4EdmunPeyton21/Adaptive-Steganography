import asyncio
import asyncpg
import uuid
import io
import sys

sys.path.insert(0, ".")

DATABASE_URL = "postgresql://cuttlefish:cuttlefish@localhost:5432/cuttlefish_db"

SHARD_IDS = [
    "24396809-1052-48ff-926c-8a7617828906",
    "f8044674-f902-492f-9161-dcea0289560a",
    "8eda4abc-49ec-4a24-80fe-d62d25870dbc",
]


async def test_recover():
    pool = await asyncpg.create_pool(DATABASE_URL)

    from PIL import Image
    from decrypt_image import GhostDecoder
    from crypto_utils import assemble_horcruxes

    shards_data = []
    file_ids = set()
    for sid in SHARD_IDS:
        row = await pool.fetchrow(
            "SELECT image_data, stego_file_id FROM stego_shards WHERE id = $1",
            uuid.UUID(sid),
        )
        print(f"Shard {sid[:8]}... -> file_id={row['stego_file_id']}, image_size={len(row['image_data'])} bytes")
        file_ids.add(row["stego_file_id"])
        shards_data.append(row["image_data"])

    file_id = list(file_ids)[0]
    file_row = await pool.fetchrow(
        "SELECT ciphertext, file_name FROM stego_files WHERE id = $1", file_id
    )
    print(f"File: {file_row['file_name']}, ciphertext={len(file_row['ciphertext'])} bytes")

    decoder = GhostDecoder()
    extracted_shards = []
    for i, img_bytes in enumerate(shards_data):
        img = Image.open(io.BytesIO(img_bytes))
        print(f"  Extracting shard {i+1}...")
        try:
            shard_str = decoder.extract_shard(img)
            print(f"  -> result: {repr(shard_str[:80]) if shard_str else None}")
            if shard_str:
                extracted_shards.append(shard_str)
        except Exception as e:
            print(f"  -> EXCEPTION: {e}")

    print(f"\nExtracted {len(extracted_shards)}/{len(shards_data)} shards")

    if len(extracted_shards) >= 3:
        try:
            raw_data = assemble_horcruxes(extracted_shards, file_row["ciphertext"], k=3)
            print(f"SUCCESS: recovered {len(raw_data)} bytes")
        except Exception as e:
            print(f"assemble_horcruxes FAILED: {type(e).__name__}: {e}")
    else:
        print("FAILED: Not enough shards extracted to recover (need 3)")

    await pool.close()


asyncio.run(test_recover())
