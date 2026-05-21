import time
from stego.adaptive_engine import AdaptiveEngine
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches

# ─────────────────────────────────────────────
# 1. Load Model
# ─────────────────────────────────────────────
start_time = time.time()
print("🛰️  Loading AI Brain into GPU...")

engine = AdaptiveEngine("models/weights/camou_net_midsem.pth")

# ─────────────────────────────────────────────
# 2. EMBED secret message into cover image
# ─────────────────────────────────────────────
image_path = "data/bossbase/000000000139.jpg"
secret_msg = "One Piece Is Real!"

print(f"🎨 Analyzing texture in {image_path}...")
stego_img, heatmap, bpp = engine.embed(image_path, secret_msg)

embed_time = time.time() - start_time
print(f"\n✅ Embedding done in {embed_time:.2f}s")
print(f"📊 Average Capacity: {bpp:.4f} bits per pixel")

# ─────────────────────────────────────────────
# 3. SAVE stego image to disk
# ─────────────────────────────────────────────
stego_path = "FINAL_DEMO_STEGO.png"
stego_img.save(stego_path)
print(f"💾 Stego image saved → {stego_path}")

# ─────────────────────────────────────────────
# 4. EXTRACT (decrypt) the hidden message back
# ─────────────────────────────────────────────
print("\n🔓 Extracting hidden message from stego image...")
extract_start = time.time()

recovered_msg = engine.extract(stego_path)

extract_time = time.time() - extract_start
print(f"⏱️  Extraction done in {extract_time:.2f}s")

# ─────────────────────────────────────────────
# 5. Verify correctness
# ─────────────────────────────────────────────
match = recovered_msg == secret_msg
print("\n" + "="*55)
print(f"📩 Original  : {secret_msg}")
print(f"📬 Recovered : {recovered_msg}")
print(f"{'✅ PERFECT MATCH — Decryption correct!' if match else '❌ MISMATCH — check embedding logic.'}")
print("="*55)

total_time = time.time() - start_time
print(f"\n⏱️  Total pipeline time: {total_time:.2f} seconds")

# ─────────────────────────────────────────────
# 6. Visualize — 3 panels
# ─────────────────────────────────────────────
print("\n🖼️  Opening visualization window... (Close it to finish)")

fig, axes = plt.subplots(1, 3, figsize=(18, 6))
fig.patch.set_facecolor('#0f0f0f')
fig.suptitle("Adaptive AI Steganography — Full Pipeline Demo",
             color='white', fontsize=14, fontweight='bold', y=1.01)

# Panel 1: AI Capacity Heatmap
ax1 = axes[0]
ax1.imshow(heatmap, cmap='magma')
ax1.set_title("AI Capacity Heatmap", color='white', fontsize=11, pad=8)
ax1.axis('off')

# Panel 2: Stego Image
ax2 = axes[1]
ax2.imshow(stego_img)
ax2.set_title("Stego Image (hidden message inside)", color='white', fontsize=11, pad=8)
ax2.axis('off')

# Panel 3: Decryption Result
ax3 = axes[2]
ax3.set_facecolor('#1a1a2e')
ax3.set_xlim(0, 1)
ax3.set_ylim(0, 1)
ax3.axis('off')
ax3.set_title("Decryption Result", color='white', fontsize=11, pad=8)

status_color  = '#00e676' if match else '#ff1744'
status_symbol = '✔ MATCH'  if match else '✘ MISMATCH'

ax3.text(0.5, 0.85, "Original Message:",
         ha='center', va='center', color='#aaaaaa', fontsize=8, transform=ax3.transAxes)
ax3.text(0.5, 0.72, f'"{secret_msg}"',
         ha='center', va='center', color='#e0e0e0', fontsize=7.5,
         wrap=True, transform=ax3.transAxes,
         bbox=dict(boxstyle='round,pad=0.4', facecolor='#2a2a4a', edgecolor='#555'))

ax3.text(0.5, 0.52, "Recovered Message:",
         ha='center', va='center', color='#aaaaaa', fontsize=8, transform=ax3.transAxes)
ax3.text(0.5, 0.39, f'"{recovered_msg}"',
         ha='center', va='center', color='#e0e0e0', fontsize=7.5,
         wrap=True, transform=ax3.transAxes,
         bbox=dict(boxstyle='round,pad=0.4', facecolor='#2a2a4a', edgecolor='#555'))

ax3.text(0.5, 0.18, status_symbol,
         ha='center', va='center', color=status_color, fontsize=15,
         fontweight='bold', transform=ax3.transAxes,
         bbox=dict(boxstyle='round,pad=0.5', facecolor='#0d0d1a', edgecolor=status_color, linewidth=2))

ax3.text(0.5, 0.04, f"BPP: {bpp:.4f}  |  Embed: {embed_time:.2f}s  |  Extract: {extract_time:.2f}s",
         ha='center', va='center', color='#555', fontsize=7, transform=ax3.transAxes)

for ax in axes:
    for spine in ax.spines.values():
        spine.set_edgecolor('#333')

plt.tight_layout()
plt.show()