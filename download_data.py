import os
import requests
import zipfile
from tqdm import tqdm

def download_coco():
    url = "http://images.cocodataset.org/zips/val2017.zip"
    target_path = "val2017.zip"
    extract_to = "data/bossbase"

    print(f" Starting direct download from COCO servers...")
    
    # 1. Download with a progress bar
    response = requests.get(url, stream=True)
    total_size = int(response.headers.get('content-length', 0))
    
    with open(target_path, "wb") as f, tqdm(
            desc="Downloading",
            total=total_size,
            unit='iB',
            unit_scale=True,
            unit_divisor=1024,
    ) as bar:
        for data in response.iter_content(chunk_size=1024):
            size = f.write(data)
            bar.update(size)

    # 2. Extract the images
    print(f"Extracting images to {extract_to}...")
    with zipfile.ZipFile(target_path, 'r') as zip_ref:
        zip_ref.extractall("data/temp_coco")
    
    # 3. Move them to the right place and cleanup
    temp_folder = "data/temp_coco/val2017"
    for filename in os.listdir(temp_folder):
        os.rename(os.path.join(temp_folder, filename), os.path.join(extract_to, filename))
    
    # 4. Clean up zip and temp folders
    os.remove(target_path)
    os.rmdir(temp_folder)
    os.rmdir("data/temp_coco")
    
    print(f"✅ DONE! 5,000 images are now in {extract_to}")

if __name__ == "__main__":
    # You might need to install tqdm first: pip install tqdm requests
    download_coco()