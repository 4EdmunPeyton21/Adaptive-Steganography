# Ghost API - Zero-Knowledge Cloud Drive
## Absolute Privacy via Adaptive Steganography & The Horcrux Protocol

### 1. THE CORE ENGINE (BACKEND)
- **Standardization:** Every cover image is normalized to exactly 256x256 pixels.
- **The Horcrux Protocol:** (In Development) Splits encrypted files into 'N' shards using Shamir’s Secret Sharing.
- **Steganography:** Neural Embedding using a GAN architecture for high-capacity, visually imperceptible data hiding.
- **Tech Stack:** Python (FastAPI), PyTorch, Pillow, OpenCV, PyCryptodome.

### 2. THE VISUAL IDENTITY (FRONTEND)
- **Aesthetic:** High-end technical luxury. Bento grids, obsidian themes (#050505), neon-cyan accents (#00FFFF).
- **Tech Stack:** Next.js (App Router), Tailwind CSS, Shadcn/ui, GSAP, Framer Motion.

---

## ??? Installation & Setup

1. **Clone the repository:**
   `ash
   git clone https://github.com/4EdmunPeyton21/Adaptive-Steganography.git
   cd Adaptive-Steganography
   `

2. **Create a virtual environment:**
   `ash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   `

3. **Install dependencies:**
   `ash
   pip install -r requirements.txt
   `

4. **Launch the Ghost API:**
   `ash
   uvicorn app:app --reload
   `

---

## ??? Project Architecture

`	ext
+-- app.py                  # Ghost API Gateway (FastAPI)
+-- encrypt_image.py        # Core Neural Embedding Logic
+-- decrypt_image.py        # Neural Extraction Logic
+-- models/                 # GAN & Camouflage Net Architectures
¦   +-- weights/            # Pre-trained Stealth Weights
+-- stego/                  # Adaptive Engine & Crypto Utilities
+-- configs/                # Training & Inference Hyperparameters
`

---

## ?? Future Ecosystem
- **Ghost API Dashboard:** B2B-style developer interface for key and asset management.
- **Chrome Extension:** Real-time DOM monitoring to "reveal" hidden data in shard-images.

---
*Built with the Horcrux Protocol for a future without surveillance.*
