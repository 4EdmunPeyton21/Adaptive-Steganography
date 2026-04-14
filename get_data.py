import os
import requests
import zipfile
import shutil
from tqdm import tqdm

def download_and_extract():
    # 1. Setup Folders
    target_folder = "input_dataset"
    temp_zip = "div2k_temp.zip"
    if not os.path.exists(target_folder):
        os.makedirs(target_folder)

    # Official ETH Zurich link for the 100-image Validation Set (~350MB)
    url = "https://data.vision.ee.ethz.ch/cvl/DIV2K/DIV2K_valid_HR.zip"
    
    # 2. Download the ZIP
    print(f"[*] Downloading DIV2K Validation Set (HR)...")
    headers = {"User-Agent": "Mozilla/5.0"}
    response = requests.get(url, stream=True, headers=headers)
    
    if response.status_code == 200:
        total_size = int(response.headers.get('content-length', 0))
        with open(temp_zip, "wb") as f, tqdm(
            total=total_size, unit='iB', unit_scale=True, desc="DIV2K_valid.zip"
        ) as bar:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
                bar.update(len(chunk))
    else:
        print(f"[!] Server Error: {response.status_code}. Try a manual download from the ETH Zurich website.")
        return

    # 3. Extract 50 images
    print("[*] Extracting 50 images for training...")
    with zipfile.ZipFile(temp_zip, 'r') as zip_ref:
        # Get list of image files (usually named 0801.png to 0900.png)
        all_files = [f for f in zip_ref.namelist() if f.endswith('.png')]
        for file in all_files[:50]:
            # Extract to target folder
            filename = os.path.basename(file)
            with zip_ref.open(file) as source, open(os.path.join(target_folder, filename), "wb") as target:
                shutil.copyfileobj(source, target)

    # 4. Cleanup
    os.remove(temp_zip)
    print(f"[+] Success! {len(os.listdir(target_folder))} images ready in {target_folder}/")

if __name__ == "__main__":
    download_and_extract()