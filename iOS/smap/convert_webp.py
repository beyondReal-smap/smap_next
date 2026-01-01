from PIL import Image
import os

base_path = "/Users/genie/SmapSource/smap_next/iOS/smap/Assets.xcassets"
groups = ["group1", "group2"]

for group in groups:
    webp_path = os.path.join(base_path, f"{group}.imageset", f"{group}.webp")
    png_path = os.path.join(base_path, f"{group}.imageset", f"{group}.png")
    
    try:
        if os.path.exists(webp_path):
            img = Image.open(webp_path).convert("RGB")
            img.save(png_path, "PNG")
            print(f"Converted {group}.webp to {group}.png")
            # os.remove(webp_path) # Optional: keep it for now
        else:
            print(f"File not found: {webp_path}")
    except Exception as e:
        print(f"Error converting {group}: {e}")
