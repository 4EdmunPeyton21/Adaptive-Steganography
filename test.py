from stego.adaptive_engine import AdaptiveEngine

def main():
    engine = AdaptiveEngine("models/weights/camou_net_midsem.pth")
    msg = "Hello World, this is a very special secret message!"
    print("Embedding...")
    img, _, _ = engine.embed("data/bossbase/000000000139.jpg", msg)
    img.save("encoded_secret.png")
    
    print("Extracting...")
    out_msg = engine.extract("encoded_secret.png")
    print(f"Original: {msg}")
    print(f"Extracted: {out_msg}")
    assert msg == out_msg, "Mismatch!"

if __name__ == "__main__":
    main()
