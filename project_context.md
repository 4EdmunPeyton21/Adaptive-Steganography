# Project Context: Adaptive Steganography / Project Cuttlefish

## Overview
Project Cuttlefish (also known as Ghost API) is a neural steganography vault designed as a Zero-Knowledge Cloud Drive. It provides absolute privacy by utilizing advanced neural networks to hide encrypted data within standard images, combined with the "Horcrux Protocol" for data sharding. 

The application is conceptually broken down into two major components:
1. **The Core Engine / Backend** - Handles neural embedding, extraction, cryptography, and the API.
2. **The Frontend (Cuttlefish UI)** - A modern, highly interactive web application that serves as the user-facing vault.

---

## Architecture & Tech Stack

### 1. Core Engine (Backend & Machine Learning)
- **Frameworks:** Python, FastAPI, PyTorch, OpenCV, Pillow, PyCryptodome.
- **Steganography:** Uses a Generative Adversarial Network (GAN) architecture for visually imperceptible, high-capacity data hiding.
- **Cryptography & Sharding:** Employs AES-GCM for encryption and Shamir's Secret Sharing (the "Horcrux Protocol") to split secrets into multiple shards for extreme security.
- **Image Processing:** Standardizes all cover images to a strict 256x256 resolution before embedding.
- **Key Files & Directories:**
  - `app.py` & `backend/`: FastAPI services providing the Ghost API and Cuttlefish Vault backend endpoints.
  - `crypto_utils.py`: Contains AES encryption and Shamir's Secret Sharing implementations.
  - `encrypt_image.py` / `decrypt_image.py`: Neural embedding and extraction pipelines.
  - `models/`: Contains the PyTorch definitions for the GAN and Camouflage Net architectures, along with pre-trained weights.
  - `stego/`: Additional adaptive engine utilities.

### 2. Frontend (Cuttlefish UI)
- **Frameworks:** Next.js 15 (App Router), React, TypeScript, Tailwind CSS.
- **Animations & Interactivity:** Framer Motion (for smooth zooming/fading), Lenis (for inertia-based smooth scrolling), and native WebGL shaders.
- **Theme:** "Obsidian" dark mode (#050505) with neon cyan accents (#00FFFF). 
- **Key Features:**
  - **Hero Landing Page (`/`):** A continuous 300vh scrolling experience seamlessly transitioning through three themes ("Ephemeral", "Spectral", and "Clandestine"). Uses Framer Motion `whileInView` for zooming typography and customized WebGL/CSS particle overlays.
  - **Authentication (`/auth/login`):** Features a glassmorphism login form sitting atop an interactive, cursor-responsive WebGL smokey shader background.
  - **Vault Dashboard (`/vault`):** A protected area containing a collapsible drag-and-drop upload zone and an interactive `PhotoCarousel` for viewing stored memories, complete with lightbox zooming and deletion capabilities.

---

## Current State of Development
- **Frontend Setup:** The Next.js 15 environment has been freshly initialized and customized. The Hero, Auth, and Vault screens are fully built with all intended smooth scroll functionality and UI/UX polish.
- **Backend Setup:** The FastAPI architecture is in place, and the core cryptographic and machine learning scripts are actively being developed/tested (e.g., `test_crypto.py`, `secrets_vault_test.py`).
- **Integration:** The next major phase typically involves wiring the polished frontend interfaces (`/auth` and `/vault`) directly to the FastAPI endpoints to achieve end-to-end functionality, executing the neural embedding and "Horcrux" sharding protocols on uploaded photos.
