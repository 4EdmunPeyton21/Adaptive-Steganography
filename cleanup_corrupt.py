import asyncio
import asyncpg
import uuid

DATABASE_URL = "postgresql://cuttlefish:cuttlefish@localhost:5432/cuttlefish_db"
CORRUPT_FILE_ID = uuid.UUID("681556a8-e8e4-4904-a006-cb1c8675302f")


async def cleanup():
    pool = await asyncpg.create_pool(DATABASE_URL)
    deleted_shards = await pool.execute(
        "DELETE FROM stego_shards WHERE stego_file_id = $1",
        CORRUPT_FILE_ID,
    )
    deleted_file = await pool.execute(
        "DELETE FROM stego_files WHERE id = $1",
        CORRUPT_FILE_ID,
    )
    print(f"Cleaned up shards: {deleted_shards}")
    print(f"Cleaned up file:   {deleted_file}")

    remaining_files = await pool.fetch("SELECT id, file_name FROM stego_files")
    print(f"Remaining files: {[dict(r) for r in remaining_files]}")
    await pool.close()


asyncio.run(cleanup())
