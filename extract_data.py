import os
import sys
from stego.adaptive_engine import AdaptiveEngine

def extract_message():
    stego_path = "FINAL_DEMO_STEGO.png"
    weights_path = "models/weights/camou_net_midsem.pth"

    if not os.path.exists(weights_path):
        print(f" Error: {weights_path} not found!")
        return

    if not os.path.exists(stego_path):
        print(f" Error: {stego_path} not found!")
        return
        
    print(f" Extraction starting on: AdaptiveEngine")

    engine = AdaptiveEngine(weights_path)
    
    print(f" Extracting hidden data from {stego_path}...")
    full_text = engine.extract(stego_path)

    if full_text:
        print("\n --- EXTRACTION SUCCESS ---")
        print(f" Recovered Message: {full_text}")
        print("------------------------------")
    else:
        print("\n Extraction ran but no text was found. Check your embedding/decoding logic.")

if __name__ == "__main__":
    extract_message()