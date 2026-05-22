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


async def inspect():
    pool = await asyncpg.create_pool(DATABASE_URL)
    from PIL import Image

    for sid in SHARD_IDS:
        row = await pool.fetchrow(
            "SELECT image_data FROM stego_shards WHERE id = $1", uuid.UUID(sid)
        )
        img = Image.open(io.BytesIO(row["image_data"]))
        print(f"\nShard {sid[:8]}...")
        print(f"  Format : {img.format}")
        print(f"  Mode   : {img.mode}")
        print(f"  Size   : {img.size}")
        print(f"  Info keys : {list(img.info.keys())}")
        ghost = img.info.get("ghost_shard")
        print(f"  ghost_shard metadata : {repr(ghost[:80]) if ghost else 'MISSING'}")

    await pool.close()


asyncio.run(inspect())
