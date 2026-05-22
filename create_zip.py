import zipfile
import os

def create_colab_zip():
    target_zip = "colab_training_pack.zip"
    dirs_to_zip = ["models", "stego", "configs", "training"]
    files_to_zip = ["get_data.py"]
    
    with zipfile.ZipFile(target_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
        # Add files
        for file in files_to_zip:
            if os.path.exists(file):
                zipf.write(file, arcname=file)
                print(f"Added {file}")
                
        # Add directories
        for directory in dirs_to_zip:
            if os.path.exists(directory):
                for root, dirs, files in os.walk(directory):
                    for file in files:
                        # Skip __pycache__ and .bak files
                        if "__pycache__" in root or file.endswith(".bak"):
                            continue
                            
                        file_path = os.path.join(root, file)
                        # Store in zip with relative path
                        arcname = os.path.relpath(file_path, start=".")
                        zipf.write(file_path, arcname=arcname)
                print(f"Added {directory}/")
                
    print(f"\nSuccessfully created {target_zip} ({os.path.getsize(target_zip) / (1024*1024):.2f} MB)")

if __name__ == "__main__":
    create_colab_zip()
