from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import shutil
import uuid
from encrypt_image import encrypt_logic  # We'll need to wrap your logic in a function
from decrypt_image import decrypt_logic

app = FastAPI(title="GhostDrive AI API")

# Allow React to communicate with this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "web_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/hide")
async def hide_data(
    cover_image: UploadFile = File(...),
    secret_file: UploadFile = File(...),
    password: str = Form(...)
):
    session_id = str(uuid.uuid4())
    session_path = os.path.join(UPLOAD_DIR, session_id)
    os.makedirs(session_path)

    # Save incoming files
    cover_path = os.path.join(session_path, cover_image.filename)
    secret_path = os.path.join(session_path, secret_file.filename)
    
    with open(cover_path, "wb") as f:
        shutil.copyfileobj(cover_image.file, f)
    with open(secret_path, "wb") as f:
        shutil.copyfileobj(secret_file.file, f)

    # Output path
    stego_path = os.path.join(session_path, "stego_output.png")

    try:
        # Call your existing AI logic
        # Note: We'll modify your script slightly to be "callable"
        encrypt_logic(cover_path, secret_path, stego_path, password)
        
        return FileResponse(
            stego_path, 
            media_type="image/png", 
            filename="stego_vault.png"
        )
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/")
def health_check():
    return {"status": "AI Engine Online", "weights": "Adversarial_v1.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)