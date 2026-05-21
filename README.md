# Ghost API - Zero-Knowledge Cloud Drive
## Absolute Privacy via Adaptive Steganography & The Horcrux Protocol

### Core Engine
- **Standardization:** Every cover image is normalized to exactly 256x256 pixels.
- **The Horcrux Protocol:** (In Development) Splits encrypted files into N shards using Shamir's Secret Sharing.
- **Steganography:** Neural embedding using a GAN architecture for high-capacity, visually imperceptible data hiding.
- **Tech Stack:** Python (FastAPI), PyTorch, Pillow, OpenCV, PyCryptodome.

---

## Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/4EdmunPeyton21/Adaptive-Steganography.git
   cd Adaptive-Steganography
   ```

2. **Create a virtual environment:**
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Launch the Ghost API:**
   ```bash
   uvicorn app:app --reload
   ```

   The Cuttlefish Vault backend can also be run with:
   ```bash
   uvicorn backend.main:app --reload --port 8000
   ```

---

## Project Architecture

```text
+-- app.py                  # Ghost API Gateway (FastAPI)
+-- backend/                # Cuttlefish Vault FastAPI service and schema
+-- encrypt_image.py        # Core Neural Embedding Logic
+-- decrypt_image.py        # Neural Extraction Logic
+-- models/                 # GAN & Camouflage Net Architectures
+-- models/weights/         # Pre-trained Stealth Weights
+-- stego/                  # Adaptive Engine & Crypto Utilities
+-- configs/                # Training & Inference Hyperparameters
```

---

*Built with the Horcrux Protocol for a future without surveillance.*
